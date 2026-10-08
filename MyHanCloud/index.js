const express = require('express');
const multer = require('multer');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3000;

// Folder upload
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Database SQLite
const db = new Database('cloud_storage.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Konfigurasi Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API 1: Upload File
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Mana filenya?' });

  const { filename, originalname, mimetype, size } = req.file;
  const stmt = db.prepare('INSERT INTO files (filename, original_name, mime_type, size) VALUES (?, ?, ?, ?)');
  stmt.run(filename, originalname, mimetype, size);

  res.json({ success: true, message: 'File berhasil di-upload!' });
});

// API 2: Ambil Daftar File
app.get('/api/files', (req, res) => {
  const files = db.prepare('SELECT * FROM files ORDER BY created_at DESC').all();
  res.json(files);
});

// API 3: Download File
app.get('/api/download/:id', (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!file) return res.status(404).send('File gak ketemu!');

  const filePath = path.join(uploadDir, file.filename);
  res.download(filePath, file.original_name);
});

// Cek IP LAN Otomatis
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Nyala!`);
  console.log(`Akses PC ini   : http://localhost:${PORT}`);
  console.log(`Akses PC Temen : http://${getLocalIP()}:${PORT}`);
});