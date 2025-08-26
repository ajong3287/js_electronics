// Vercel Serverless Function을 위한 API 진입점
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const database = require('../database');

const app = express();

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// 파일 업로드 설정
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 데이터베이스 초기화
database.init();

// 기본 API 라우트
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 매출 데이터 API
app.get('/api/js-electronics/data', async (req, res) => {
  try {
    const db = database.db;
    const data = db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100').all();
    res.json(data);
  } catch (error) {
    console.error('매출 데이터 조회 오류:', error);
    res.status(500).json({ error: '데이터 조회 실패' });
  }
});

// Excel 업로드 API
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }
    
    // 파일 처리 로직 (간단버전)
    res.json({ 
      message: '파일 업로드 성공',
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    res.status(500).json({ error: '파일 업로드 실패' });
  }
});

// Vercel Serverless Function Export
module.exports = app;