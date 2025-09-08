import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear directorio data
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✓ Created data directory');
} else {
  console.log('✓ Data directory already exists');
}

// Inicializar base de datos
const dbPath = path.join(dataDir, 'blog.sqlite3');
const db = new Database.Database(dbPath);

console.log('Initializing database...');
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_is_pinned ON posts(is_pinned)`, () => {
    console.log('✓ Database initialized');
    db.close();
    
    // Instalar dependencias del cliente
    import('child_process').then(({ execSync }) => {
      console.log('Installing client dependencies...');
      try {
        execSync('cd client && npm install', { stdio: 'inherit' });
        console.log('✓ Client dependencies installed');
        console.log('✓ Setup completed successfully!');
      } catch (error) {
        console.error('Error installing client dependencies:', error.message);
      }
    });
  });
});
