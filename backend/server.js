const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

let db;

function connectDatabase() {

  db = mysql.createConnection({
    host: process.env.DB_HOST || "database",
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASS || "Buagtft1!",
    database: process.env.DB_NAME || "appdb"
  });

  db.connect((err) => {

    if (err) {

      console.log("❌ Database belum siap, retry 5 detik...");
      console.log(err);

      setTimeout(connectDatabase, 5000);

    } else {

      console.log("✅ Database Connected");

      createTables();
    }
  });

  db.on("error", (err) => {

    console.log("❌ Database Error");
    console.log(err);

    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      connectDatabase();
    }

  });
}

function createTables() {

  const suratTable = `
    CREATE TABLE IF NOT EXISTS surat (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(255),
      jenis_surat VARCHAR(255),
      keterangan TEXT,
      status VARCHAR(100) DEFAULT 'Diproses'
    )
  `;

  const pengaduanTable = `
    CREATE TABLE IF NOT EXISTS pengaduan (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(255),
      laporan TEXT,
      status VARCHAR(100) DEFAULT 'Diproses'
    )
  `;

  db.query(suratTable, (err) => {

    if (err) {
      console.log(err);
    } else {
      console.log("✅ Table surat ready");
    }

  });

  db.query(pengaduanTable, (err) => {

    if (err) {
      console.log(err);
    } else {
      console.log("✅ Table pengaduan ready");
    }

  });
}

connectDatabase();

app.get("/", (req, res) => {
  res.send("Backend Running");
});

app.get("/api/status", (req, res) => {

  res.json({
    message: "API Running"
  });

});

app.post("/api/surat", (req, res) => {

  const { nama, jenis_surat, keterangan } = req.body;

  const sql = `
    INSERT INTO surat (nama, jenis_surat, keterangan)
    VALUES (?, ?, ?)
  `;

  db.query(
    sql,
    [nama, jenis_surat, keterangan],
    (err, result) => {

      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: "Pengajuan surat berhasil"
      });

    }
  );
});

app.get("/api/surat", (req, res) => {

  db.query(
    "SELECT * FROM surat",
    (err, result) => {

      if (err) {
        return res.status(500).json(err);
      }

      res.json(result);

    }
  );
});

app.post("/api/pengaduan", (req, res) => {

  const { nama, laporan } = req.body;

  const sql = `
    INSERT INTO pengaduan (nama, laporan)
    VALUES (?, ?)
  `;

  db.query(
    sql,
    [nama, laporan],
    (err, result) => {

      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: "Pengaduan berhasil"
      });

    }
  );
});

app.get("/api/pengaduan", (req, res) => {

  db.query(
    "SELECT * FROM pengaduan",
    (err, result) => {

      if (err) {
        return res.status(500).json(err);
      }

      res.json(result);

    }
  );
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});