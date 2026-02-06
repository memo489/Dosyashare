// DOM Elementleri
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const fileInfo = document.getElementById('fileInfo');
const filesList = document.getElementById('filesList');
const sendButton = document.getElementById('sendButton');
const receiverEmail = document.getElementById('receiverEmail');
const senderEmail = document.getElementById('senderEmail');
const message = document.getElementById('message');
const passwordInput = document.getElementById('password');
const downloadSection = document.getElementById('downloadSection');
const downloadLink = document.getElementById('downloadLink');
const copyButton = document.getElementById('copyButton');
const linkCode = document.getElementById('linkCode');
const downloadCount = document.getElementById('downloadCount');
const newTransferButton = document.getElementById('newTransferButton');
const toast = document.getElementById('toast');
const passwordToggle = document.getElementById('passwordToggle');
const passwordSection = document.getElementById('passwordSection');

// Global Değişkenler
let selectedFiles = [];
let uploadProgress = 0;
let uploadInterval = null;
let currentTransferId = null;
let currentTransferData = null;

// Socket.io bağlantısı
const socket = io();

// Dosya Seçimi ve Sürükle-Bırak
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

// Sürükle-Bırak Fonksiyonları
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

// Dosyaları İşleme
function handleFiles(files) {
    const newFiles = Array.from(files);
    
    // Dosya sayısı kontrolü
    if (selectedFiles.length + newFiles.length > 10) {
        showToast('Maksimum 10 dosya yükleyebilirsiniz', 'error');
        return;
    }
    
    // Dosya boyutu kontrolü (max 2GB)
    const oversizedFiles = newFiles.filter(file => file.size > 2 * 1024 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
        showToast('2GB\'dan büyük dosya yükleyemezsiniz', 'error');
        return;
    }
    
    // Desteklenen dosya türleri
    const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain', 'application/zip', 'application/x-rar-compressed',
        'video/mp4', 'video/mpeg', 'audio/mpeg', 'audio/wav',
        'application/x-7z-compressed'
    ];
    
    const unsupportedFiles = newFiles.filter(file => !allowedTypes.includes(file.type));
    if (unsupportedFiles.length > 0) {
        showToast('Desteklenmeyen dosya türü', 'error');
        return;
    }
    
    selectedFiles = [...selectedFiles, ...newFiles];
    updateFilesList();
    
    // Dosyalar seçildiğinde otomatik olarak progress bölümünü göster
    if (selectedFiles.length > 0) {
        uploadArea.classList.add('hidden');
        progressSection.classList.remove('hidden');
        
        // Gerçek yükleme simülasyonu başlat
        simulateUploadProgress();
    }
}

// Dosya Listesini Güncelle
function updateFilesList() {
    filesList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileSize = formatFileSize(file.size);
        const fileType = getFileType(file.name);
        
        fileItem.innerHTML = `
            <div class="file-info-left">
                <div class="file-icon">
                    <i class="fas ${getFileIcon(fileType)}"></i>
                </div>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${fileSize} • ${fileType.toUpperCase()}</p>
                </div>
            </div>
            <button class="file-remove" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        filesList.appendChild(fileItem);
    });
    
    // Dosya silme işlevselliği
    document.querySelectorAll('.file-remove').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            selectedFiles.splice(index, 1);
            updateFilesList();
            
            if (selectedFiles.length === 0) {
                progressSection.classList.add('hidden');
                uploadArea.classList.remove('hidden');
                clearInterval(uploadInterval);
            }
        });
    });
}

// Gerçek Dosya Yükleme
async function uploadFiles() {
    if (selectedFiles.length === 0) {
        showToast('Lütfen en az bir dosya seçin', 'error');
        return false;
    }
    
    const email = receiverEmail.value;
    if (email && !validateEmail(email)) {
        showToast('Lütfen geçerli bir alıcı e-posta adresi girin', 'error');
        receiverEmail.focus();
        return false;
    }
    
    const sender = senderEmail.value;
    if (sender && !validateEmail(sender)) {
        showToast('Lütfen geçerli bir gönderici e-posta adresi girin', 'error');
        senderEmail.focus();
        return false;
    }
    
    // FormData oluştur
    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    formData.append('senderEmail', sender);
    formData.append('receiverEmail', email);
    formData.append('message', message.value);
    formData.append('password', passwordInput.value);
    formData.append('transferId', currentTransferId || generateTransferId());
    
    try {
        // Yükleme isteği gönder
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentTransferData = result;
            return true;
        } else {
            showToast(result.error || 'Yükleme başarısız', 'error');
            return false;
        }
    } catch (error) {
        console.error('Yükleme hatası:', error);
        showToast('Sunucu hatası oluştu', 'error');
        return false;
    }
}

// Gerçek Yükleme Simülasyonu
function simulateUploadProgress() {
    clearInterval(uploadInterval);
    
    uploadProgress = 0;
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    
    // Toplam dosya boyutunu hesapla
    const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
    const formattedTotalSize = formatFileSize(totalSize);
    fileInfo.textContent = `${selectedFiles.length} dosya • ${formattedTotalSize} • Yükleniyor...`;
    
    uploadInterval = setInterval(() => {
        uploadProgress += Math.random() * 10;
        
        if (uploadProgress >= 100) {
            uploadProgress = 100;
            clearInterval(uploadInterval);
            
            // Yükleme tamamlandığında
            fileInfo.textContent = `${selectedFiles.length} dosya • ${formattedTotalSize} • Hazır`;
            
            // "Gönder" butonunu etkinleştir
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Transfer Başlat';
            
            // Socket ile ilerleme güncellemesi gönder
            socket.emit('upload-progress', {
                transferId: currentTransferId,
                progress: 100
            });
        } else {
            // Socket ile ilerleme güncellemesi gönder
            socket.emit('upload-progress', {
                transferId: currentTransferId,
                progress: uploadProgress
            });
        }
        
        progressBar.style.width = `${uploadProgress}%`;
        progressText.textContent = `${Math.round(uploadProgress)}%`;
    }, 200);
}

// Gönder Butonu İşlevselliği
sendButton.addEventListener('click', async () => {
    // Butonu devre dışı bırak
    sendButton.disabled = true;
    sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';
    
    // Gerçek dosya yükleme
    const uploadSuccess = await uploadFiles();
    
    if (uploadSuccess && currentTransferData) {
        // Başarılı ise indirme bölümünü göster
        completeTransfer();
    } else {
        // Başarısız ise butonu sıfırla
        sendButton.disabled = false;
        sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Transfer Başlat';
    }
});

// Transfer Tamamlama
function completeTransfer() {
    const transferLink = `${window.location.origin}/download/${currentTransferData.shortId}`;
    
    // Download bölümünü göster
    progressSection.classList.add('hidden');
    document.querySelector('.email-form').classList.add('hidden');
    document.querySelector('.password-section').classList.add('hidden');
    downloadSection.classList.remove('hidden');
    
    // Link bilgilerini doldur
    downloadLink.value = transferLink;
    linkCode.textContent = currentTransferData.shortId;
    
    // Dosya listesini göster
    const filesList = document.getElementById('downloadFilesList');
    if (filesList) {
        filesList.innerHTML = currentTransferData.files.map(file => `
            <div class="file-item">
                <i class="fas ${getFileIcon(getFileType(file.name))}"></i>
                <span>${file.name} (${file.formattedSize})</span>
            </div>
        `).join('');
    }
    
    // Süre bilgisini göster
    const expiresAt = new Date(currentTransferData.expiresAt);
    const daysLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
    document.getElementById('expiryInfo').textContent = `${daysLeft} gün`;
    
    // Başarı mesajı göster
    showToast('Dosyalarınız başarıyla gönderildi!', 'success');
}

// Link Kopyalama
copyButton.addEventListener('click', () => {
    downloadLink.select();
    downloadLink.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(downloadLink.value)
        .then(() => {
            const originalText = copyButton.innerHTML;
            copyButton.innerHTML = '<i class="fas fa-check"></i> Kopyalandı!';
            copyButton.classList.add('btn-primary');
            copyButton.classList.remove('btn-secondary');
            
            showToast('Bağlantı panoya kopyalandı!', 'success');
            
            setTimeout(() => {
                copyButton.innerHTML = '<i class="fas fa-copy"></i> Kopyala';
                copyButton.classList.remove('btn-primary');
                copyButton.classList.add('btn-secondary');
            }, 2000);
        })
        .catch(err => {
            console.error('Kopyalama hatası:', err);
            showToast('Kopyalama başarısız', 'error');
        });
});

// Transferi Sıfırlama
function resetTransfer() {
    // Tüm alanları sıfırla
    selectedFiles = [];
    uploadProgress = 0;
    clearInterval(uploadInterval);
    currentTransferId = null;
    currentTransferData = null;
    
    // UI'ı sıfırla
    uploadArea.classList.remove('hidden');
    progressSection.classList.add('hidden');
    downloadSection.classList.add('hidden');
    document.querySelector('.email-form').classList.remove('hidden');
    document.querySelector('.password-section').classList.remove('hidden');
    filesList.innerHTML = '';
    
    // Form alanlarını temizle
    receiverEmail.value = '';
    senderEmail.value = '';
    message.value = '';
    passwordInput.value = '';
    fileInput.value = '';
    
    // Gönder butonunu sıfırla
    sendButton.disabled = false;
    sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Transfer Başlat';
    
    // Progress bar'ı sıfırla
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    
    showToast('Yeni transfer hazır!', 'info');
}

// Parola görünürlüğü
if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        passwordToggle.innerHTML = type === 'password' ? 
            '<i class="fas fa-eye"></i>' : 
            '<i class="fas fa-eye-slash"></i>';
    });
}

// Yardımcı Fonksiyonlar
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Byte';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const fileTypes = {
        'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image',
        'pdf': 'pdf',
        'doc': 'document', 'docx': 'document',
        'txt': 'text',
        'zip': 'archive', 'rar': 'archive', '7z': 'archive',
        'mp4': 'video', 'mpeg': 'video', 'avi': 'video', 'mov': 'video',
        'mp3': 'audio', 'wav': 'audio',
        'file': 'file'
    };
    
    return fileTypes[extension] || 'file';
}

function getFileIcon(fileType) {
    const icons = {
        'image': 'fa-file-image',
        'pdf': 'fa-file-pdf',
        'document': 'fa-file-word',
        'text': 'fa-file-alt',
        'archive': 'fa-file-archive',
        'video': 'fa-file-video',
        'audio': 'fa-file-audio',
        'file': 'fa-file'
    };
    
    return icons[fileType] || 'fa-file';
}

function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function generateTransferId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    currentTransferId = result;
    return result;
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    
    // Türüne göre renk değiştir
    if (type === 'success') {
        toast.style.backgroundColor = '#2ecc71';
    } else if (type === 'error') {
        toast.style.backgroundColor = '#e74c3c';
    } else if (type === 'warning') {
        toast.style.backgroundColor = '#f39c12';
    } else {
        toast.style.backgroundColor = '#3498db';
    }
    
    toast.classList.add('show');
    
    // 4 saniye sonra gizle
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    // Yeni transfer butonu
    if (newTransferButton) {
        newTransferButton.addEventListener('click', resetTransfer);
    }
    
    // Sistem durumunu kontrol et
    checkSystemStatus();
    
    // Hoş geldin mesajı
    setTimeout(() => {
        showToast('FastTransfer\'e hoş geldiniz! Dosyalarınızı sürükleyip bırakarak başlayın.', 'info');
    }, 1000);
});

// Sistem durumunu kontrol et
async function checkSystemStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.status === 'online') {
            console.log('Sistem çalışıyor:', data);
        }
    } catch (error) {
        console.error('Sistem durumu kontrol hatası:', error);
    }
}
