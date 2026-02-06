/* Önceki CSS'e ek olarak */

/* Password Section */
.password-section {
    margin-top: 20px;
    padding: 20px;
    background-color: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #f39c12;
}

.password-toggle {
    background: none;
    border: none;
    color: #7f8c8d;
    cursor: pointer;
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
}

.password-input-container {
    position: relative;
}

/* Download Page Styles */
.download-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
}

.download-card {
    background-color: white;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    padding: 40px;
    text-align: center;
}

.download-icon {
    font-size: 64px;
    color: #3498db;
    margin-bottom: 20px;
}

.message-box {
    background-color: #f8f9fa;
    border-left: 4px solid #3498db;
    padding: 15px;
    margin: 20px 0;
    text-align: left;
    border-radius: 8px;
}

/* Responsive Improvements */
@media (max-width: 768px) {
    .download-card {
        padding: 20px;
    }
    
    .file-item {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .file-item .btn {
        margin-top: 10px;
        width: 100%;
    }
}

/* Animations */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

.fade-in {
    animation: fadeIn 0.5s ease-out;
}

/* Loading Spinner */
.spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
