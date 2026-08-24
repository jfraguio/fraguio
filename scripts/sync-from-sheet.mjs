#!/usr/bin/env node
// Sincroniza críticas desde la hoja de Google Sheets (publicada como CSV).
// La hoja es la fuente de verdad:
// - Fila nueva -> genera posts/*.md
// - Fila con mismo Título+Año+Autor pero distinto contenido/nota -> archiva
//   la versión anterior en versions/ y sobrescribe.
// - Post sin fila en la hoja -> se despublica (archivado en versions/),
//   con salvaguardas contra borrados masivos accidentales.
// Uso: SHEET_CSV_URL=... node scripts/sync-from-sheet.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugFor, AUTHOR_KEYS, sanitize } from './build-index.mjs';

const CSV_URL = process.env.SHEET_CSV_URL;
if (!CSV_URL) {
  console.error('Falta la variable de entorno SHEET_CSV_URL');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = join(root, 'posts');
const versionsDir = join(root, 'versions');

// --- Parser CSV (RFC 4180: comillas, comas y saltos de línea en campos) ---
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(f => f !== '')) rows.push(row); }
  return rows;
}

// Timestamp de Forms ("24/08/2026 12:34:56" o "8/24/2026 12:34:56") -> YYYY-MM-DD
function toIsoDate(ts) {
  const m = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    let [, a, b, y] = m;
    // Si el primer número no puede ser mes, es formato DD/MM
    let month, day;
    if (Number(a) > 12) { day = a; month = b; }
    else if (Number(b) > 12) { month = a; day = b; }
    else { day = a; month = b; } // ambiguo: asumimos DD/MM (locale es-ES)
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const d = new Date(ts);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  throw new Error(`Timestamp no reconocido: ${ts}`);
}

// Posts ya publicados, indexados por slug (la carpeta posts/ es el registro)
const existing = new Map(); // slug -> { file, rating, content }
for (const file of readdirSync(postsDir).filter(f => f.endsWith('.md'))) {
  const raw = readFileSync(join(postsDir, file), 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fm) continue;
  const get = (k) => (fm[1].match(new RegExp(`^${k}:(.*)$`, 'm')) || [, ''])[1].trim().replace(/^"|"$/g, '');
  existing.set(slugFor(get('title'), get('author')), {
    file,
    rating: Number(get('rating')) || 0,
    content: raw.slice(fm[0].length).trim(),
  });
}

const res = await fetch(CSV_URL, { redirect: 'follow' });
if (!res.ok) {
  console.error(`Error descargando el CSV: ${res.status}`);
  process.exit(1);
}
const rows = parseCsv(await res.text());
const header = rows.shift().map(h => h.trim());
const col = (name) => {
  const i = header.indexOf(name);
  if (i === -1) throw new Error(`Columna '${name}' no encontrada. Cabecera: ${header.join(', ')}`);
  return i;
};
const COL = {
  timestamp: col('Timestamp'),
  titulo: col('Título'),
  anio: col('Año'),
  estrellas: col('Estrellas'),
  autor: col('Autor'),
  critica: col('Crítica'),
};

// Agrupar filas por slug quedándonos con la última (la hoja está en orden
// cronológico): si se reenvía la misma crítica, gana la versión más reciente.
const candidates = new Map(); // slug -> datos de la fila
for (const row of rows) {
  const titulo = (row[COL.titulo] || '').trim();
  const anio = (row[COL.anio] || '').trim();
  const critica = sanitize(row[COL.critica] || '');
  if (!titulo || !critica) continue; // fila incompleta: ignorar

  const author = (row[COL.autor] || '').trim();
  const rating = Math.max(0, Math.min(5, parseInt(row[COL.estrellas], 10) || 0));
  const date = toIsoDate((row[COL.timestamp] || '').trim());
  const title = anio ? `${titulo} (${anio})` : titulo;
  const slug = slugFor(title, author);
  candidates.set(slug, { titulo, anio, title, author, rating, date, critica, slug });
}

function postMd({ title, rating, author, date, critica }) {
  return `---
title: "${title.replace(/"/g, "'")}"
rating: ${rating}
author: ${author}
date: ${date}
---

${critica}
`;
}

let created = 0, updated = 0, removed = 0;
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').slice(0, 15); // YYYYMMDDTHHMMSS

function archive(file) {
  mkdirSync(versionsDir, { recursive: true });
  const archived = file.replace(/\.md$/, `-${stamp()}.md`);
  renameSync(join(postsDir, file), join(versionsDir, archived));
  return archived;
}

for (const c of candidates.values()) {
  const prev = existing.get(c.slug);

  if (prev) {
    // Sin cambios de contenido ni de nota: nada que hacer
    if (prev.content === c.critica && prev.rating === c.rating) continue;
    // Archivar la versión anterior y sobrescribir (mismo fichero, fecha nueva)
    const archived = archive(prev.file);
    writeFileSync(join(postsDir, prev.file), postMd(c));
    console.log(`Actualizado: ${prev.file} (versión anterior en versions/${archived})`);
    updated++;
    continue;
  }

  const authorKey = AUTHOR_KEYS[c.author] || 'anon';
  let file = `${c.date.slice(0, 7)}-${authorKey}-${slugFor(c.titulo, '')}${c.anio ? '-' + c.anio : ''}.md`;
  if (existsSync(join(postsDir, file))) file = `${c.date}-${c.slug}.md`;
  writeFileSync(join(postsDir, file), postMd(c));
  console.log(`Nuevo post: ${file}`);
  created++;
}

// --- Despublicación: post sin fila en la hoja -> archivar en versions/ ---
if (candidates.size === 0) {
  console.warn('Aviso: la hoja no tiene filas válidas; se omite la despublicación por seguridad.');
} else {
  const toRemove = [...existing.entries()].filter(([slug]) => !candidates.has(slug));
  const MAX_ABS = 10, MAX_PCT = 0.3;
  if (toRemove.length > MAX_ABS || toRemove.length > existing.size * MAX_PCT) {
    console.error(`Abortado: se despublicarían ${toRemove.length} de ${existing.size} posts ` +
      `(límites: ${MAX_ABS} o ${MAX_PCT * 100}%). Si es intencionado, hazlo por tandas o vía git.`);
    process.exit(1);
  }
  for (const [, { file }] of toRemove) {
    const archived = archive(file);
    console.log(`Despublicado: ${file} → versions/${archived}`);
    removed++;
  }
}

console.log(created || updated || removed
  ? `${created} post(s) creados, ${updated} actualizado(s), ${removed} despublicado(s).`
  : 'Sin novedades.');
