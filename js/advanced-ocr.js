// 進階 OCR 功能模組
class AdvancedOCR {
    constructor() {
        this.selectedEngine = 'tesseract';
        this.preprocessOptions = {
            enhanceContrast: true,
            removeNoise: true,
            binarize: true,
            deskew: false
        };
        this.apiKey = 'K87802744288957'; // 您的 OCR.space API Key
        this.initEngineSelection();
        this.loadSavedSettings();
    }

    initEngineSelection() {
        const engineRadios = document.querySelectorAll('input[name="ocrEngine"]');
        engineRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.selectedEngine = e.target.value;
                const preprocessDiv = document.getElementById('preprocessOptions');
                const apiKeySection = document.getElementById('apiKeySection');
                
                if (e.target.value === 'tesseract-enhanced') {
                    preprocessDiv.style.display = 'block';
                    apiKeySection.style.display = 'none';
                } else if (e.target.value === 'ocr-space') {
                    preprocessDiv.style.display = 'none';
                    apiKeySection.style.display = 'block';
                    // 自動初始化並顯示 API 狀態
                    if (!window.apiStatusManager) {
                        window.apiStatusManager = new APIStatusManager();
                    }
                    window.apiStatusManager.initialize();
                } else {
                    preprocessDiv.style.display = 'none';
                    apiKeySection.style.display = 'none';
                }
            });
        });

        // 預處理選項監聽
        document.getElementById('enhanceContrast').addEventListener('change', (e) => {
            this.preprocessOptions.enhanceContrast = e.target.checked;
        });
        document.getElementById('removeNoise').addEventListener('change', (e) => {
            this.preprocessOptions.removeNoise = e.target.checked;
        });
        document.getElementById('binarize').addEventListener('change', (e) => {
            this.preprocessOptions.binarize = e.target.checked;
        });
        document.getElementById('deskew').addEventListener('change', (e) => {
            this.preprocessOptions.deskew = e.target.checked;
        });
        
        // API Key 輸入監聽
        const apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput) {
            apiKeyInput.addEventListener('change', (e) => {
                this.apiKey = e.target.value.trim();
                localStorage.setItem('ocrSpaceApiKey', this.apiKey);
            });
        }
    }
    
    loadSavedSettings() {
        // 載入保存的 API Key
        const savedApiKey = localStorage.getItem('ocrSpaceApiKey');
        if (savedApiKey) {
            this.apiKey = savedApiKey;
            const apiKeyInput = document.getElementById('apiKeyInput');
            if (apiKeyInput) {
                apiKeyInput.value = this.apiKey;
            }
        } else {
            // 如果沒有保存的，使用預設的
            const apiKeyInput = document.getElementById('apiKeyInput');
            if (apiKeyInput) {
                apiKeyInput.value = this.apiKey;
            }
            localStorage.setItem('ocrSpaceApiKey', this.apiKey);
        }
    }

    async preprocessImage(imageData) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                let imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                if (this.preprocessOptions.binarize) {
                    imageDataObj = this.binarizeImage(imageDataObj);
                }
                
                if (this.preprocessOptions.enhanceContrast) {
                    imageDataObj = this.enhanceContrast(imageDataObj);
                }
                
                if (this.preprocessOptions.removeNoise) {
                    imageDataObj = this.removeNoise(imageDataObj);
                }
                
                ctx.putImageData(imageDataObj, 0, 0);
                resolve(canvas.toDataURL());
            };
            
            img.src = imageData;
        });
    }

    binarizeImage(imageData) {
        const data = imageData.data;
        const threshold = 128;
        
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            const value = gray > threshold ? 255 : 0;
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
        }
        
        return imageData;
    }

    enhanceContrast(imageData) {
        const data = imageData.data;
        const factor = 1.5;
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
            data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128));
            data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128));
        }
        
        return imageData;
    }

    removeNoise(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const output = new Uint8ClampedArray(data);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    let count = 0;
                    
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nIdx = ((y + dy) * width + (x + dx)) * 4 + c;
                            sum += data[nIdx];
                            count++;
                        }
                    }
                    
                    output[idx + c] = Math.round(sum / count);
                }
            }
        }
        
        for (let i = 0; i < data.length; i++) {
            data[i] = output[i];
        }
        
        return imageData;
    }

    async performOCR(imageData, updateProgress) {
        switch (this.selectedEngine) {
            case 'tesseract':
                return await this.tesseractOCR(imageData, updateProgress);
            
            case 'tesseract-enhanced':
                const processedImage = await this.preprocessImage(imageData);
                return await this.tesseractOCR(processedImage, updateProgress);
            
            case 'ocr-space':
                return await this.ocrSpaceAPI(imageData, updateProgress);
            
            default:
                return await this.tesseractOCR(imageData, updateProgress);
        }
    }

    async tesseractOCR(imageData, updateProgress) {
        const worker = await Tesseract.createWorker(['chi_tra', 'eng'], 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const percent = Math.floor(30 + (m.progress * 60));
                    updateProgress(percent, '正在辨識文字...');
                }
            },
            // 優化設定（移除會造成警告的參數）
            tessedit_pageseg_mode: 3,
            preserve_interword_spaces: '1',
        });
        
        const { data: { text } } = await worker.recognize(imageData);
        await worker.terminate();
        
        return text;
    }

    async ocrSpaceAPI(imageData, updateProgress) {
        updateProgress(50, '正在連接 OCR.space API...');
        
        try {
            // 使用保存的 API Key 或從輸入框獲取
            const apiKey = this.apiKey || '';
            
            if (!apiKey) {
                showToast('請先輸入 OCR.space API Key');
                throw new Error('未提供 API Key');
            }
            
            // 將 base64 轉換為 Blob
            const base64Data = imageData.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'image/png'});
            
            const formData = new FormData();
            formData.append('file', blob, 'invoice.png');
            formData.append('apikey', apiKey);
            formData.append('language', 'cht');
            formData.append('isOverlayRequired', 'false');
            formData.append('detectOrientation', 'true');
            formData.append('scale', 'true');
            formData.append('OCREngine', '2');
            
            const response = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            updateProgress(90, '處理結果中...');
            
            if (result.ParsedResults && result.ParsedResults[0]) {
                // 更新使用量統計
                if (window.apiStatusManager) {
                    window.apiStatusManager.incrementUsage();
                } else {
                    window.apiStatusManager = new APIStatusManager();
                    window.apiStatusManager.incrementUsage();
                }
                return result.ParsedResults[0].ParsedText;
            } else {
                throw new Error('OCR.space API 返回錯誤');
            }
        } catch (error) {
            console.error('OCR.space API 錯誤:', error);
            updateProgress(50, '切換到本地 Tesseract...');
            return await this.tesseractOCR(imageData, updateProgress);
        }
    }
}

// showToast 函數
function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// 匯出給主程式使用
window.AdvancedOCR = AdvancedOCR;