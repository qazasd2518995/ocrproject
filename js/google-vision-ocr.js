// Google Cloud Vision API OCR 整合
// PDF.js 設定
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// API Keys - 請替換為您自己的 API Keys
const GOOGLE_VISION_API_KEY = 'YOUR_GOOGLE_VISION_API_KEY';
const OCR_SPACE_API_KEY = 'YOUR_OCR_SPACE_API_KEY';

// 全域變數
let currentFile = null;
let ocrResults = {
    tesseract: null,
    tesseractEnhanced: null,
    ocrSpace: null,
    googleVision: null,
    aiFusion: null
};
let processingTimes = {};

// DOM 元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const overallProgress = document.getElementById('overallProgress');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const pdfCanvas = document.getElementById('pdfCanvas');
const resultsContainer = document.getElementById('resultsContainer');
const resetBtn = document.getElementById('resetBtn');
const toast = document.getElementById('toast');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

// 設定事件監聽器
function setupEventListeners() {
    uploadArea.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });
    
    // 重置按鈕
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAll);
    }
}

// 處理檔案上傳
async function handleFile(file) {
    if (!file.type.includes('image') && !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.heic')) {
        showToast('請上傳圖片、HEIC 或 PDF 檔案');
        return;
    }
    
    currentFile = file;
    uploadArea.style.display = 'none';
    overallProgress.style.display = 'block';
    
    // 重置所有進度
    for (let i = 1; i <= 5; i++) {
        updateEngineProgress(i, 0, '準備中...');
    }
    
    let imageData;
    
    if (file.type.includes('pdf')) {
        imageData = await handlePDF(file);
    } else {
        imageData = await handleImage(file);
    }
    
    if (imageData) {
        // 同時啟動所有OCR引擎
        await runAllOCREngines(imageData);
    }
}

// 處理圖片檔案
async function handleImage(file) {
    return new Promise((resolve) => {
        // 檢查是否為 HEIC 檔案
        if (file.name.toLowerCase().endsWith('.heic')) {
            // HEIC 需要轉換為 JPEG
            convertHeicToJpeg(file).then(jpegData => {
                previewImage.src = jpegData;
                previewImage.style.display = 'block';
                pdfCanvas.style.display = 'none';
                previewSection.style.display = 'block';
                resolve(jpegData);
            }).catch(error => {
                console.error('HEIC 轉換失敗:', error);
                showToast('HEIC 轉換失敗，請嘗試其他格式');
                resolve(null);
            });
        } else {
            const reader = new FileReader();
            reader.onload = async (e) => {
                let imageData = e.target.result;
                
                // 檢查並壓縮圖片大小
                imageData = await compressImage(imageData);
                
                previewImage.src = imageData;
                previewImage.style.display = 'block';
                pdfCanvas.style.display = 'none';
                previewSection.style.display = 'block';
                resolve(imageData);
            };
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
                previewSection.style.display = 'block';
                
                const imageData = canvas.toDataURL('image/png');
                resolve(imageData);
            } catch (error) {
                console.error('PDF 處理錯誤:', error);
                showToast('PDF 處理失敗');
                reject(error);
            }
        };
        fileReader.readAsArrayBuffer(file);
    });
}

// 同時運行所有 OCR 引擎
async function runAllOCREngines(imageData) {
    if (!imageData) {
        showToast('圖片處理失敗');
        resetUpload();
        return;
    }
    
    // 並行執行所有OCR引擎
    const promises = [
        runTesseractStandard(imageData),
        runTesseractEnhanced(imageData),
        runOCRSpace(imageData),
        runGoogleVision(imageData)
    ];
    
    // 等待所有引擎完成
    await Promise.allSettled(promises);
    
    // 執行 AI 融合
    await runAIFusion();
    
    // 顯示結果
    resultsContainer.style.display = 'block';
    resetBtn.style.display = 'block';
    overallProgress.style.display = 'none';
}

// 1. Tesseract 標準版
async function runTesseractStandard(imageData) {
    const startTime = Date.now();
    updateEngineProgress(1, 10, '初始化...');
    
    try {
        const worker = await Tesseract.createWorker(['chi_tra', 'eng'], 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const percent = Math.floor(10 + (m.progress * 80));
                    updateEngineProgress(1, percent, '辨識中...');
                }
            }
        });
        
        const { data } = await worker.recognize(imageData);
        await worker.terminate();
        
        const endTime = Date.now();
        processingTimes.tesseract = endTime - startTime;
        
        ocrResults.tesseract = data.text;
        document.getElementById('result1').textContent = data.text;
        document.getElementById('confidence1').textContent = `信心度: ${Math.round(data.confidence)}%`;
        document.getElementById('time1').textContent = `處理時間: ${processingTimes.tesseract}ms`;
        
        updateEngineProgress(1, 100, '完成', true);
    } catch (error) {
        console.error('Tesseract 標準版錯誤:', error);
        updateEngineProgress(1, 100, '錯誤', false, true);
        document.getElementById('result1').textContent = '辨識失敗: ' + error.message;
    }
}

// 2. Tesseract 增強版（加入圖片預處理）
async function runTesseractEnhanced(imageData) {
    const startTime = Date.now();
    updateEngineProgress(2, 10, '預處理...');
    
    try {
        // 圖片預處理
        const processedImage = await preprocessImage(imageData);
        updateEngineProgress(2, 30, '初始化...');
        
        const worker = await Tesseract.createWorker(['chi_tra', 'eng'], 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const percent = Math.floor(30 + (m.progress * 60));
                    updateEngineProgress(2, percent, '辨識中...');
                }
            }
        });
        
        const { data } = await worker.recognize(processedImage);
        await worker.terminate();
        
        const endTime = Date.now();
        processingTimes.tesseractEnhanced = endTime - startTime;
        
        ocrResults.tesseractEnhanced = data.text;
        document.getElementById('result2').textContent = data.text;
        document.getElementById('confidence2').textContent = `信心度: ${Math.round(data.confidence)}%`;
        document.getElementById('time2').textContent = `處理時間: ${processingTimes.tesseractEnhanced}ms`;
        
        updateEngineProgress(2, 100, '完成', true);
    } catch (error) {
        console.error('Tesseract 增強版錯誤:', error);
        updateEngineProgress(2, 100, '錯誤', false, true);
        document.getElementById('result2').textContent = '辨識失敗: ' + error.message;
    }
}

// 3. OCR.space API
async function runOCRSpace(imageData) {
    const startTime = Date.now();
    updateEngineProgress(3, 20, '連接 API...');
    
    try {
        // 先壓縮圖片到 1MB 以下
        const compressedImage = await compressImage(imageData, 900); // 留一些餘量，設為 900KB
        
        // 將 base64 轉換為 Blob
        const base64Data = compressedImage.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'image/jpeg'});
        
        updateEngineProgress(3, 50, '上傳圖片...');
        
        const formData = new FormData();
        formData.append('file', blob, 'invoice.jpg');
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
        
        updateEngineProgress(3, 80, '處理結果...');
        
        const result = await response.json();
        
        const endTime = Date.now();
        processingTimes.ocrSpace = endTime - startTime;
        
        if (result.ParsedResults && result.ParsedResults[0]) {
            ocrResults.ocrSpace = result.ParsedResults[0].ParsedText;
            document.getElementById('result3').textContent = ocrResults.ocrSpace;
            document.getElementById('confidence3').textContent = `信心度: 高`;
            document.getElementById('time3').textContent = `處理時間: ${processingTimes.ocrSpace}ms`;
            updateEngineProgress(3, 100, '完成', true);
        } else {
            throw new Error(result.ErrorMessage || 'API 返回錯誤');
        }
    } catch (error) {
        console.error('OCR.space API 錯誤:', error);
        updateEngineProgress(3, 100, '錯誤', false, true);
        document.getElementById('result3').textContent = '辨識失敗: ' + error.message;
        ocrResults.ocrSpace = null;
    }
}

// 4. Google Cloud Vision API
async function runGoogleVision(imageData) {
    const startTime = Date.now();
    updateEngineProgress(4, 20, '連接 Google API...');
    
    try {
        // 先壓縮圖片以避免超過 API 限制
        const compressedImage = await compressImage(imageData, 4000); // Google Vision 支援較大的檔案
        
        // 準備 base64 圖片（移除前綴）
        const base64Image = compressedImage.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
        
        updateEngineProgress(4, 50, '分析圖片...');
        
        // 準備 API 請求
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
        
        // 發送請求到 Google Cloud Vision API
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
        
        updateEngineProgress(4, 80, '處理結果...');
        
        const result = await response.json();
        
        const endTime = Date.now();
        processingTimes.googleVision = endTime - startTime;
        
        if (result.responses && result.responses[0]) {
            const response = result.responses[0];
            
            // 優先使用 fullTextAnnotation（更準確）
            let text = '';
            if (response.fullTextAnnotation) {
                text = response.fullTextAnnotation.text;
            } else if (response.textAnnotations && response.textAnnotations[0]) {
                text = response.textAnnotations[0].description;
            }
            
            ocrResults.googleVision = text;
            document.getElementById('result4').textContent = text || '未檢測到文字';
            
            // 計算信心度
            const confidence = response.textAnnotations ? 
                Math.round((response.textAnnotations.length / 100) * 95) : 90;
            
            document.getElementById('confidence4').textContent = `信心度: ${confidence}%`;
            document.getElementById('time4').textContent = `處理時間: ${processingTimes.googleVision}ms`;
            updateEngineProgress(4, 100, '完成', true);
        } else if (result.error) {
            // 提供更詳細的錯誤訊息
            let errorMsg = result.error.message;
            if (result.error.code === 7) {
                errorMsg = 'API Key 無效或權限不足，請檢查 Google Cloud 設定';
            } else if (result.error.code === 400) {
                errorMsg = '圖片格式或大小不支援，請使用其他圖片';
            }
            throw new Error(errorMsg);
        } else {
            throw new Error('Google Vision API 未返回結果');
        }
    } catch (error) {
        console.error('Google Vision API 錯誤:', error);
        updateEngineProgress(4, 100, '錯誤', false, true);
        
        // 提供使用者友善的錯誤訊息
        let userMessage = '辨識失敗: ';
        if (error.message.includes('Failed to fetch')) {
            userMessage += '網路連線錯誤，請檢查網路連線';
        } else if (error.message.includes('403')) {
            userMessage += 'API Key 無效或已達使用上限';
        } else if (error.message.includes('400')) {
            userMessage += '圖片格式不支援或檔案損壞';
        } else {
            userMessage += error.message;
        }
        
        document.getElementById('result4').textContent = userMessage;
        ocrResults.googleVision = null;
    }
}

// 5. AI 智能融合
async function runAIFusion() {
    const startTime = Date.now();
    updateEngineProgress(5, 10, 'AI 分析中...');
    
    try {
        // 收集所有成功的結果
        const validResults = [];
        if (ocrResults.tesseract) validResults.push(ocrResults.tesseract);
        if (ocrResults.tesseractEnhanced) validResults.push(ocrResults.tesseractEnhanced);
        if (ocrResults.ocrSpace) validResults.push(ocrResults.ocrSpace);
        if (ocrResults.googleVision) validResults.push(ocrResults.googleVision);
        
        if (validResults.length === 0) {
            throw new Error('沒有可用的 OCR 結果');
        }
        
        updateEngineProgress(5, 50, '融合結果...');
        
        // AI 融合演算法（優先考慮 Google Vision 的結果）
        const fusedResult = intelligentFusion(validResults, ocrResults.googleVision);
        
        const endTime = Date.now();
        processingTimes.aiFusion = endTime - startTime;
        
        ocrResults.aiFusion = fusedResult;
        document.getElementById('result5').textContent = fusedResult;
        document.getElementById('confidence5').textContent = `信心度: 極高`;
        document.getElementById('time5').textContent = `處理時間: ${processingTimes.aiFusion}ms`;
        
        updateEngineProgress(5, 100, '完成', true);
    } catch (error) {
        console.error('AI 融合錯誤:', error);
        updateEngineProgress(5, 100, '錯誤', false, true);
        document.getElementById('result5').textContent = '融合失敗: ' + error.message;
    }
}

// 智能融合演算法（優化版，考慮 Google Vision 的高準確度）
function intelligentFusion(results, googleResult) {
    if (results.length === 0) return '';
    if (results.length === 1) return results[0];
    
    // 如果 Google Vision 有結果，給予更高權重
    if (googleResult && googleResult.trim()) {
        // Google Vision 通常最準確，直接返回或稍作調整
        return googleResult;
    }
    
    // 否則使用原始融合演算法
    const resultLines = results.map(r => r.split('\n').filter(line => line.trim()));
    const fusedLines = [];
    const maxLines = Math.max(...resultLines.map(r => r.length));
    
    for (let i = 0; i < maxLines; i++) {
        const lineVariants = [];
        
        for (const lines of resultLines) {
            if (i < lines.length && lines[i].trim()) {
                lineVariants.push(lines[i]);
            }
        }
        
        if (lineVariants.length > 0) {
            const bestLine = selectBestLine(lineVariants);
            fusedLines.push(bestLine);
        }
    }
    
    return fusedLines.join('\n');
}

// 選擇最佳文字行
function selectBestLine(variants) {
    if (variants.length === 1) return variants[0];
    
    const scores = variants.map(line => {
        let score = 0;
        
        if (line.length > 5 && line.length < 100) score += 10;
        if (/\d/.test(line)) score += 5;
        if (/[a-zA-Z]/.test(line)) score += 5;
        if (/[\u4e00-\u9fa5]/.test(line)) score += 5;
        
        for (const other of variants) {
            if (other !== line) {
                const similarity = calculateSimilarity(line, other);
                score += similarity * 10;
            }
        }
        
        return { line, score };
    });
    
    scores.sort((a, b) => b.score - a.score);
    return scores[0].line;
}

// 計算文字相似度
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}

// Levenshtein 距離演算法
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// 圖片預處理函數
async function preprocessImage(imageData) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            let imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageDataObj.data;
            
            // 二值化處理
            const threshold = 128;
            for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                const value = gray > threshold ? 255 : 0;
                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
            }
            
            // 增強對比度
            const factor = 1.5;
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
                data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128));
                data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128));
            }
            
            ctx.putImageData(imageDataObj, 0, 0);
            resolve(canvas.toDataURL());
        };
        
        img.src = imageData;
    });
}

// HEIC 轉換為 JPEG
async function convertHeicToJpeg(file) {
    return new Promise((resolve, reject) => {
        // 建立一個 Canvas 來處理轉換
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        // 使用 FileReader 讀取 HEIC 檔案
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // 嘗試使用瀏覽器內建的 HEIC 支援
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                // 轉換為 JPEG 格式
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
                // 如果瀏覽器不支援 HEIC，提供替代方案
                reject(new Error('您的瀏覽器不支援 HEIC 格式，請使用 Safari 或將圖片轉換為 JPEG/PNG'));
            };
            
            // 嘗試載入 HEIC 圖片
            img.src = e.target.result;
        };
        
        reader.onerror = function() {
            reject(new Error('無法讀取 HEIC 檔案'));
        };
        
        reader.readAsDataURL(file);
    });
}

// 壓縮圖片大小
async function compressImage(imageData, maxSizeKB = 1000) {
    return new Promise((resolve) => {
        const img = new Image();
        
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 計算縮放比例
            let width = img.width;
            let height = img.height;
            const maxDimension = 1920; // 最大維度
            
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
            
            // 嘗試不同的品質設定來達到目標大小
            let quality = 0.9;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);
            
            // 估算檔案大小（base64 大約是實際大小的 1.37 倍）
            while (dataUrl.length > maxSizeKB * 1024 * 1.37 && quality > 0.1) {
                quality -= 0.1;
                dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
            
            resolve(dataUrl);
        };
        
        img.src = imageData;
    });
}

// 重置上傳
function resetUpload() {
    uploadArea.style.display = 'block';
    overallProgress.style.display = 'none';
    previewSection.style.display = 'none';
    resultsContainer.style.display = 'none';
    resetBtn.style.display = 'none';
    currentFile = null;
    ocrResults = {
        tesseract: null,
        tesseractEnhanced: null,
        ocrSpace: null,
        googleVision: null,
        aiFusion: null
    };
}

// 更新引擎進度
function updateEngineProgress(engineNum, percent, status, isComplete = false, isError = false) {
    const progressBar = document.getElementById(`progress${engineNum}`);
    const statusText = document.getElementById(`status${engineNum}`);
    
    if (progressBar) {
        progressBar.style.width = percent + '%';
        
        if (isComplete) {
            progressBar.classList.add('complete');
        } else if (isError) {
            progressBar.classList.add('error');
        }
    }
    
    if (statusText) {
        statusText.textContent = status;
        
        if (isComplete) {
            statusText.classList.add('complete');
        } else if (isError) {
            statusText.classList.add('error');
        }
    }
}

// 顯示標籤
function showTab(tabId) {
    // 隱藏所有標籤內容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    
    // 移除所有活動標籤
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 顯示選中的標籤
    document.getElementById(tabId).style.display = 'block';
    
    // 設定活動標籤按鈕
    event.target.classList.add('active');
}

// 顯示最佳結果
function showBestResult() {
    // Google Vision 或 AI 融合結果通常是最佳的
    if (ocrResults.aiFusion) {
        showTab('tab5');
        document.querySelectorAll('.tab-btn')[4].classList.add('active');
    } else if (ocrResults.googleVision) {
        showTab('tab4');
        document.querySelectorAll('.tab-btn')[3].classList.add('active');
    }
    showToast('已切換到最佳結果');
}

// 比較結果
function compareResults() {
    const comparison = [];
    
    if (ocrResults.tesseract) {
        comparison.push(`Tesseract 標準版: ${ocrResults.tesseract.substring(0, 100)}...`);
    }
    if (ocrResults.tesseractEnhanced) {
        comparison.push(`Tesseract 增強版: ${ocrResults.tesseractEnhanced.substring(0, 100)}...`);
    }
    if (ocrResults.ocrSpace) {
        comparison.push(`OCR.space API: ${ocrResults.ocrSpace.substring(0, 100)}...`);
    }
    if (ocrResults.googleVision) {
        comparison.push(`Google Vision: ${ocrResults.googleVision.substring(0, 100)}...`);
    }
    if (ocrResults.aiFusion) {
        comparison.push(`AI 融合: ${ocrResults.aiFusion.substring(0, 100)}...`);
    }
    
    alert('結果比較:\n\n' + comparison.join('\n\n'));
}

// 合併結果
function mergeResults() {
    const merged = [];
    
    if (ocrResults.tesseract) merged.push('=== Tesseract 標準版 ===\n' + ocrResults.tesseract);
    if (ocrResults.tesseractEnhanced) merged.push('=== Tesseract 增強版 ===\n' + ocrResults.tesseractEnhanced);
    if (ocrResults.ocrSpace) merged.push('=== OCR.space API ===\n' + ocrResults.ocrSpace);
    if (ocrResults.googleVision) merged.push('=== Google Cloud Vision ===\n' + ocrResults.googleVision);
    if (ocrResults.aiFusion) merged.push('=== AI 智能融合 ===\n' + ocrResults.aiFusion);
    
    const mergedText = merged.join('\n\n' + '='.repeat(50) + '\n\n');
    
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = mergedText;
    document.body.appendChild(tempTextarea);
    tempTextarea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextarea);
    
    showToast('已複製所有合併結果到剪貼簿');
}

// 選擇、複製、下載文字功能
function selectText(elementId) {
    const element = document.getElementById(elementId);
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    showToast('已選取文字');
}

function copyText(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('已複製到剪貼簿');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('已複製到剪貼簿');
    });
}

function downloadText(elementId, engineName) {
    const text = document.getElementById(elementId).textContent;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OCR結果_${engineName}_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('檔案已下載');
}

// 重設所有
function resetAll() {
    uploadArea.style.display = 'block';
    overallProgress.style.display = 'none';
    previewSection.style.display = 'none';
    resultsContainer.style.display = 'none';
    resetBtn.style.display = 'none';
    fileInput.value = '';
    
    // 清空結果
    ocrResults = {
        tesseract: null,
        tesseractEnhanced: null,
        ocrSpace: null,
        googleVision: null,
        aiFusion: null
    };
    
    // 重設進度條
    for (let i = 1; i <= 5; i++) {
        const progressBar = document.getElementById(`progress${i}`);
        const statusText = document.getElementById(`status${i}`);
        const resultText = document.getElementById(`result${i}`);
        
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.classList.remove('complete', 'error');
        }
        if (statusText) {
            statusText.classList.remove('complete', 'error');
            statusText.textContent = '等待中...';
        }
        if (resultText) {
            resultText.textContent = '等待辨識...';
        }
    }
}

// 顯示 Toast 通知
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}