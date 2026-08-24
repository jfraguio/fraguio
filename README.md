# Fraguío

Blog de reseñas de cine. Sitio 100% estático, pensado para GitHub Pages.

## Estructura

- `index.html`, `app.js`, `styles.css` — el sitio (sin build, sin dependencias locales; `marked` por CDN).
- `posts/*.md` — las entradas. Nombre de fichero: `año-mes-autor-título.md`
  (ej. `2026-07-alien-the-odyssey-2026.md`; sin autor se omite). La identidad
  del post (slug) se deriva del frontmatter (título + autor), no del nombre.
  Frontmatter:

  ```
  ---
  title: Título (Año)
  rating: 4          # 0-5 estrellas
  author: 👾         # opcional
  date: 2026-07-25   # se muestra solo mes y año
  ---

  Contenido en markdown...
  ```

- `posts.js` / `posts.json` — artefactos generados a partir de `posts/*.md`. No editar a mano.
- `scripts/build-index.mjs` — los regenera.

## Desarrollo local

```sh
node scripts/build-index.mjs   # tras añadir/editar posts
```

Abre `index.html` directamente en el navegador (doble click) o sirve con
`python3 -m http.server 8642`.

## Publicación (próximamente)

Google Form → Google Sheet → GitHub Action (cada 15 min) que genera los
markdowns, regenera `posts.js`/`posts.json` y hace commit. La entrada se
identifica por slug derivado de **título + autor** (👾 → `alien`, 🐧 →
`pinguino`); una nueva respuesta con el mismo título y autor sobrescribe, y una
operación de borrado por slug la elimina.
