#!/usr/bin/env node
// Genera seed.csv a partir de posts/*.md para sembrar la hoja de Google Sheets
// (uso único). Importar en Sheets: Archivo > Importar > Añadir a la hoja actual.
// Uso: node scripts/seed-sheet.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitize } from './build-index.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = join(root, 'posts');

// Campo CSV entrecomillado (RFC 4180)
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;

const rows = [];
for (const file of readdirSync(postsDir).filter(f => f.endsWith('.md')).sort()) {
  const raw = readFileSync(join(postsDir, file), 'utf8');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fm) { console.warn(`Sin frontmatter, omitido: ${file}`); continue; }
  const get = (k) => (fm[1].match(new RegExp(`^${k}:(.*)$`, 'm')) || [, ''])[1].trim().replace(/^"|"$/g, '');

  const title = get('title');
  // Separar "Título (Año)" en columnas Título y Año
  const m = title.match(/^(.*)\s+\((\d{4})\)$/);
  const titulo = m ? m[1] : title;
  const anio = m ? m[2] : '';

  // Fecha del post -> Timestamp DD/MM/YYYY (formato que espera el sync)
  const [y, mo, d = '01'] = get('date').split('-');
  const timestamp = `${d}/${mo}/${y} 0:00:00`;

  const content = sanitize(raw.slice(fm[0].length));
  if (content !== raw.slice(fm[0].length).trim()) {
    console.warn(`Aviso: el saneado modifica el contenido de ${file} (se siembra saneado).`);
  }

  rows.push([timestamp, titulo, anio, get('rating') || '0', get('author'), content].map(q).join(','));
}

writeFileSync(join(root, 'seed.csv'), rows.join('\r\n') + '\r\n');
console.log(`seed.csv generado con ${rows.length} filas (sin cabecera: se importa bajo la existente).`);
