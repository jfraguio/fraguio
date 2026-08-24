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

## Publicación

Nueva crítica → [formulario](https://docs.google.com/forms/d/e/1FAIpQLSeqxXUGhrEKCw7IuRS8zhExGO1zo4aZNHFc0ZKhaaF9wmODaA/viewform)

Google Form → Google Sheet (publicada como CSV) → GitHub Action
([sync-posts.yml](.github/workflows/sync-posts.yml), cada 5 min) que genera los
markdowns nuevos, regenera `posts.js`/`posts.json` y hace commit. La entrada se
identifica por slug derivado de **título + autor** (👾 → `alien`, 🐧 →
`pinguino`); una fila con un slug ya existente se ignora.

Para forzar la actualización sin esperar al cron:

```sh
gh workflow run sync-posts.yml --repo jfraguio/fraguio
```
