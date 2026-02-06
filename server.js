const archiver = require('archiver');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;

// Uploads klasörü - Render için özel yol
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Uploads klasörü oluşturuldu:', uploadsDir);
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
    const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(uploadsDir)); // İndirme için statik yol

// CORS izinleri
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Dosya yükleme API'si
app.post('/api/upload', upload.array('files', 10), (req, res) => {
  try {
    const transferId = req.transferId;
    const files = req.files.map(file => ({
      originalName: file.originalname,
      savedName: file.filename,
      size: file.size,
      type: file.mimetype,
      downloadUrl: `/api/download/${transferId}/${file.filename}`
    }));
    
    console.log('Dosya yüklendi:', transferId, files.length + ' dosya');
    
    res.json({
      success: true,
      message: `${files.length} dosya yüklendi`,
      transferId: transferId,
      files: files,
      downloadPage: `/download.html?id=${transferId}`,
      directDownload: files.length === 1 ? files[0].downloadUrl : null
    });
    
  } catch (error) {
    console.error('Yükleme hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Dosya yüklenemedi',
      details: error.message 
    });
  }
});

// Dosya indirme API'si
app.get('/api/download/:transferId/:filename', (req, res) => {
  const { transferId, filename } = req.params;
  const filePath = path.join(uploadsDir, transferId, filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, filename);
  } else {
    res.status(404).json({ error: 'Dosya bulunamadı' });
  }
});

// Dosya listesi API'si
app.get('/api/files/:transferId', (req, res) => {
  const transferId = req.params.transferId;
  const transferDir = path.join(uploadsDir, transferId);
  
  if (!fs.existsSync(transferDir)) {
    return res.status(404).json({ error: 'Transfer bulunamadı' });
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
  
  res.json({ 
    transferId: transferId,
    files: files,
    count: files.length
  });
});

// Basit indirme sayfası
app.get('/download.html', (req, res) => {
  const transferId = req.query.id;
  if (!transferId) {
    return res.send('<h1>Geçersiz link</h1><p>Transfer ID eksik.</p>');
  }
  
  const html = `
  <!DOCTYPE html>
  <html>
  <head><title>DOSYASHARE - İndirme</title>
    <style>body{font-family:Arial;padding:20px;max-width:600px;margin:auto;}
    .file{padding:10px;border:1px solid #ddd;margin:5px 0;display:flex;justify-content:space-between;}
    .btn{background:#3498db;color:white;padding:10px;border:none;border-radius:5px;cursor:pointer;}
    </style>
  </head>
  <body>
    <h1>📁 DOSYASHARE İndirme</h1>
    <p>Transfer ID: <strong>${transferId}</strong></p>
    <div id="files">Yükleniyor...</div>
    <script>
      fetch('/api/files/${transferId}')
        .then(r => r.json())
        .then(data => {
          const filesHtml = data.files.map(f => 
            '<div class="file"><span>' + f.name + ' (' + (f.size/1024/1024).toFixed(2) + ' MB)</span>' +
            '<a href="' + f.url + '" class="btn">İndir</a></div>'
          ).join('');
          document.getElementById('files').innerHTML = 
            '<h3>' + data.count + ' dosya</h3>' + filesHtml;
        })
        .catch(e => document.getElementById('files').innerHTML = 'Hata: ' + e);
    </script>
  </body>
  </html>`;
  
  res.send(html);
});
// ZIP İndirme Endpoint'i
app.get('/api/download-zip/:transferId', (req, res) => {
    const transferId = req.params.transferId;
    const transferDir = path.join(uploadsDir, transferId);
    
    if (!fs.existsSync(transferDir)) {
        return res.status(404).json({ error: 'Transfer bulunamadı' });
    }
    
    const files = fs.readdirSync(transferDir);
    if (files.length === 0) {
        return res.status(404).json({ error: 'Dosya bulunamadı' });
    }
    
    const zipFileName = `dosyashare-${transferId}.zip`;
    
    res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`
    });
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    
    files.forEach(filename => {
        const filePath = path.join(transferDir, filename);
        archive.file(filePath, { name: filename });
    });
    
    archive.finalize();
});
// Ana sayfa
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sunucu
app.listen(PORT, '0.0.0.0', () => {
  console.log('✅ DOSYASHARE çalışıyor: http://0.0.0.0:' + PORT);
  console.log('📁 Uploads klasörü:', uploadsDir);
  console.log('📤 Yükleme: POST /api/upload');
  console.log('📥 İndirme: GET /api/download/:id/:file');
});
