# PM2'yi global yükleyin
npm install -g pm2

# Uygulamayı başlatın
pm2 start server.js --name fasttransfer

# Sistem boot'ta otomatik başlatma
pm2 startup
pm2 save

# Logları izleyin
pm2 logs fasttransfer
