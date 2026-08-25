#!/usr/bin/env node
// Cifra la URL del formulario de gestión con una contraseña (AES-GCM +
// PBKDF2) y escribe admin.json. La contraseña NO se guarda en ningún sitio:
// es la clave de descifrado que se teclea en /admin.
// Uso: ADMIN_PASSWORD='...' ADMIN_URL='https://...' node scripts/encrypt-admin.mjs
import { webcrypto as crypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const password = process.env.ADMIN_PASSWORD;
const url = process.env.ADMIN_URL;
if (!password || !url) {
  console.error("Uso: ADMIN_PASSWORD='...' ADMIN_URL='https://...' node scripts/encrypt-admin.mjs");
  process.exit(1);
}

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
  baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
);
const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(url));

const b64 = (buf) => Buffer.from(buf).toString('base64');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
writeFileSync(join(root, 'admin.json'), JSON.stringify({
  salt: b64(salt), iv: b64(iv), data: b64(ciphertext),
}) + '\n');
console.log('admin.json generado. Commitealo: es seguro, solo se descifra con la contraseña.');
