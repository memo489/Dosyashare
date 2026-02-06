const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;

// Uploads klasörü
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer ayarı
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const transferId = uuidv4();
    const transferDir = path.join(uploadsDir, transferId);
    fs.mkdirSync(transferDir, { recursive: true });
    req.transferId = transferId;
    cb(null, transferDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Middleware'ler
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: Dosya yükleme (Basitleştirilmiş)
app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    const transferId = req.transferId;
    const files = req.files.map(file => ({
      name: file.originalname,
      size: file.size,
      type: file.mimetype
    }));
    
    res.json({
      success: true,
      message: 'Dosyalar yüklendi (Demo Mod)',
      transferId: transferId,
      files: files,
      downloadLink: `/download/${transferId}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Dosya listesi
app.get('/api/files/:id', (req, res) => {
  const transferId = req.params.id;
  const transferDir = path.join(uploadsDir, transferId);
  
  if (!fs.existsSync(transferDir)) {
    return res.status(404).json({ error: 'Dosya bulunamadı' });
  }
  
  const files = fs.readdirSync(transferDir).map(filename => {
    const filePath = path.join(transferDir, filename);
    const stats = fs.statSync(filePath);
    return {
      name: filename,
      size: stats.size,
      url: `/api/download/${transferId}/${filename}`
    };
  });
  
  res.json({ files: files });
});

// API: Dosya indirme
app.get('/api/download/:id/:filename', (req, res) => {
  const { id, filename } = req.params;
  const filePath = path.join(uploadsDir, id, filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('Dosya bulunamadı');
  }
});

// Ana sayfa
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sunucuyu başlat
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ DOSYASHARE çalışıyor: http://0.0.0.0:${PORT}`);
  console.log(`📁 Uploads: ${uploadsDir}`);
});
