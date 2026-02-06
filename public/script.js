// ====================
// DOSYASHARE - Ana JavaScript
// ====================

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
const downloadSection = document.getElementById('downloadSection');
const downloadLink = document.getElementById('downloadLink');
const copyButton = document.getElementById('copyButton');
const linkCode = document.getElementById('linkCode');
const downloadCount = document.getElementById('downloadCount');
const newTransferButton = document.getElementById('newTransferButton');
const toast = document.getElementById('toast');

// Global Değişkenler
let selectedFiles = [];
let currentTransferData = null;

// ====================
// DOSYA SEÇME ve SÜRÜKLE-BIRAK
// ====================

uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// Sürükle-Bırak
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

function handleFiles(files) {
    const newFiles = Array.from(files);
    
    // Boyut kontrolü (max 2GB)
    const maxSize = 2 * 1024 * 1024 * 1024;
    const oversized = newFiles.filter(f => f.size > maxSize);
    if (oversized.length > 0) {
        showToast('2GB\'dan büyük dosya yükleyemezsiniz', 'error');
        return;
    }
    
    selectedFiles = [...selectedFiles, ...newFiles];
    updateFilesList();
    showProgressSection();
}

// ====================
// DOSYA LİSTESİ
// ====================

function updateFilesList() {
    filesList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info-left">
                <div class="file-icon">
                    <i class="fas ${getFileIcon(getFileType(file.name))}"></i>
                </div>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${formatFileSize(file.size)} • ${getFileType(file.name).toUpperCase()}</p>
                </div>
            </div>
            <button class="file-remove" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;
        filesList.appendChild(fileItem);
    });
}

window.removeFile = function(index) {
    selectedFiles.splice(index, 1);
    updateFilesList();
    if (result.success) {
    // İNDİRME SAYFASINA YÖNLENDİR
    const downloadPageUrl = `/download.html?id=${result.transferId}`;
    
    showToast(`✅ ${result.files.length} dosya yüklendi!`, 'success');
    
    // 2 saniye sonra indirme sayfasına git
    setTimeout(() => {
        window.location.href = downloadPageUrl;
    }, 1500);
    
    return true;
    }
    }
};

// ====================
// İLERLEME BÖLÜMÜ
// ====================

function showProgressSection() {
    if (selectedFiles.length > 0) {
        uploadArea.classList.add('hidden');
        progressSection.classList.remove('hidden');
        
        const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
        fileInfo.textContent = `${selectedFiles.length} dosya • ${formatFileSize(totalSize)}`;
    }
}

function hideProgressSection() {
    progressSection.classList.add('hidden');
    uploadArea.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
}

function updateProgress(percent) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
}

// ====================
// DOSYA YÜKLEME
// ====================

async function uploadFiles() {
    // FormData oluştur
    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));
    
    if (senderEmail.value) formData.append('senderEmail', senderEmail.value);
    if (receiverEmail.value) formData.append('receiverEmail', receiverEmail.value);
    if (message.value) formData.append('message', message.value);
    
    try {
        // Yükleme animasyonu
        for (let i = 0; i <= 100; i += 20) {
            updateProgress(i);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // API'ye gönder
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        updateProgress(100);
        
        if (result.success) {
            currentTransferData = result;
            showToast('✅ Dosyalar başarıyla yüklendi!', 'success');
            return true;
        } else {
            showToast(`❌ Hata: ${result.error}`, 'error');
            return false;
        }
    } catch (error) {
        console.error('Yükleme hatası:', error);
        showToast('🌐 Sunucu bağlantı hatası', 'error');
        return false;
    }
}

// ====================
// GÖNDER BUTONU
// ====================

sendButton.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        showToast('Lütfen dosya seçin', 'error');
        return;
    }
    
    sendButton.disabled = true;
    sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';
    
    const success = await uploadFiles();
    
    if (success && currentTransferData) {
        // Başarılı ise indirme bölümünü göster
        showDownloadSection();
    }
    
    sendButton.disabled = false;
    sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Transfer Başlat';
});

// ====================
// İNDİRME BÖLÜMÜ
// ====================

function showDownloadSection() {
    progressSection.classList.add('hidden');
    document.querySelector('.email-form').classList.add('hidden');
    downloadSection.classList.remove('hidden');
    
    // Link oluştur
    const fullLink = `${window.location.origin}/api/files/${currentTransferData.transferId}`;
    downloadLink.value = fullLink;
    linkCode.textContent = currentTransferData.transferId.substring(0, 8);
    
    showToast('📋 İndirme linki hazır!', 'success');
}

// Link kopyalama
copyButton.addEventListener('click', () => {
    downloadLink.select();
    document.execCommand('copy');
    
    const originalText = copyButton.innerHTML;
    copyButton.innerHTML = '<i class="fas fa-check"></i> Kopyalandı!';
    copyButton.classList.add('btn-primary');
    
    showToast('Link panoya kopyalandı!', 'success');
    
    setTimeout(() => {
        copyButton.innerHTML = originalText;
        copyButton.classList.remove('btn-primary');
    }, 2000);
});

// Yeni transfer
if (newTransferButton) {
    newTransferButton.addEventListener('click', () => {
        selectedFiles = [];
        currentTransferData = null;
        
        downloadSection.classList.add('hidden');
        document.querySelector('.email-form').classList.remove('hidden');
        uploadArea.classList.remove('hidden');
        
        receiverEmail.value = '';
        senderEmail.value = '';
        message.value = '';
        fileInput.value = '';
        filesList.innerHTML = '';
        hideProgressSection();
        
        showToast('Yeni transfer hazır!', 'info');
    });
}

// ====================
// YARDIMCI FONKSİYONLAR
// ====================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Byte';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
        'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image',
        'pdf': 'pdf', 'doc': 'document', 'docx': 'document', 'txt': 'text',
        'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'mp4': 'video',
        'mp3': 'audio', 'wav': 'audio'
    };
    return types[ext] || 'file';
}

function getFileIcon(fileType) {
    const icons = {
        'image': 'fa-file-image', 'pdf': 'fa-file-pdf', 'document': 'fa-file-word',
        'text': 'fa-file-alt', 'archive': 'fa-file-archive', 'video': 'fa-file-video',
        'audio': 'fa-file-audio', 'file': 'fa-file'
    };
    return icons[fileType] || 'fa-file';
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast';
    
    if (type === 'success') toast.style.backgroundColor = '#2ecc71';
    else if (type === 'error') toast.style.backgroundColor = '#e74c3c';
    else if (type === 'warning') toast.style.backgroundColor = '#f39c12';
    else toast.style.backgroundColor = '#3498db';
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

// ====================
// SAYFA YÜKLENDİĞİNDE
// ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOSYASHARE yüklendi');
    showToast('DOSYASHARE\'e hoş geldiniz!', 'info');
    
    // Demo modu bilgisi
    setTimeout(() => {
        showToast('💡 Demo Modu: Gerçek dosya yükleme aktif', 'info');
    }, 2000);
});
