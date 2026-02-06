const fs = require('fs-extra');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

const db = new sqlite3.Database(config.database.path);

console.log('Temizleme işlemi başlatılıyor...');

// Süresi dolmuş transferleri bul
const cutoff = new Date(Date.now() - config.cleanup.maxAge);

db.all(`SELECT id FROM ${config.database.transfersTable} WHERE expires_at < ?`, 
  [cutoff.toISOString()], (err, transfers) => {
    
  if (err) {
    console.error('Veritabanı hatası:', err);
    process.exit(1);
  }
  
  console.log(`${transfers.length} süresi dolmuş transfer bulundu`);
  
  let deletedCount = 0;
  
  transfers.forEach((transfer, index) => {
    const transferDir = path.join(config.files.uploadDir, transfer.id);
    
    // Dosyaları sil
    if (fs.existsSync(transferDir)) {
      try {
        fs.removeSync(transferDir);
        console.log(`${index + 1}. ${transfer.id} - Dosyalar silindi`);
      } catch (error) {
        console.error(`${index + 1}. ${transfer.id} - Dosya silme hatası:`, error.message);
      }
    }
    
    // Veritabanından sil
    db.serialize(() => {
      db.run('DELETE FROM files WHERE transfer_id = ?', [transfer.id], (err) => {
        if (err) console.error('Dosya kayıtları silinirken hata:', err.message);
      });
      
      db.run(`DELETE FROM ${config.database.transfersTable} WHERE id = ?`, [transfer.id], (err) => {
        if (err) {
          console.error('Transfer kaydı silinirken hata:', err.message);
        } else {
          deletedCount++;
          console.log(`${index + 1}. ${transfer.id} - Veritabanı kaydı silindi`);
        }
      });
    });
  });
  
  setTimeout(() => {
    console.log(`\nTemizleme tamamlandı: ${deletedCount} transfer silindi`);
    db.close();
    process.exit(0);
  }, 1000);
});
