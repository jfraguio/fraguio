#!/usr/bin/env node
// Sincroniza críticas desde la hoja de Google Sheets (publicada como CSV)
// y genera posts/*.md para las filas que aún no existan.
// Uso: SHEET_CSV_URL=... node scripts/sync-from-sheet.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
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

// Slugs ya publicados (la carpeta posts/ es el registro de lo existente)
const existingSlugs = new Set();
for (const file of readdirSync(postsDir).filter(f => f.endsWith('.md'))) {
  const raw = readFileSync(join(postsDir, file), 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) continue;
  const get = (k) => (fm[1].match(new RegExp(`^${k}:(.*)$`, 'm')) || [, ''])[1].trim().replace(/^"|"$/g, '');
  existingSlugs.add(slugFor(get('title'), get('author')));
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

let created = 0;
for (const row of rows) {
  const titulo = (row[COL.titulo] || '').trim();
  const anio = (row[COL.anio] || '').trim();
  const critica = (row[COL.critica] || '').trim();
  if (!titulo || !critica) continue; // fila incompleta: ignorar

  const author = (row[COL.autor] || '').trim();
  const rating = Math.max(0, Math.min(5, parseInt(row[COL.estrellas], 10) || 0));
  const date = toIsoDate((row[COL.timestamp] || '').trim());
  const title = anio ? `${titulo} (${anio})` : titulo;
  const slug = slugFor(title, author);

  if (existingSlugs.has(slug)) continue; // ya publicado
  existingSlugs.add(slug);

  const authorKey = AUTHOR_KEYS[author] || 'anon';
  let file = `${date.slice(0, 7)}-${authorKey}-${slugFor(titulo, '')}${anio ? '-' + anio : ''}.md`;
  if (existsSync(join(postsDir, file))) file = `${date}-${slug}.md`;

  const md = `---
title: "${title.replace(/"/g, "'")}"
rating: ${rating}
author: ${author}
date: ${date}
---

${critica}
`;
  writeFileSync(join(postsDir, file), md);
  console.log(`Nuevo post: ${file}`);
  created++;
}

console.log(created ? `${created} post(s) creados.` : 'Sin novedades.');
