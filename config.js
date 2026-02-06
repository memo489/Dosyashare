// Uygulama yapılandırma dosyası
module.exports = {
  // Sunucu ayarları
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    protocol: process.env.PROTOCOL || 'http'
  },
  
  // Dosya ayarları
  files: {
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    uploadDir: 'public/uploads',
    allowedTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/zip',
      'application/x-rar-compressed',
      'video/mp4',
      'video/mpeg',
      'audio/mpeg',
      'audio/wav',
      'application/x-7z-compressed'
    ],
    maxFiles: 10
  },
  
  // Güvenlik ayarları
  security: {
    jwtSecret: process.env.JWT_SECRET || 'fasttransfer-secret-key-change-in-production',
    tokenExpiry: '7d',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 dakika
      max: 100 // Her IP için 100 istek
    }
  },
  
  // Veritabanı ayarları
  database: {
    path: 'fasttransfer.db',
    transfersTable: 'transfers',
    usersTable: 'users'
  },
  
  // E-posta ayarları (isteğe bağlı)
  email: {
    enabled: false, // E-posta bildirimlerini açmak için true yapın
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || ''
    },
    from: 'noreply@fasttransfer.com'
  },
  
  // Temizleme ayarları
  cleanup: {
    enabled: true,
    interval: 24 * 60 * 60 * 1000, // 24 saatte bir
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 gün
  }
};
