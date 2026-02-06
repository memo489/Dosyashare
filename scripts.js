// public/script.js - GitHub Pages için Düzenlenmiş Versiyon
// Bu sürümde backend API çağrıları kaldırılmıştır.

// ... (Dosya seçme, sürükle-bırak, liste gösterme gibi TÜM arayüz kodunuz burada kalabilir) ...

// UPLOAD FONKSİYONUNU DEĞİŞTİRİN (En Önemli Kısım)
async function uploadFiles() {
    // Eski kod: fetch('/api/upload', ...) -> BU ÇALIŞMAYACAK
    // Yeni kod: Backend olmadan simüle edelim
    
    showToast('GitHub Pages Demo Modu: Dosyalar simüle ediliyor...', 'info');
    
    // 2 saniye bekle (yükleme simülasyonu)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Rastgele bir transfer ID'si oluştur
    const demoTransferId = 'DEMO-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    // Demo verisi oluştur
    currentTransferData = {
        success: true,
        shortId: demoTransferId,
        downloadLink: `#demo-${demoTransferId}`,
        files: selectedFiles.map(f => ({
            name: f.name,
            size: f.size,
            formattedSize: formatFileSize(f.size)
        })),
        formattedTotalSize: formatFileSize(selectedFiles.reduce((sum, f) => sum + f.size, 0))
    };
    
    return true; // Başarılı gibi dön
}

// Gönder butonunun event listener'ını güncelleyin
document.getElementById('sendButton').addEventListener('click', async function() {
    this.disabled = true;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Demo Mod: Gönderiliyor...';
    
    const uploadSuccess = await uploadFiles();
    
    if (uploadSuccess) {
        // İndirme linkini demo olarak göster (gerçek indirme olmayacak)
        completeTransfer();
        
        // Ek bilgi göster
        showToast('⭐ DEMO MODU: Backend olmadan çalışan arayüz. Gerçek dosya göndermek için sunucu kurulumu gerekir.', 'info');
    } else {
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-paper-plane"></i> Transfer Başlat';
    }
});

// Kopyala butonunu demo için ayarlayın
document.getElementById('copyButton').addEventListener('click', function() {
    showToast('📋 Demo Modu: Link kopyalandı (simülasyon)', 'success');
});

// Sayfa yüklendiğinde bilgi ver
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        showToast('🔧 DEMO MODU: Bu sadece arayüz gösterimidir. Tam sürüm için sunucu kurulumu gerekir.', 'info');
    }, 1500);
});

// ... formatFileSize, showToast gibi diğer yardımcı fonksiyonlarınız aynı kalabilir ...
