import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import Database from 'sqlite3';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.NODE_ENV !== 'production' ? 3124 : 3123;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '[REDACTED]';
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

// Crear directorio data si no existe
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inicializar base de datos
const dbPath = path.join(dataDir, 'blog.sqlite3');
const db = new Database.Database(dbPath);

// Crear tabla si no existe
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_is_pinned ON posts(is_pinned)`);
});

// Middleware de autenticación Basic Auth
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');
  
  if (password !== ADMIN_PASSWORD) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  next();
};

// API Routes
app.get('/api/posts', (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 50;
  
  db.all(
    'SELECT id, title, content, created_at, is_pinned FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

app.get('/api/pinned', (req, res) => {
  db.all(
    'SELECT id, title FROM posts WHERE is_pinned = 1 ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

app.get('/api/posts/:id', (req, res) => {
  const id = req.params.id;
  
  db.get(
    'SELECT id, title, content, created_at, is_pinned FROM posts WHERE id = ?',
    [id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Post not found' });
      }
      res.json(row);
    }
  );
});

app.post('/api/posts', requireAuth, (req, res) => {
  const { title, content, is_pinned } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  
  db.run(
    'INSERT INTO posts (title, content, is_pinned) VALUES (?, ?, ?)',
    [title, content, is_pinned ? 1 : 0],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.get(
        'SELECT id, title, content, created_at, is_pinned FROM posts WHERE id = ?',
        [this.lastID],
        (err, row) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.status(201).json(row);
        }
      );
    }
  );
});

app.put('/api/posts/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { title, content, is_pinned } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  
  db.run(
    'UPDATE posts SET title = ?, content = ?, is_pinned = ? WHERE id = ?',
    [title, content, is_pinned ? 1 : 0, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      db.get(
        'SELECT id, title, content, created_at, is_pinned FROM posts WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json(row);
        }
      );
    }
  );
});

app.delete('/api/posts/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  db.run(
    'DELETE FROM posts WHERE id = ?',
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      res.json({ message: 'Post deleted successfully', id: id });
    }
  );
});

// Servir archivos estáticos del build
const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

// Admin route protection
app.get('/admin/new', requireAuth, (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.get('/admin/edit/:id', requireAuth, (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Servir index.html para todas las rutas no API
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  }
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  const actualPort = server.address().port;
  console.log(`Server running on http://localhost:${actualPort}`);
  console.log(`Environment: ${IS_DEVELOPMENT ? 'development' : 'production'}`);
});
