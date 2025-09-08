# FRAGUÍO - Blog Personal

Blog personal minimalista con arquitectura fullstack en un único repositorio.

## Tecnologías

- **Backend**: Node.js 20 + Express
- **Frontend**: React + Vite
- **Base de datos**: SQLite
- **Puerto**: 3123 (o dinámico si está ocupado)

## Setup Inicial

```bash
# Instalar dependencias del backend y frontend
npm run setup

# Opcional: poblar base de datos con entradas ficticias
npm run seed
```

## Desarrollo

```bash
# Construir frontend y iniciar servidor
npm run dev

# La aplicación estará disponible en http://localhost:3123 (o el puerto que se muestre)
```

## Producción

```bash
# Construir frontend
npm run build

# Iniciar servidor de producción
npm start
```

## Rutas

- **Home**: `/` - Lista de entradas con fijadas horizontales
- **Detalle**: `/post/:id` - Entrada individual
- **Admin**: `/admin/new` - Crear nueva entrada (requiere autenticación)

## API

- `GET /api/posts?offset=0&limit=50` - Lista paginada de entradas
- `GET /api/pinned` - Entradas fijadas
- `GET /api/posts/:id` - Entrada específica
- `POST /api/posts` - Crear entrada (requiere Basic Auth)

## Autenticación

- **Usuario**: cualquiera
- **Password**: `[REDACTED]`
- Protege `/admin/new` y `POST /api/posts`

## Base de Datos

SQLite en `./data/blog.sqlite3` (se crea automáticamente)

## Características

- ✅ **Minimalista**: Diseño blanco y negro, tipografía serif
- ✅ **Responsive**: Funciona perfecto en móvil y desktop
- ✅ **Scroll infinito**: Carga automática de más entradas
- ✅ **Posts fijados**: Lista horizontal en la cabecera
- ✅ **Autenticación básica**: Protección de rutas admin
- ✅ **Sangría en párrafos**: Estilo literario clásico
- ✅ **Fechas en español**: Formato "septiembre de 2025"
