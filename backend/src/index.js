const express = require('express');
const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const multer = require('multer');
const app = express();

// Koneksi ke RDS
const pool = mysql.createPool({
  host: process.env.DB_HOST,    // endpoint RDS
  user: process.env.DB_USER,    // admin
  password: process.env.DB_PASS,
  database: process.env.DB_NAME, // appdb
});

// S3 client
const s3 = new AWS.S3({ region: 'ap-southeast-1' });

// Upload ke S3
app.post('/api/upload', multer({ storage: multer.memoryStorage() }).single('file'), async (req, res) => {
  const params = { Bucket: process.env.S3_BUCKET, Key: req.file.originalname, Body: req.file.buffer };
  const result = await s3.upload(params).promise();
  res.json({ url: result.Location });
});

app.listen(3000, () => console.log('Server running on port 3000'));
