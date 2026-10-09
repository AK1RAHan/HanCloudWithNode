const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// 1. Rute spesifik buat manggil index.html utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'myHTML.html'));
});

// 2. Rute spesifik buat manggil upload.html terpisah (tanpa tombol di index)
app.get('/halaman-upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'upload.html'));
});

app.listen(PORT, () => {
  console.log(`Server jalan di http://localhost:${PORT}`);
});