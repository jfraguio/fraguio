#!/usr/bin/env node
// Sincroniza críticas desde la hoja de Google Sheets (publicada como CSV):
// - Filas nuevas -> genera posts/*.md
// - Filas con mismo Título+Año+Autor que un post existente pero distinto
//   contenido/nota -> archiva la versión anterior en versions/ y sobrescribe.
// Uso: SHEET_CSV_URL=... node scripts/sync-from-sheet.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugFor, AUTHOR_KEYS } from './build-index.mjs';

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

// Saneado del texto de la crítica: colapsa espaciados múltiples y exceso de
// saltos de línea (máximo una línea en blanco), respetando los saltos simples.
function sanitize(text) {
  return text
    .replace(/\r\n?/g, '\n')            // normalizar finales de línea
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim()) // espacios múltiples -> uno
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')         // 3+ saltos -> párrafo (uno en blanco)
    .trim();
}

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

let created = 0, updated = 0;
for (const c of candidates.values()) {
  const prev = existing.get(c.slug);

  if (prev) {
    // Sin cambios de contenido ni de nota: nada que hacer
    if (prev.content === c.critica && prev.rating === c.rating) continue;
    // Archivar la versión anterior y sobrescribir (mismo fichero, fecha nueva)
    mkdirSync(versionsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15); // YYYYMMDDTHHMMSS
    const archived = prev.file.replace(/\.md$/, `-${stamp}.md`);
    renameSync(join(postsDir, prev.file), join(versionsDir, archived));
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

console.log(created || updated
  ? `${created} post(s) creados, ${updated} actualizado(s).`
  : 'Sin novedades.');
