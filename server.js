const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const unzipper = require('unzipper');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const http = require('http');
const socketIo = require('socket.io');

const config = require('./config');

// Express uygulamasını oluştur
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Veritabanı bağlantısı
const db = new sqlite3.Database(config.database.path);

// Veritabanını başlat
initDatabase();

// Uploads klasörünü oluştur
fs.ensureDirSync(config.files.uploadDir);

// Middleware'ler
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max
});
app.use('/api/', limiter);

// Multer dosya yükleme konfigürasyonu
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const transferId = req.body.transferId || uuidv4();
    const transferDir = path.join(config.files.uploadDir, transferId);
    fs.ensureDirSync(transferDir);
    cb(null, transferDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: config.files.maxSize,
    files: config.files.maxFiles
  },
  fileFilter: function (req, file, cb) {
    if (config.files.allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Desteklenmeyen dosya türü'), false);
    }
  }
});

// Socket.io bağlantıları
io.on('connection', (socket) => {
  console.log('Yeni kullanıcı bağlandı');
  
  socket.on('upload-progress', (data) => {
    socket.broadcast.emit('progress-update', data);
  });
  
  socket.on('disconnect', () => {
    console.log('Kullanıcı ayrıldı');
  });
});

// Veritabanı başlatma fonksiyonu
function initDatabase() {
  db.serialize(() => {
    // Transfers tablosu
    db.run(`CREATE TABLE IF NOT EXISTS ${config.database.transfersTable} (
      id TEXT PRIMARY KEY,
      sender_email TEXT,
      receiver_email TEXT,
      message TEXT,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      download_count INTEGER DEFAULT 0,
      total_size INTEGER,
      file_count INTEGER,
      is_encrypted BOOLEAN DEFAULT 0
    )`);
    
    // Files tablosu
    db.run(`CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      transfer_id TEXT,
      original_name TEXT,
      saved_name TEXT,
      size INTEGER,
      mime_type TEXT,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transfer_id) REFERENCES ${config.database.transfersTable}(id) ON DELETE CASCADE
    )`);
    
    // Users tablosu (gelecekte kullanılabilir)
    db.run(`CREATE TABLE IF NOT EXISTS ${config.database.usersTable} (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      storage_used INTEGER DEFAULT 0,
      storage_limit INTEGER DEFAULT 2147483648
    )`);
    
    console.log('Veritabanı başlatıldı');
  });
}

// Yardımcı fonksiyonlar
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateShortId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// E-posta gönderme fonksiyonu
async function sendEmail(to, subject, html) {
  if (!config.email.enabled) return;
  
  try {
    const transporter = nodemailer.createTransport({
      service: config.email.service,
      auth: config.email.auth
    });
    
    const mailOptions = {
      from: config.email.from,
      to: to,
      subject: subject,
      html: html
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`E-posta gönderildi: ${to}`);
  } catch (error) {
    console.error('E-posta gönderme hatası:', error);
  }
}

// API Rotaları

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dosya yükleme endpoint'i
app.post('/api/upload', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Lütfen dosya seçin' 
      });
    }
    
    const transferId = req.body.transferId || uuidv4();
    const shortId = generateShortId(8);
    const senderEmail = req.body.senderEmail || '';
    const receiverEmail = req.body.receiverEmail || '';
    const message = req.body.message || '';
    const password = req.body.password || '';
    
    // Dosya bilgilerini topla
    const files = req.files.map(file => ({
      id: uuidv4(),
      originalName: file.originalname,
      savedName: file.filename,
      size: file.size,
      mimeType: file.mimetype,
      path: file.path
    }));
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    // Veritabanına transferi kaydet
    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT INTO ${config.database.transfersTable} 
        (id, sender_email, receiver_email, message, password, expires_at, total_size, file_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        transferId,
        senderEmail,
        receiverEmail,
        message,
        '',
        expiresAt.toISOString(),
        totalSize,
        files.length
      );
      stmt.finalize();
      
      // Dosyaları kaydet
      const fileStmt = db.prepare(`
        INSERT INTO files (id, transfer_id, original_name, saved_name, size, mime_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      files.forEach(file => {
        fileStmt.run(
          file.id,
          transferId,
          file.originalName,
          file.savedName,
          file.size,
          file.mimeType
        );
      });
      fileStmt.finalize();
    });
    
    // E-posta gönder (eğer alıcı e-postası belirtilmişse)
    if (receiverEmail && config.email.enabled) {
      const downloadLink = `${config.server.protocol}://${req.headers.host}/download/${shortId}`;
      const emailHtml = `
        <h2>FastTransfer - Yeni Dosya Transferi</h2>
        <p>${senderEmail || 'Bir gönderici'} size dosya gönderdi.</p>
        <p><strong>Mesaj:</strong> ${message || 'Mesaj yok'}</p>
        <p><strong>Dosya Sayısı:</strong> ${files.length}</p>
        <p><strong>Toplam Boyut:</strong> ${formatFileSize(totalSize)}</p>
        <p>Dosyalarınızı indirmek için <a href="${downloadLink}">buraya tıklayın</a></p>
        <p>Link: ${downloadLink}</p>
        <p><em>Bu link 7 gün boyunca geçerlidir.</em></p>
      `;
      
      await sendEmail(receiverEmail, 'FastTransfer - Yeni Dosya Transferi', emailHtml);
    }
    
    // Başarılı yanıt
    res.json({
      success: true,
      transferId: transferId,
      shortId: shortId,
      downloadLink: `/download/${shortId}`,
      files: files.map(f => ({
        name: f.originalName,
        size: f.size,
        formattedSize: formatFileSize(f.size),
        type: f.mimeType
      })),
      totalSize: totalSize,
      formattedTotalSize: formatFileSize(totalSize),
      expiresAt: expiresAt
    });
    
  } catch (error) {
    console.error('Dosya yükleme hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Dosya yüklenirken bir hata oluştu',
      details: error.message 
    });
  }
});

// İndirme sayfası
app.get('/download/:shortId', (req, res) => {
  const shortId = req.params.shortId;
  
  // Burada shortId'yi transferId'ye çevirmek için bir mapping yapılabilir
  // Basit örnek için aynı kullanıyoruz
  const transferId = shortId;
  
  db.get(`
    SELECT * FROM ${config.database.transfersTable} 
    WHERE id = ? AND expires_at > datetime('now')
  `, [transferId], (err, transfer) => {
    if (err || !transfer) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>FastTransfer - Link Geçersiz</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #e74c3c; font-size: 48px; margin-bottom: 20px; }
            .message { font-size: 18px; margin-bottom: 30px; }
            .btn { display: inline-block; padding: 12px 30px; background: #3498db; 
                   color: white; text-decoration: none; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="error">⚠️</div>
          <h1>Link Geçersiz</h1>
          <p class="message">Bu linkin süresi dolmuş veya geçersiz.</p>
          <a href="/" class="btn">Ana Sayfaya Dön</a>
        </body>
        </html>
      `);
    }
    
    // Dosya bilgilerini al
    db.all('SELECT * FROM files WHERE transfer_id = ?', [transferId], (err, files) => {
      if (err) {
        return res.status(500).send('Sunucu hatası');
      }
      
      // İndirme sayfasını göster
      res.send(`
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>FastTransfer - İndirme</title>
          <link rel="stylesheet" href="/style.css">
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        </head>
        <body>
          <div class="container">
            <header class="header">
              <div class="logo">
                <i class="fas fa-bolt"></i>
                <span>FastTransfer</span>
              </div>
            </header>
            
            <main class="main-content">
              <div class="download-container">
                <div class="download-card">
                  <i class="fas fa-download download-icon"></i>
                  <h1>Dosyalarınız Hazır</h1>
                  <p class="download-info">
                    ${transfer.sender_email ? transfer.sender_email + ' tarafından ' : 'Bir gönderici tarafından '}
                    gönderilen ${files.length} dosya
                  </p>
                  
                  ${transfer.message ? `<div class="message-box"><p>${transfer.message}</p></div>` : ''}
                  
                  <div class="files-list">
                    ${files.map(file => `
                      <div class="file-item">
                        <i class="fas ${file.mime_type.startsWith('image') ? 'fa-file-image' : 
                                       file.mime_type === 'application/pdf' ? 'fa-file-pdf' : 
                                       file.mime_type.startsWith('video') ? 'fa-file-video' :
                                       'fa-file'}"></i>
                        <div class="file-details">
                          <h4>${file.original_name}</h4>
                          <p>${formatFileSize(file.size)}</p>
                        </div>
                        <a href="/api/download/${transferId}/${file.id}" class="btn btn-primary">
                          <i class="fas fa-download"></i> İndir
                        </a>
                      </div>
                    `).join('')}
                  </div>
                  
                  ${files.length > 1 ? `
                    <a href="/api/download-all/${transferId}" class="btn btn-large btn-block">
                      <i class="fas fa-file-archive"></i> Tümünü İndir (ZIP)
                    </a>
                  ` : ''}
                  
                  <div class="download-stats">
                    <div class="stat">
                      <i class="fas fa-hdd"></i>
                      <span>Toplam: <strong>${formatFileSize(transfer.total_size)}</strong></span>
                    </div>
                    <div class="stat">
                      <i class="fas fa-download"></i>
                      <span>İndirilme: <strong>${transfer.download_count}</strong></span>
                    </div>
                    <div class="stat">
                      <i class="fas fa-clock"></i>
                      <span>Kalan Süre: <strong>${Math.ceil((new Date(transfer.expires_at) - new Date()) / (1000 * 60 * 60 * 24))} gün</strong></span>
                    </div>
                  </div>
                  
                  <a href="/" class="btn btn-outline">
                    <i class="fas fa-upload"></i> Kendin Dosya Gönder
                  </a>
                </div>
              </div>
            </main>
            
            <footer class="footer">
              <p>&copy; 2023 FastTransfer. Tüm hakları saklıdır.</p>
            </footer>
          </div>
          
          <script>
            // İndirme sayısını güncelle
            fetch('/api/record-download/${transferId}', { method: 'POST' });
          </script>
        </body>
        </html>
      `);
    });
  });
});

// Tek dosya indirme
app.get('/api/download/:transferId/:fileId', (req, res) => {
  const { transferId, fileId } = req.params;
  
  // Transferin geçerli olup olmadığını kontrol et
  db.get(`SELECT * FROM ${config.database.transfersTable} WHERE id = ?`, [transferId], (err, transfer) => {
    if (err || !transfer) {
      return res.status(404).send('Dosya bulunamadı');
    }
    
    // Dosya bilgisini al
    db.get('SELECT * FROM files WHERE id = ? AND transfer_id = ?', [fileId, transferId], (err, file) => {
      if (err || !file) {
        return res.status(404).send('Dosya bulunamadı');
      }
      
      const filePath = path.join(config.files.uploadDir, transferId, file.saved_name);
      
      // Dosya varsa indir
      if (fs.existsSync(filePath)) {
        // İndirme sayısını güncelle
        db.run(`UPDATE ${config.database.transfersTable} SET download_count = download_count + 1 WHERE id = ?`, [transferId]);
        
        res.download(filePath, file.original_name);
      } else {
        res.status(404).send('Dosya bulunamadı');
      }
    });
  });
});

// Tüm dosyaları ZIP olarak indirme
app.get('/api/download-all/:transferId', (req, res) => {
  const transferId = req.params.transferId;
  
  db.get(`SELECT * FROM ${config.database.transfersTable} WHERE id = ?`, [transferId], (err, transfer) => {
    if (err || !transfer) {
      return res.status(404).send('Transfer bulunamadı');
    }
    
    db.all('SELECT * FROM files WHERE transfer_id = ?', [transferId], (err, files) => {
      if (err || files.length === 0) {
        return res.status(404).send('Dosya bulunamadı');
      }
      
      const transferDir = path.join(config.files.uploadDir, transferId);
      const zipFileName = `transfer-${transferId}.zip`;
      
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`
      });
      
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      
      files.forEach(file => {
        const filePath = path.join(transferDir, file.saved_name);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file.original_name });
        }
      });
      
      // İndirme sayısını güncelle
      db.run(`UPDATE ${config.database.transfersTable} SET download_count = download_count + 1 WHERE id = ?`, [transferId]);
      
      archive.finalize();
    });
  });
});

// İndirme sayısını kaydetme
app.post('/api/record-download/:transferId', (req, res) => {
  const transferId = req.params.transferId;
  
  db.run(`UPDATE ${config.database.transfersTable} SET download_count = download_count + 1 WHERE id = ?`, [transferId], (err) => {
    if (err) {
      console.error('İndirme kaydı hatası:', err);
    }
  });
  
  res.json({ success: true });
});

// Dosya bilgisi alma
app.get('/api/transfer/:transferId', (req, res) => {
  const transferId = req.params.transferId;
  
  db.get(`SELECT * FROM ${config.database.transfersTable} WHERE id = ?`, [transferId], (err, transfer) => {
    if (err || !transfer) {
      return res.status(404).json({ error: 'Transfer bulunamadı' });
    }
    
    db.all('SELECT * FROM files WHERE transfer_id = ?', [transferId], (err, files) => {
      if (err) {
        return res.status(500).json({ error: 'Sunucu hatası' });
      }
      
      res.json({
        transfer: transfer,
        files: files,
        expiresIn: Math.ceil((new Date(transfer.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
      });
    });
  });
});

// Sistem durumu
app.get('/api/status', (req, res) => {
  db.get(`SELECT COUNT(*) as total_transfers FROM ${config.database.transfersTable}`, (err, result1) => {
    db.get('SELECT COUNT(*) as total_files FROM files', (err, result2) => {
      db.get(`SELECT SUM(total_size) as total_size FROM ${config.database.transfersTable}`, (err, result3) => {
        res.json({
          status: 'online',
          totalTransfers: result1.total_transfers,
          totalFiles: result2.total_files,
          totalSize: result3.total_size || 0,
          formattedTotalSize: formatFileSize(result3.total_size || 0),
          uptime: process.uptime()
        });
      });
    });
  });
});

// Hata yönetimi middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        error: 'Dosya boyutu 2GB limitini aşıyor' 
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        success: false, 
        error: 'Maksimum 10 dosya yükleyebilirsiniz' 
      });
    }
  }
  
  console.error('Hata:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Sunucu hatası oluştu',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Sayfa bulunamadı' 
  });
});

// Sunucuyu başlat
const PORT = config.server.port;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║                 FASTTRANSFER v2.0                   ║
  ╠══════════════════════════════════════════════════════╣
  ║  Sunucu başlatıldı: ${config.server.protocol}://${config.server.host}:${PORT}  ║
  ║  Upload dizini: ${config.files.uploadDir}         ║
  ║  Max dosya boyutu: ${formatFileSize(config.files.maxSize)}           ║
  ╚══════════════════════════════════════════════════════╝
  `);
});

// Süre dolmuş transferleri temizleme
if (config.cleanup.enabled) {
  setInterval(() => {
    const cutoff = new Date(Date.now() - config.cleanup.maxAge);
    
    db.all(`SELECT id FROM ${config.database.transfersTable} WHERE expires_at < ?`, [cutoff.toISOString()], (err, transfers) => {
      if (err) return;
      
      transfers.forEach(transfer => {
        const transferDir = path.join(config.files.uploadDir, transfer.id);
        
        // Dosyaları sil
        if (fs.existsSync(transferDir)) {
          fs.removeSync(transferDir);
        }
        
        // Veritabanından sil
        db.run(`DELETE FROM ${config.database.transfersTable} WHERE id = ?`, [transfer.id]);
        db.run('DELETE FROM files WHERE transfer_id = ?', [transfer.id]);
      });
      
      if (transfers.length > 0) {
        console.log(`${transfers.length} süresi dolmuş transfer temizlendi`);
      }
    });
  }, config.cleanup.interval);
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM sinyali alındı. Sunucu kapatılıyor...');
  server.close(() => {
    console.log('Sunucu kapatıldı');
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT sinyali alındı. Sunucu kapatılıyor...');
  server.close(() => {
    console.log('Sunucu kapatıldı');
    db.close();
    process.exit(0);
  });
});

module.exports = app;
