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

// --- Fechas -----------------------------------------------------------------
// En la hoja conviven dos tipos de Timestamp:
//  a) Filas semilla (scripts/seed-sheet.mjs): "DD/MM/YYYY 0:00:00", con ceros a
//     la izquierda. Siempre día/mes.
//  b) Filas escritas por Google Forms: sin ceros a la izquierda y con hora
//     real. El orden día/mes depende de la configuración regional de la hoja
//     (EE.UU. -> M/D/YYYY, España -> D/M/YYYY).
// Cuando ambos números son <= 12 la fila es ambigua. Para las filas de Forms
// el orden se deduce de las filas inequívocas de la propia hoja (algún número
// > 12); si no hay ninguna se usa SHEET_DATE_ORDER (DMY|MDY) y, en último
// término, MDY (configuración actual de la hoja).
// Esta función nunca lanza: si no reconoce el formato, usa la fecha de hoy y
// avisa, para que una fila rara no bloquee la publicación del resto.
const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;

function isSeedTimestamp(ts) {
  const m = ts.match(DATE_RE);
  if (!m) return false;
  const [, a, b, , h, mi, s] = m;
  const padded = (a.length === 2 && a[0] === '0') || (b.length === 2 && b[0] === '0');
  const midnight = h !== undefined && Number(h) === 0 && Number(mi) === 0 && Number(s || 0) === 0;
  return padded || midnight;
}

function detectFormsDateOrder(timestamps) {
  let dmy = 0, mdy = 0;
  for (const ts of timestamps) {
    const m = ts.match(DATE_RE);
    if (!m || isSeedTimestamp(ts)) continue;
    const a = Number(m[1]), b = Number(m[2]);
    if (a > 12 && b <= 12) dmy++;
    else if (b > 12 && a <= 12) mdy++;
  }
  if (dmy !== mdy) return dmy > mdy ? 'DMY' : 'MDY';
  const env = (process.env.SHEET_DATE_ORDER || '').toUpperCase();
  if (env === 'DMY' || env === 'MDY') return env;
  return 'MDY';
}

function validYmd(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const today = () => new Date().toISOString().slice(0, 10);

function toIsoDate(ts, formsOrder) {
  const m = ts.match(DATE_RE);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
    let order;
    if (a > 12 && b <= 12) order = 'DMY';
    else if (b > 12 && a <= 12) order = 'MDY';
    else order = isSeedTimestamp(ts) ? 'DMY' : formsOrder;
    const [day, month] = order === 'DMY' ? [a, b] : [b, a];
    if (validYmd(y, month, day)) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    // Interpretación imposible (p. ej. mes 13): probar la contraria
    if (validYmd(y, day, month)) {
      return `${y}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
    }
  }
  const d = new Date(ts);
  if (ts && !isNaN(d)) return d.toISOString().slice(0, 10);
  console.warn(`Aviso: Timestamp no reconocido '${ts}'; se usa la fecha de hoy.`);
  return today();
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
if (rows.length === 0) {
  console.error('El CSV está vacío (sin cabecera). Se aborta sin tocar nada.');
  process.exit(1);
}
// Cabeceras tolerantes a mayúsculas, acentos y espacios ("Titulo " == "Título")
const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const header = rows.shift().map(normalize);
const col = (name) => {
  const i = header.indexOf(normalize(name));
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

const formsDateOrder = detectFormsDateOrder(rows.map(r => (r[COL.timestamp] || '').trim()));
console.log(`Orden día/mes de las filas de Forms: ${formsDateOrder}`);

// Agrupar filas por slug quedándonos con la última (la hoja está en orden
// cronológico): si se reenvía la misma crítica, gana la versión más reciente.
// Ninguna fila puede abortar el sync: si una falla, se avisa y se sigue.
const candidates = new Map(); // slug -> datos de la fila
rows.forEach((row, idx) => {
  try {
    const titulo = (row[COL.titulo] || '').trim();
    const anio = (row[COL.anio] || '').trim();
    const critica = sanitize(row[COL.critica] || '');
    if (!titulo || !critica) {
      console.warn(`Aviso: fila ${idx + 2} incompleta (sin título o sin crítica); se ignora.`);
      return;
    }

    const author = (row[COL.autor] || '').trim();
    const rating = Math.max(0, Math.min(5, parseInt(row[COL.estrellas], 10) || 0));
    const date = toIsoDate((row[COL.timestamp] || '').trim(), formsDateOrder);
    const title = anio ? `${titulo} (${anio})` : titulo;
    const slug = slugFor(title, author);
    if (!slug) {
      console.warn(`Aviso: fila ${idx + 2} ('${titulo}') no genera un slug válido; se ignora.`);
      return;
    }
    candidates.set(slug, { titulo, anio, title, author, rating, date, critica, slug });
  } catch (err) {
    console.warn(`Aviso: fila ${idx + 2} descartada por error: ${err.message}`);
  }
});

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
