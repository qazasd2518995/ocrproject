// 專業 OCR 系統 - 只使用 OCR.space 和 Google Vision API
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// API 設定 - 內建 API Keys
const OCR_SPACE_API_KEY = 'K87802744288957';
const GOOGLE_VISION_API_KEY = 'AIzaSyA4GoTq74PCU0g-QEEjsxsFIADdM0RJZQ8';

// 全域變數
let currentFile = null;
let ocrResults = {
    ocrspace: null,
    googlevision: null
};
let processingTimes = {};

// DOM 元素
const uploadBox = document.getElementById('uploadBox');
const fileInput = document.getElementById('fileInput');
const uploadContainer = document.getElementById('uploadContainer');
const previewContainer = document.getElementById('previewContainer');
const previewImage = document.getElementById('previewImage');
const pdfCanvas = document.getElementById('pdfCanvas');
const fileInfo = document.getElementById('fileInfo');
const processContainer = document.getElementById('processContainer');
const resultsContainer = document.getElementById('resultsContainer');
const removeFileBtn = document.getElementById('removeFileBtn');
const processNewBtn = document.getElementById('processNewBtn');
const toast = document.getElementById('toast');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 檢查登入狀態
    if (!checkAuth()) {
        window.location.href = '/';
        return;
    }
    
    setupEventListeners();
    loadHistory();
    initializeLLM();
});

// 初始化 LLM 系統
function initializeLLM() {
    // 確保 Groq LLM 已初始化並設定為預設
    if (window.freeLLMFormatter) {
        window.freeLLMFormatter.provider = 'groq';
        window.freeLLMFormatter.selectedModel = 'llama3-70b-8192';
        window.freeLLMFormatter.isEnabled = true;
        
        // 檢查是否有設定 API Key
        const groqKey = localStorage.getItem('groq_api_key');
        if (!groqKey) {
            console.warn('⚠️ 未設定 Groq API Key，請在瀏覽器控制台執行：localStorage.setItem("groq_api_key", "your_key")');
        } else {
            console.log('✅ 系統已設定為自動使用 Groq LLM 處理');
        }
    }
}

// 設定事件監聽器
function setupEventListeners() {
    // 上傳事件
    uploadBox.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });
    
    // 拖放事件
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });
    
    uploadBox.addEventListener('dragleave', () => {
        uploadBox.classList.remove('dragover');
    });
    
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });
    
    // 移除檔案按鈕
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', resetUpload);
    }
    
    // 處理新檔案按鈕
    if (processNewBtn) {
        processNewBtn.addEventListener('click', resetUpload);
    }
    
    // 標籤切換
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.engine);
        });
    });
    
    // 拍照按鈕
    const cameraBtn = document.getElementById('cameraBtn');
    const cameraInput = document.getElementById('cameraInput');
    if (cameraBtn && cameraInput) {
        cameraBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cameraInput.click();
        });
        
        cameraInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFile(file);
                // 自動開始處理，不需要額外點擊
                showToast('正在處理拍攝的照片...', 'info');
            }
        });
    }
    
    // 歷史記錄按鈕
    const historyBtn = document.getElementById('historyBtn');
    if (historyBtn) {
        historyBtn.addEventListener('click', showHistory);
    }
    
    // 登出按鈕
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('確定要登出系統嗎？')) {
                sessionStorage.clear();
                window.location.href = '/';
            }
        });
    }
    
    // 歷史記錄 Modal 事件
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', () => {
            document.getElementById('historyModal').classList.remove('show');
        });
    }
    
    // 歷史記錄搜尋
    const searchHistoryInput = document.getElementById('searchHistory');
    if (searchHistoryInput) {
        searchHistoryInput.addEventListener('input', (e) => {
            searchHistory(e.target.value);
        });
    }
    
    // 清除所有歷史
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearAllHistory);
    }
    
    // 點擊 Modal 外部關閉
    const historyModal = document.getElementById('historyModal');
    if (historyModal) {
        historyModal.addEventListener('click', (e) => {
            if (e.target === historyModal) {
                historyModal.classList.remove('show');
            }
        });
    }
}

// 處理檔案上傳
async function handleFile(file) {
    // 檢查檔案類型
    if (!file.type.includes('image') && !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.heic')) {
        showToast('請上傳圖片、HEIC 或 PDF 檔案', 'error');
        return;
    }
    
    // 檢查檔案大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('檔案大小不能超過 10MB', 'error');
        return;
    }
    
    currentFile = file;
    
    // 顯示檔案資訊
    const fileSize = (file.size / 1024).toFixed(2);
    const fileType = file.type || (file.name.toLowerCase().endsWith('.heic') ? 'image/heic' : 'unknown');
    fileInfo.innerHTML = `
        <div style="display: flex; justify-content: space-between;">
            <span><strong>檔案名稱:</strong> ${file.name}</span>
            <span><strong>大小:</strong> ${fileSize} KB</span>
            <span><strong>類型:</strong> ${fileType}</span>
        </div>
    `;
    
    // 切換顯示
    uploadContainer.style.display = 'none';
    previewContainer.style.display = 'block';
    processContainer.style.display = 'block';
    
    let imageData;
    
    try {
        if (file.type.includes('pdf')) {
            imageData = await handlePDF(file);
        } else {
            imageData = await handleImage(file);
        }
        
        if (imageData) {
            // 開始 OCR 處理
            await runOCREngines(imageData);
        }
    } catch (error) {
        console.error('檔案處理錯誤:', error);
        showToast('檔案處理失敗，請重試', 'error');
        resetUpload();
    }
}

// 處理圖片檔案
async function handleImage(file) {
    return new Promise((resolve, reject) => {
        // 檢查是否為 HEIC 檔案
        if (file.name.toLowerCase().endsWith('.heic')) {
            convertHeicToJpeg(file).then(jpegData => {
                previewImage.src = jpegData;
                previewImage.style.display = 'block';
                pdfCanvas.style.display = 'none';
                resolve(jpegData);
            }).catch(error => {
                console.error('HEIC 轉換失敗:', error);
                showToast('HEIC 轉換失敗，請使用其他格式', 'error');
                reject(error);
            });
        } else {
            const reader = new FileReader();
            reader.onload = async (e) => {
                let imageData = e.target.result;
                
                // 壓縮圖片
                imageData = await compressImage(imageData);
                
                previewImage.src = imageData;
                previewImage.style.display = 'block';
                pdfCanvas.style.display = 'none';
                resolve(imageData);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        }
    });
}

// 處理 PDF 檔案
async function handlePDF(file) {
    const fileReader = new FileReader();
    
    return new Promise((resolve, reject) => {
        fileReader.onload = async (e) => {
            try {
                const typedArray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                const page = await pdf.getPage(1);
                
                const scale = 2;
                const viewport = page.getViewport({ scale });
                
                const canvas = pdfCanvas;
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                previewImage.style.display = 'none';
                pdfCanvas.style.display = 'block';
                
                const imageData = canvas.toDataURL('image/png');
                resolve(imageData);
            } catch (error) {
                console.error('PDF 處理錯誤:', error);
                showToast('PDF 處理失敗', 'error');
                reject(error);
            }
        };
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });
}

// HEIC 轉換為 JPEG
async function convertHeicToJpeg(file) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = function(e) {
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                canvas.toBlob(function(blob) {
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            resolve(e.target.result);
                        };
                        reader.readAsDataURL(blob);
                    } else {
                        reject(new Error('無法轉換 HEIC 檔案'));
                    }
                }, 'image/jpeg', 0.9);
            };
            
            img.onerror = function() {
                reject(new Error('您的瀏覽器不支援 HEIC 格式，請使用 Safari 或將圖片轉換為 JPEG/PNG'));
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = function() {
            reject(new Error('無法讀取 HEIC 檔案'));
        };
        
        reader.readAsDataURL(file);
    });
}

// 壓縮圖片
async function compressImage(imageData, maxSizeKB = 900) {
    return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let width = img.width;
            let height = img.height;
            const maxDimension = 1920;
            
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = (maxDimension / width) * height;
                    width = maxDimension;
                } else {
                    width = (maxDimension / height) * width;
                    height = maxDimension;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            
            let quality = 0.9;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);
            
            while (dataUrl.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
            
            resolve(dataUrl);
        };
        
        img.src = imageData;
    });
}

// 執行 OCR 引擎
async function runOCREngines(imageData) {
    // 重置結果
    ocrResults = {
        ocrspace: null,
        googlevision: null
    };
    
    // 並行執行兩個 API
    const promises = [
        runOCRSpace(imageData),
        runGoogleVision(imageData)
    ];
    
    await Promise.allSettled(promises);
    
    // 顯示結果
    resultsContainer.style.display = 'block';
    updateCompareView();
}

// OCR.space API
async function runOCRSpace(imageData) {
    const startTime = Date.now();
    updateEngineStatus('ocrSpace', '連接中...', true);
    updateProgress('ocrSpace', 20);
    
    try {
        // 壓縮圖片
        const compressedImage = await compressImage(imageData, 900);
        
        // 準備資料
        const base64Data = compressedImage.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'image/jpeg'});
        
        updateEngineStatus('ocrSpace', '上傳圖片...', true);
        updateProgress('ocrSpace', 50);
        
        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');
        formData.append('apikey', OCR_SPACE_API_KEY);
        formData.append('language', 'cht');
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('OCREngine', '2');
        
        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData
        });
        
        updateEngineStatus('ocrSpace', '處理中...', true);
        updateProgress('ocrSpace', 80);
        
        const result = await response.json();
        
        const endTime = Date.now();
        processingTimes.ocrspace = endTime - startTime;
        
        if (result.ParsedResults && result.ParsedResults[0]) {
            const originalText = result.ParsedResults[0].ParsedText;
            ocrResults.ocrspace = originalText;
            
            // 顯示正在 LLM 處理的狀態
            updateEngineStatus('ocrSpace', '🤖 AI 智能處理中...', true);
            document.getElementById('ocrspaceText').textContent = '🚀 正在使用 AI 整理發票格式，請稍候...\n\n⚡ 使用 Groq Llama 3 70B 模型\n📋 自動識別商品項目\n💰 計算金額總計';
            document.getElementById('compareOcrspace').textContent = '🚀 正在使用 AI 整理發票格式，請稍候...';
            
            // 自動使用免費 LLM 處理（預設 Groq）
            let formattedText = originalText;
            
            if (originalText) {
                try {
                    console.log('🚀 自動使用 Groq LLM 處理發票 (OCR.space)');
                    
                    if (window.freeLLMFormatter) {
                        window.freeLLMFormatter.provider = 'groq';
                        window.freeLLMFormatter.selectedModel = 'llama3-70b-8192';
                        window.freeLLMFormatter.isEnabled = true;
                        
                        formattedText = await window.freeLLMFormatter.formatInvoiceText(originalText);
                        updateEngineStatus('ocrSpace', '✅ AI 處理完成', false, true);
                        console.log('✅ Groq LLM 處理成功');
                    } else {
                        throw new Error('LLM 格式化器未載入');
                    }
                    
                } catch (error) {
                    console.error('❌ LLM 處理失敗:', error);
                    updateEngineStatus('ocrSpace', 'LLM 處理失敗，使用原始結果', false, false);
                    formattedText = `⚠️ LLM 處理失敗：${error.message}\n\n📋 原始 OCR 結果：\n${originalText}`;
                }
            }
            
            document.getElementById('ocrspaceText').textContent = formattedText;
            document.getElementById('compareOcrspace').textContent = formattedText;
            
            // 更新 ocrResults 以儲存格式化後的結果
            ocrResults.ocrspace = formattedText;
            
            updateProgress('ocrSpace', 100, true);
            updateEngineStatus('ocrSpace', '完成', false, true);
            
            // 更新統計資訊
            document.getElementById('ocrSpaceTime').textContent = `${processingTimes.ocrspace}ms`;
            document.getElementById('ocrSpaceConfidence').textContent = '高';
            document.getElementById('ocrSpaceStats').style.display = 'flex';
            
            // 如果兩個引擎都完成了，儲存到歷史記錄
            checkAndSaveHistory();
        } else {
            throw new Error(result.ErrorMessage || 'API 返回錯誤');
        }
    } catch (error) {
        console.error('OCR.space API 錯誤:', error);
        updateProgress('ocrSpace', 100, false, true);
        updateEngineStatus('ocrSpace', '錯誤: ' + error.message, false, false, true);
        document.getElementById('ocrspaceText').textContent = '辨識失敗: ' + error.message;
        
        // 錯誤時也檢查是否可以儲存歷史記錄
        checkAndSaveHistory();
    }
}

// Google Vision API
async function runGoogleVision(imageData) {
    const startTime = Date.now();
    updateEngineStatus('googleVision', '連接中...', true);
    updateProgress('googleVision', 20);
    
    try {
        // 壓縮圖片
        const compressedImage = await compressImage(imageData, 4000);
        
        // 準備 base64 圖片
        const base64Image = compressedImage.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        
        updateEngineStatus('googleVision', '分析圖片...', true);
        updateProgress('googleVision', 50);
        
        const requestBody = {
            requests: [
                {
                    image: {
                        content: base64Image
                    },
                    features: [
                        {
                            type: 'TEXT_DETECTION',
                            maxResults: 1
                        },
                        {
                            type: 'DOCUMENT_TEXT_DETECTION',
                            maxResults: 1
                        }
                    ],
                    imageContext: {
                        languageHints: ['zh-TW', 'en']
                    }
                }
            ]
        };
        
        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            }
        );
        
        updateEngineStatus('googleVision', '處理結果...', true);
        updateProgress('googleVision', 80);
        
        const result = await response.json();
        
        const endTime = Date.now();
        processingTimes.googlevision = endTime - startTime;
        
        if (result.responses && result.responses[0]) {
            const response = result.responses[0];
            
            let text = '';
            if (response.fullTextAnnotation) {
                text = response.fullTextAnnotation.text;
            } else if (response.textAnnotations && response.textAnnotations[0]) {
                text = response.textAnnotations[0].description;
            }
            
            ocrResults.googlevision = text;
            
            // 顯示正在 LLM 處理的狀態
            if (text) {
                updateEngineStatus('googleVision', '🤖 AI 智能處理中...', true);
                document.getElementById('googlevisionText').textContent = '🚀 正在使用 AI 整理發票格式，請稍候...\n\n⚡ 使用 Groq Llama 3 70B 模型\n📋 自動識別商品項目\n💰 計算金額總計';
                document.getElementById('compareGooglevision').textContent = '🚀 正在使用 AI 整理發票格式，請稍候...';
            }
            
            // 自動使用免費 LLM 處理（預設 Groq）
            let formattedText = text || '未檢測到文字';
            
            if (text) {
                try {
                    console.log('🚀 自動使用 Groq LLM 處理發票 (Google Vision)');
                    
                    if (window.freeLLMFormatter) {
                        window.freeLLMFormatter.provider = 'groq';
                        window.freeLLMFormatter.selectedModel = 'llama3-70b-8192';
                        window.freeLLMFormatter.isEnabled = true;
                        
                        formattedText = await window.freeLLMFormatter.formatInvoiceText(text);
                        updateEngineStatus('googleVision', '✅ AI 處理完成', false, true);
                        console.log('✅ Groq LLM 處理成功 (Google Vision)');
                    } else {
                        throw new Error('LLM 格式化器未載入');
                    }
                    
                } catch (error) {
                    console.error('❌ LLM 處理失敗 (Google Vision):', error);
                    updateEngineStatus('googleVision', 'LLM 處理失敗，使用原始結果', false, false);
                    formattedText = `⚠️ LLM 處理失敗：${error.message}\n\n📋 原始 OCR 結果：\n${text}`;
                }
            }
            
            document.getElementById('googlevisionText').textContent = formattedText;
            document.getElementById('compareGooglevision').textContent = formattedText;
            
            // 更新 ocrResults 以儲存格式化後的結果
            ocrResults.googlevision = formattedText;
            
            updateProgress('googleVision', 100, true);
            updateEngineStatus('googleVision', '完成', false, true);
            
            // 更新統計資訊
            const confidence = response.textAnnotations ? 
                Math.round((response.textAnnotations.length / 100) * 95) : 90;
            document.getElementById('googleVisionTime').textContent = `${processingTimes.googlevision}ms`;
            document.getElementById('googleVisionConfidence').textContent = `${confidence}%`;
            document.getElementById('googleVisionStats').style.display = 'flex';
            
            // 如果兩個引擎都完成了，儲存到歷史記錄
            checkAndSaveHistory();
        } else if (result.error) {
            let errorMsg = result.error.message;
            if (result.error.code === 7) {
                errorMsg = 'API Key 無效或權限不足';
            } else if (result.error.code === 400) {
                errorMsg = '圖片格式不支援';
            }
            throw new Error(errorMsg);
        } else {
            throw new Error('未返回結果');
        }
    } catch (error) {
        console.error('Google Vision API 錯誤:', error);
        updateProgress('googleVision', 100, false, true);
        updateEngineStatus('googleVision', '錯誤: ' + error.message, false, false, true);
        document.getElementById('googlevisionText').textContent = '辨識失敗: ' + error.message;
        
        // 錯誤時也檢查是否可以儲存歷史記錄
        checkAndSaveHistory();
    }
}

// 更新引擎狀態
function updateEngineStatus(engine, text, showSpinner = false, success = false, error = false) {
    const statusEl = document.getElementById(`${engine}Status`);
    if (!statusEl) return;
    
    const spinner = statusEl.querySelector('.processing-spinner');
    const statusText = statusEl.querySelector('.status-text');
    
    if (spinner) {
        spinner.style.display = showSpinner ? 'block' : 'none';
    }
    
    if (statusText) {
        statusText.textContent = text;
        statusText.classList.remove('success', 'error');
        if (success) statusText.classList.add('success');
        if (error) statusText.classList.add('error');
    }
}

// 更新進度條
function updateProgress(engine, percent, complete = false, error = false) {
    const progressEl = document.getElementById(`${engine}Progress`);
    if (!progressEl) return;
    
    progressEl.style.width = percent + '%';
    progressEl.classList.remove('complete', 'error');
    if (complete) progressEl.classList.add('complete');
    if (error) progressEl.classList.add('error');
}

// 切換標籤
function switchTab(engine) {
    // 更新標籤按鈕
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.engine === engine) {
            btn.classList.add('active');
        }
    });
    
    // 更新面板顯示
    document.querySelectorAll('.result-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`${engine}Result`).classList.add('active');
}

// 更新比較視圖
function updateCompareView() {
    if (ocrResults.ocrspace) {
        document.getElementById('compareOcrspace').textContent = ocrResults.ocrspace;
    }
    if (ocrResults.googlevision) {
        document.getElementById('compareGooglevision').textContent = ocrResults.googlevision;
    }
}

// 複製文字
function copyText(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('已複製到剪貼簿', 'success');
    }).catch(err => {
        console.error('複製失敗:', err);
        showToast('複製失敗', 'error');
    });
}

// 下載文字
function downloadText(elementId, engineName) {
    const text = document.getElementById(elementId).textContent;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OCR_${engineName}_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('檔案已下載', 'success');
}

// 重置上傳
function resetUpload() {
    uploadContainer.style.display = 'block';
    previewContainer.style.display = 'none';
    processContainer.style.display = 'none';
    resultsContainer.style.display = 'none';
    fileInput.value = '';
    currentFile = null;
    
    // 重置結果
    ocrResults = {
        ocrspace: null,
        googlevision: null
    };
    
    // 重置進度條
    updateProgress('ocrSpace', 0);
    updateProgress('googleVision', 0);
    
    // 重置狀態
    updateEngineStatus('ocrSpace', '準備中...');
    updateEngineStatus('googleVision', '準備中...');
    
    // 隱藏統計資訊
    document.getElementById('ocrSpaceStats').style.display = 'none';
    document.getElementById('googleVisionStats').style.display = 'none';
    
    // 重置文字區域
    document.getElementById('ocrspaceText').textContent = '等待辨識...';
    document.getElementById('googlevisionText').textContent = '等待辨識...';
    document.getElementById('compareOcrspace').textContent = '';
    document.getElementById('compareGooglevision').textContent = '';
}

// 顯示 Toast 通知
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast show';
    if (type === 'success') toast.classList.add('success');
    if (type === 'error') toast.classList.add('error');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========== 認證功能 ==========
function checkAuth() {
    return sessionStorage.getItem('isLoggedIn') === 'true';
}

// 檢查是否可以儲存歷史記錄（兩個引擎都完成）
function checkAndSaveHistory() {
    // 檢查是否有檔案且至少有一個 OCR 結果
    if (!currentFile) {
        console.log('📋 沒有檔案，跳過儲存歷史記錄');
        return;
    }
    
    // 檢查是否至少有一個引擎完成並有結果
    const hasOcrspaceResult = ocrResults.ocrspace && ocrResults.ocrspace.trim() !== '';
    const hasGoogleVisionResult = ocrResults.googlevision && ocrResults.googlevision.trim() !== '';
    
    if (!hasOcrspaceResult && !hasGoogleVisionResult) {
        console.log('📋 沒有 OCR 結果，跳過儲存歷史記錄');
        return;
    }
    
    console.log('💾 準備儲存格式化後的結果到歷史記錄:', {
        hasOcrspace: hasOcrspaceResult,
        hasGoogleVision: hasGoogleVisionResult,
        ocrspaceLength: ocrResults.ocrspace ? ocrResults.ocrspace.length : 0,
        googlevisionLength: ocrResults.googlevision ? ocrResults.googlevision.length : 0
    });
    
    // 儲存到歷史記錄（現在包含 LLM 格式化後的結果）
    addToHistory(currentFile, ocrResults);
}

// ========== 歷史記錄功能 ==========
const HISTORY_KEY = 'ocr_history';
let scanHistory = [];
let useCloudStorage = true; // 使用雲端儲存

// 獲取當前使用者名稱
function getCurrentUser() {
    return sessionStorage.getItem('username') || '2518995';
}

// 載入歷史記錄（優先從雲端，失敗則從本地）
async function loadHistory() {
    // 檢查是否剛清除過歷史記錄
    if (sessionStorage.getItem('historyJustCleared') === 'true') {
        console.log('📋 History was just cleared, skipping cloud load');
        sessionStorage.removeItem('historyJustCleared');
        scanHistory = [];
        return;
    }
    
    // 檢查是否在 Vercel 環境（透過檢查 URL）
    const isVercelDeployment = window.location.hostname.includes('vercel.app') || 
                               window.location.hostname.includes('ocrproject') ||
                               (!window.location.protocol.includes('file'));
    
    console.log('🔍 Debug - Load History:', {
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        isVercelDeployment: isVercelDeployment,
        useCloudStorage: useCloudStorage,
        currentUser: getCurrentUser()
    });
    
    if (isVercelDeployment && useCloudStorage) {
        try {
            // 從雲端載入
            const apiUrl = window.location.protocol.includes('file') 
                ? 'https://ocrproject.vercel.app/api/history?action=list'
                : '/api/history?action=list';
            
            console.log('📡 Fetching from cloud API:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: getCurrentUser() })
            });
            
            console.log('📡 Cloud API Response:', {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText
            });
            
            if (response.ok) {
                const result = await response.json();
                scanHistory = result.data || [];
                console.log('☁️ Loaded from cloud:', {
                    recordCount: scanHistory.length,
                    records: scanHistory.map(r => ({
                        id: r.id,
                        date: r.date,
                        fileName: r.fileName
                    }))
                });
                
                // 同步本地記錄到雲端
                const localStored = localStorage.getItem(HISTORY_KEY);
                if (localStored) {
                    try {
                        const localHistory = JSON.parse(localStored);
                        if (localHistory.length > 0) {
                            console.log('🔄 Syncing local records to cloud:', localHistory.length);
                            await syncLocalToCloud(localHistory);
                            localStorage.removeItem(HISTORY_KEY); // 清除本地記錄
                        }
                    } catch (e) {
                        console.error('Failed to sync local history:', e);
                    }
                }
                return;
            } else {
                console.error('❌ Cloud API returned error:', await response.text());
            }
        } catch (error) {
            console.error('❌ Failed to load from cloud:', error);
            useCloudStorage = false;
        }
    }
    
    // 降級到本地儲存
    console.log('💾 Using local storage (fallback)');
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
        try {
            scanHistory = JSON.parse(stored);
            console.log('💾 Loaded from local storage:', scanHistory.length, 'records');
        } catch (e) {
            scanHistory = [];
        }
    }
}

// 同步本地記錄到雲端
async function syncLocalToCloud(localHistory) {
    try {
        const apiUrl = window.location.protocol.includes('file') 
            ? 'https://ocrproject.vercel.app/api/history?action=sync'
            : '/api/history?action=sync';
            
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: getCurrentUser(),
                localHistory: localHistory
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            scanHistory = result.data || [];
            showToast('歷史記錄已同步到雲端', 'success');
        }
    } catch (error) {
        console.error('Failed to sync to cloud:', error);
    }
}

// 儲存歷史記錄（同時儲存到雲端和本地）
async function saveHistory() {
    // 儲存到本地（作為備份）
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(scanHistory));
    } catch (e) {
        console.error('無法儲存到本地:', e);
        if (scanHistory.length > 0) {
            scanHistory.shift();
            await saveHistory();
        }
    }
    
    // 儲存到雲端
    if (useCloudStorage) {
        try {
            // 雲端會在 addToHistory 時自動儲存
            return true;
        } catch (error) {
            console.error('無法儲存到雲端:', error);
            useCloudStorage = false;
        }
    }
}

// 添加新的掃描記錄
async function addToHistory(fileData, results) {
    const record = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        fileName: fileData.name,
        fileSize: fileData.size,
        fileType: fileData.type,
        results: {
            ocrspace: results.ocrspace,
            googlevision: results.googlevision
        },
        processingTimes: { ...processingTimes }
    };
    
    // 先不要添加到本地陣列，等雲端儲存成功後再添加
    // 這樣可以避免重複添加的問題
    
    // 儲存到雲端
    const isVercelDeployment = window.location.hostname.includes('vercel.app') || 
                               window.location.hostname.includes('ocrproject') ||
                               (!window.location.protocol.includes('file'));
    
    console.log('💾 Saving to history:', {
        isVercelDeployment: isVercelDeployment,
        useCloudStorage: useCloudStorage,
        recordId: record.id,
        fileName: record.fileName,
        currentUser: getCurrentUser()
    });
                               
    if (isVercelDeployment && useCloudStorage) {
        try {
            const apiUrl = window.location.protocol.includes('file') 
                ? 'https://ocrproject.vercel.app/api/history?action=add'
                : '/api/history?action=add';
            
            console.log('📤 Saving to cloud API:', apiUrl);
            
            const requestBody = {
                username: getCurrentUser(),
                record: record
            };
            console.log('📤 Request body:', requestBody);
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            console.log('📤 Save response:', {
                status: response.status,
                ok: response.ok
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Cloud save successful:', result);
                showToast('已儲存到雲端歷史記錄', 'success');
                
                // 立即將新記錄加入本地陣列並更新 UI
                // 不等待雲端重新載入（避免 Blob Storage 延遲問題）
                if (result.record) {
                    // 確保記錄不重複
                    const existingIndex = scanHistory.findIndex(r => r.id === result.record.id);
                    if (existingIndex === -1) {
                        // 新增到開頭
                        scanHistory.unshift(result.record);
                        console.log('📝 Added record to local array:', result.record.id);
                    } else {
                        // 更新現有記錄
                        scanHistory[existingIndex] = result.record;
                        console.log('📝 Updated existing record:', result.record.id);
                    }
                    
                    // 立即更新 UI
                    renderHistoryList(scanHistory);
                    console.log('🔄 UI updated with new record');
                    
                    // 背景同步（延遲載入以確保 Blob Storage 更新）
                    setTimeout(async () => {
                        console.log('🔄 Background sync with cloud...');
                        await loadHistory();
                        renderHistoryList(scanHistory);
                    }, 3000);
                } else {
                    // 如果沒有返回記錄，延遲重新載入
                    setTimeout(async () => {
                        await loadHistory();
                        renderHistoryList(scanHistory);
                    }, 2000);
                }
            } else {
                const errorText = await response.text();
                console.error('❌ Cloud save failed:', errorText);
                throw new Error('Cloud save failed');
            }
        } catch (error) {
            console.error('❌ Failed to save to cloud:', error);
            // 降級到本地儲存
            
            // 添加到本地陣列
            scanHistory.unshift(record);
            
            // 限制歷史記錄數量（最多100筆）
            if (scanHistory.length > 100) {
                scanHistory = scanHistory.slice(0, 100);
            }
            
            saveHistory();
            renderHistoryList(scanHistory);
            showToast('已儲存到本地歷史記錄', 'info');
        }
    } else {
        // 只儲存到本地
        console.log('💾 Saving to local storage only');
        
        // 添加到本地陣列
        scanHistory.unshift(record);
        
        // 限制歷史記錄數量（最多100筆）
        if (scanHistory.length > 100) {
            scanHistory = scanHistory.slice(0, 100);
        }
        
        saveHistory();
        renderHistoryList(scanHistory);
        showToast('已儲存到本地歷史記錄', 'success');
    }
}

// 顯示歷史記錄
function showHistory() {
    const modal = document.getElementById('historyModal');
    const historyList = document.getElementById('historyList');
    
    // 顯示同步狀態
    const isVercelDeployment = window.location.hostname.includes('vercel.app') || 
                               window.location.hostname.includes('ocrproject') ||
                               (!window.location.protocol.includes('file'));
    
    const syncStatus = isVercelDeployment && useCloudStorage 
        ? '<span style="color: #10b981;">☁️ 雲端同步中</span>' 
        : '<span style="color: #f59e0b;">💾 本地儲存</span>';
    
    // 更新 modal header 顯示同步狀態
    const modalHeader = modal.querySelector('.modal-header h2');
    if (modalHeader) {
        modalHeader.innerHTML = `歷史記錄 ${syncStatus}`;
    }
    
    if (scanHistory.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2v6m0 4v8m0-8l-4 4m4-4l4 4M3 12h6m4 0h8"/>
                </svg>
                <p>尚無掃描記錄</p>
            </div>
        `;
    } else {
        renderHistoryList(scanHistory);
    }
    
    // 如果是雲端模式，重新載入最新資料
    if (isVercelDeployment && useCloudStorage) {
        loadHistory().then(() => {
            if (scanHistory.length > 0) {
                renderHistoryList(scanHistory);
            }
        });
    }
    
    modal.classList.add('show');
}

// 渲染歷史記錄列表
function renderHistoryList(records) {
    const historyList = document.getElementById('historyList');
    
    historyList.innerHTML = records.map(record => `
        <div class="history-item" data-id="${record.id}">
            <div class="history-item-header">
                <div class="history-item-info">
                    <div class="history-item-date">${formatDate(record.date)}</div>
                    <div class="history-item-filename">${record.fileName}</div>
                    <div class="history-item-size">檔案大小: ${formatFileSize(record.fileSize)}</div>
                </div>
                <div class="history-item-actions">
                    <button onclick="viewHistoryDetail('${record.id}')" title="檢視詳情">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button onclick="copyHistoryText('${record.id}')" title="複製文字">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                    </button>
                    <button class="delete-btn" onclick="deleteHistoryItem('${record.id}')" title="刪除">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="history-item-results">
                <div class="history-result">
                    <div class="history-result-title">OCR.space</div>
                    <div class="history-result-text">${record.results.ocrspace || '無結果'}</div>
                </div>
                <div class="history-result">
                    <div class="history-result-title">Google Vision</div>
                    <div class="history-result-text">${record.results.googlevision || '無結果'}</div>
                </div>
            </div>
        </div>
    `).join('');
}

// 搜尋歷史記錄
function searchHistory(query) {
    if (!query) {
        renderHistoryList(scanHistory);
        return;
    }
    
    const filtered = scanHistory.filter(record => {
        const searchText = query.toLowerCase();
        return record.fileName.toLowerCase().includes(searchText) ||
               (record.results.ocrspace && record.results.ocrspace.toLowerCase().includes(searchText)) ||
               (record.results.googlevision && record.results.googlevision.toLowerCase().includes(searchText));
    });
    
    renderHistoryList(filtered);
}

// 檢視歷史詳情
function viewHistoryDetail(id) {
    const record = scanHistory.find(r => r.id === id);
    if (!record) return;
    
    // 關閉歷史 modal
    document.getElementById('historyModal').classList.remove('show');
    
    // 填充結果到主頁面
    document.getElementById('ocrspaceText').textContent = record.results.ocrspace || '無結果';
    document.getElementById('googlevisionText').textContent = record.results.googlevision || '無結果';
    document.getElementById('compareOcrspace').textContent = record.results.ocrspace || '無結果';
    document.getElementById('compareGooglevision').textContent = record.results.googlevision || '無結果';
    
    // 顯示結果區域
    resultsContainer.style.display = 'block';
    
    showToast('已載入歷史記錄', 'success');
}

// 複製歷史文字
function copyHistoryText(id) {
    const record = scanHistory.find(r => r.id === id);
    if (!record) return;
    
    const text = `檔案: ${record.fileName}
日期: ${formatDate(record.date)}

OCR.space 結果:
${record.results.ocrspace || '無結果'}

Google Vision 結果:
${record.results.googlevision || '無結果'}`;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast('已複製到剪貼簿', 'success');
    }).catch(err => {
        console.error('複製失敗:', err);
        showToast('複製失敗', 'error');
    });
}

// 刪除歷史記錄
async function deleteHistoryItem(id) {
    if (confirm('確定要刪除這筆記錄嗎？')) {
        // 從本地陣列移除
        scanHistory = scanHistory.filter(r => r.id !== id);
        
        // 從雲端刪除
        const isVercelDeployment = window.location.hostname.includes('vercel.app') || 
                                   window.location.hostname.includes('ocrproject') ||
                                   (!window.location.protocol.includes('file'));
                                   
        if (isVercelDeployment && useCloudStorage) {
            try {
                const apiUrl = window.location.protocol.includes('file') 
                    ? 'https://ocrproject.vercel.app/api/history?action=delete'
                    : '/api/history?action=delete';
                    
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: getCurrentUser(),
                        recordId: id
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Cloud delete failed');
                }
            } catch (error) {
                console.error('Failed to delete from cloud:', error);
            }
        }
        
        // 更新本地儲存
        saveHistory();
        renderHistoryList(scanHistory);
        showToast('已刪除記錄', 'success');
    }
}

// 清除所有歷史記錄
async function clearAllHistory() {
    if (confirm('確定要清除所有歷史記錄嗎？此操作無法復原！')) {
        // 先清除本地記錄
        scanHistory = [];
        localStorage.removeItem(HISTORY_KEY);
        
        // 清除雲端記錄
        const isVercelDeployment = window.location.hostname.includes('vercel.app') || 
                                   window.location.hostname.includes('ocrproject') ||
                                   (!window.location.protocol.includes('file'));
                                   
        if (isVercelDeployment && useCloudStorage) {
            try {
                const apiUrl = window.location.protocol.includes('file') 
                    ? 'https://ocrproject.vercel.app/api/history?action=clear'
                    : '/api/history?action=clear';
                
                console.log('🗑️ Clearing cloud history for user:', getCurrentUser());
                    
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: getCurrentUser()
                    })
                });
                
                const result = await response.json();
                console.log('🗑️ Clear cloud response:', result);
                
                if (!response.ok) {
                    throw new Error(`Cloud clear failed: ${result.error || 'Unknown error'}`);
                }
                
                // 確保雲端清除成功
                console.log('✅ Cloud history cleared successfully');
            } catch (error) {
                console.error('❌ Failed to clear cloud history:', error);
                showToast('清除雲端記錄失敗，請重試', 'error');
                // 如果雲端清除失敗，重新載入歷史記錄並更新 UI
                await loadHistory();
                renderHistoryList(scanHistory);
                return;
            }
        }
        
        // 更新 UI
        renderHistoryList(scanHistory);
        showToast('已清除所有記錄', 'success');
        
        // 設置標記，避免立即重新載入
        sessionStorage.setItem('historyJustCleared', 'true');
    }
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 格式化檔案大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}