#!/usr/bin/env node
// Genera posts.json a partir de posts/*.md (frontmatter + contenido).
// Uso: node scripts/build-index.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = join(root, 'posts');

function parseFrontmatter(raw, file) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error(`Sin frontmatter: ${file}`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    meta[line.slice(0, idx).trim()] = value;
  }
  return { meta, content: raw.slice(match[0].length).trim() };
}

// Mapeo de autor (emoji) a clave para el slug.
export const AUTHOR_KEYS = { '👾': 'alien', '🐧': 'pinguino' };

// Slug canónico: título + autor. Es la clave de identidad de un post.
export function slugFor(title, author) {
  const base = (title + (author ? ' ' + (AUTHOR_KEYS[author] || author) : ''))
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base;
}

const posts = [];
const seen = new Map();
function build() {
for (const file of readdirSync(postsDir).filter(f => f.endsWith('.md'))) {
  const raw = readFileSync(join(postsDir, file), 'utf8');
  const { meta, content } = parseFrontmatter(raw, file);
  for (const field of ['title', 'date']) {
    if (!meta[field]) throw new Error(`Falta '${field}' en ${file}`);
  }
  const author = meta.author || '';
  const slug = slugFor(meta.title, author);
  if (seen.has(slug)) {
    throw new Error(`Colisión de slug '${slug}': ${file} y ${seen.get(slug)} (mismo título + autor)`);
  }
  seen.set(slug, file);
  posts.push({
    slug,
    title: meta.title,
    rating: meta.rating ? Number(meta.rating) : null,
    author,
    date: meta.date,
    content,
  });
}

posts.sort((a, b) => b.date.localeCompare(a.date));

const json = JSON.stringify(posts, null, 2);
writeFileSync(join(root, 'posts.json'), json + '\n');
writeFileSync(join(root, 'posts.js'), `// Generado por scripts/build-index.mjs — no editar a mano.\nwindow.POSTS = ${json};\n`);
console.log(`posts.json y posts.js generados con ${posts.length} entradas.`);
}

// Solo ejecutar cuando se invoca directamente (no al importar slugFor/AUTHOR_KEYS)
if (process.argv[1] === fileURLToPath(import.meta.url)) build();
