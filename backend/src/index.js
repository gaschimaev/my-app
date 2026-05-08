require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// AWS S3 SETUP
// ============================================
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'ap-southeast-1'
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak diizinkan. Hanya JPG, PNG, PDF.'));
    }
  }
});

// ============================================
// DATABASE CONNECTION POOL
// ============================================
let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASS || 'password',
      database: process.env.DB_NAME || 'appdb',
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 30000
    });
  }
  return pool;
}

// ============================================
// DATABASE INIT - Buat tabel jika belum ada
// ============================================
async function initDatabase() {
  try {
    const db = await getPool();
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS pengaduan (
        id VARCHAR(36) PRIMARY KEY,
        nama_pelapor VARCHAR(100) NOT NULL,
        nik VARCHAR(16) NOT NULL,
        nomor_hp VARCHAR(15) NOT NULL,
        kategori ENUM('infrastruktur', 'kebersihan', 'keamanan', 'administrasi', 'lainnya') NOT NULL,
        judul VARCHAR(200) NOT NULL,
        deskripsi TEXT NOT NULL,
        lokasi VARCHAR(200),
        foto_url VARCHAR(500),
        status ENUM('masuk', 'diproses', 'selesai') DEFAULT 'masuk',
        tanggal_lapor TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tanggal_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS warga (
        id VARCHAR(36) PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        nik VARCHAR(16) UNIQUE NOT NULL,
        alamat TEXT,
        nomor_hp VARCHAR(15),
        rt VARCHAR(5),
        rw VARCHAR(5),
        tanggal_daftar TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database berhasil diinisialisasi');
  } catch (err) {
    console.error('❌ Gagal inisialisasi database:', err.message);
  }
}

// ============================================
// ROUTES: HEALTH CHECK
// ============================================
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API LaporDesa berjalan ✅',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ============================================
// ROUTES: PENGADUAN
// ============================================

// GET semua pengaduan
app.get('/api/pengaduan', async (req, res) => {
  try {
    const db = await getPool();
    const { status, kategori } = req.query;
    
    let query = 'SELECT * FROM pengaduan WHERE 1=1';
    const params = [];
    
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (kategori) { query += ' AND kategori = ?'; params.push(kategori); }
    
    query += ' ORDER BY tanggal_lapor DESC';
    
    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET satu pengaduan by ID
app.get('/api/pengaduan/:id', async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute('SELECT * FROM pengaduan WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengaduan tidak ditemukan' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST buat pengaduan baru (dengan upload foto optional)
app.post('/api/pengaduan', upload.single('foto'), async (req, res) => {
  try {
    const { nama_pelapor, nik, nomor_hp, kategori, judul, deskripsi, lokasi } = req.body;
    
    // Validasi
    if (!nama_pelapor || !nik || !nomor_hp || !kategori || !judul || !deskripsi) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }
    
    let foto_url = null;
    
    // Upload foto ke S3 jika ada
    if (req.file && process.env.S3_BUCKET) {
      const fileKey = `pengaduan/${uuidv4()}-${req.file.originalname}`;
      const params = {
        Bucket: process.env.S3_BUCKET,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      };
      
      const result = await s3.upload(params).promise();
      
      // Gunakan CloudFront URL jika tersedia
      if (process.env.CLOUDFRONT_URL) {
        foto_url = `${process.env.CLOUDFRONT_URL}/${fileKey}`;
      } else {
        foto_url = result.Location;
      }
    }
    
    const id = uuidv4();
    const db = await getPool();
    
    await db.execute(
      `INSERT INTO pengaduan (id, nama_pelapor, nik, nomor_hp, kategori, judul, deskripsi, lokasi, foto_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nama_pelapor, nik, nomor_hp, kategori, judul, deskripsi, lokasi || null, foto_url]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Pengaduan berhasil dikirim', 
      data: { id, judul }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update status pengaduan
app.put('/api/pengaduan/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatus = ['masuk', 'diproses', 'selesai'];
    
    if (!validStatus.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status tidak valid' });
    }
    
    const db = await getPool();
    const [result] = await db.execute(
      'UPDATE pengaduan SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pengaduan tidak ditemukan' });
    }
    
    res.json({ success: true, message: 'Status berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE pengaduan
app.delete('/api/pengaduan/:id', async (req, res) => {
  try {
    const db = await getPool();
    const [result] = await db.execute('DELETE FROM pengaduan WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pengaduan tidak ditemukan' });
    }
    
    res.json({ success: true, message: 'Pengaduan berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// ROUTES: STATISTIK
// ============================================
app.get('/api/statistik', async (req, res) => {
  try {
    const db = await getPool();
    const [total] = await db.execute('SELECT COUNT(*) as total FROM pengaduan');
    const [masuk] = await db.execute("SELECT COUNT(*) as total FROM pengaduan WHERE status = 'masuk'");
    const [diproses] = await db.execute("SELECT COUNT(*) as total FROM pengaduan WHERE status = 'diproses'");
    const [selesai] = await db.execute("SELECT COUNT(*) as total FROM pengaduan WHERE status = 'selesai'");
    const [byKategori] = await db.execute('SELECT kategori, COUNT(*) as jumlah FROM pengaduan GROUP BY kategori');
    
    res.json({
      success: true,
      data: {
        total: total[0].total,
        masuk: masuk[0].total,
        diproses: diproses[0].total,
        selesai: selesai[0].total,
        per_kategori: byKategori
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// ROUTES: DATA WARGA
// ============================================
app.get('/api/warga', async (req, res) => {
  try {
    const db = await getPool();
    const [rows] = await db.execute('SELECT * FROM warga ORDER BY tanggal_daftar DESC');
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/warga', async (req, res) => {
  try {
    const { nama, nik, alamat, nomor_hp, rt, rw } = req.body;
    if (!nama || !nik) {
      return res.status(400).json({ success: false, message: 'Nama dan NIK wajib diisi' });
    }
    
    const id = uuidv4();
    const db = await getPool();
    
    await db.execute(
      'INSERT INTO warga (id, nama, nik, alamat, nomor_hp, rt, rw) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, nama, nik, alamat || null, nomor_hp || null, rt || null, rw || null]
    );
    
    res.status(201).json({ success: true, message: 'Data warga berhasil disimpan', data: { id } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'NIK sudah terdaftar' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, async () => {
  console.log(`🚀 Server LaporDesa berjalan di port ${PORT}`);
  await initDatabase();
});