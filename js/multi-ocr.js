// PDF.js 設定
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 全域變數
let currentFile = null;
let ocrResults = {
    tesseract: null,
    tesseractEnhanced: null,
    ocrSpace: null,
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
    for (let i = 1; i <= 4; i++) {
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
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            previewImage.src = imageData;
            previewImage.style.display = 'block';
            pdfCanvas.style.display = 'none';
            previewSection.style.display = 'block';
            resolve(imageData);
        };
        reader.readAsDataURL(file);
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
    // 並行執行所有OCR引擎
    const promises = [
        runTesseractStandard(imageData),
        runTesseractEnhanced(imageData),
        runOCRSpace(imageData)
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
            
            // 獲取圖片數據
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

// 3. OCR.space API
async function runOCRSpace(imageData) {
    const startTime = Date.now();
    updateEngineProgress(3, 20, '連接 API...');
    
    try {
        const apiKey = 'K87802744288957'; // 您的 API Key
        
        // 將 base64 轉換為 Blob
        const base64Data = imageData.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'image/png'});
        
        updateEngineProgress(3, 50, '上傳圖片...');
        
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

// 4. AI 智能融合
async function runAIFusion() {
    const startTime = Date.now();
    updateEngineProgress(4, 10, 'AI 分析中...');
    
    try {
        // 收集所有成功的結果
        const validResults = [];
        if (ocrResults.tesseract) validResults.push(ocrResults.tesseract);
        if (ocrResults.tesseractEnhanced) validResults.push(ocrResults.tesseractEnhanced);
        if (ocrResults.ocrSpace) validResults.push(ocrResults.ocrSpace);
        
        if (validResults.length === 0) {
            throw new Error('沒有可用的 OCR 結果');
        }
        
        updateEngineProgress(4, 50, '融合結果...');
        
        // AI 融合演算法
        const fusedResult = intelligentFusion(validResults);
        
        const endTime = Date.now();
        processingTimes.aiFusion = endTime - startTime;
        
        ocrResults.aiFusion = fusedResult;
        document.getElementById('result4').textContent = fusedResult;
        document.getElementById('confidence4').textContent = `信心度: 極高`;
        document.getElementById('time4').textContent = `處理時間: ${processingTimes.aiFusion}ms`;
        
        updateEngineProgress(4, 100, '完成', true);
    } catch (error) {
        console.error('AI 融合錯誤:', error);
        updateEngineProgress(4, 100, '錯誤', false, true);
        document.getElementById('result4').textContent = '融合失敗: ' + error.message;
    }
}

// 智能融合演算法
function intelligentFusion(results) {
    if (results.length === 0) return '';
    if (results.length === 1) return results[0];
    
    // 將每個結果分割成行
    const resultLines = results.map(r => r.split('\n').filter(line => line.trim()));
    
    // 智能融合每一行
    const fusedLines = [];
    const maxLines = Math.max(...resultLines.map(r => r.length));
    
    for (let i = 0; i < maxLines; i++) {
        const lineVariants = [];
        
        // 收集每個結果中的對應行
        for (const lines of resultLines) {
            if (i < lines.length && lines[i].trim()) {
                lineVariants.push(lines[i]);
            }
        }
        
        if (lineVariants.length > 0) {
            // 選擇最佳行（基於長度和出現頻率）
            const bestLine = selectBestLine(lineVariants);
            fusedLines.push(bestLine);
        }
    }
    
    return fusedLines.join('\n');
}

// 選擇最佳文字行
function selectBestLine(variants) {
    if (variants.length === 1) return variants[0];
    
    // 計算每個變體的分數
    const scores = variants.map(line => {
        let score = 0;
        
        // 長度分數（適中長度較好）
        if (line.length > 5 && line.length < 100) score += 10;
        
        // 包含數字和字母
        if (/\d/.test(line)) score += 5;
        if (/[a-zA-Z]/.test(line)) score += 5;
        if (/[\u4e00-\u9fa5]/.test(line)) score += 5; // 中文字符
        
        // 相似度分數（與其他結果的相似度）
        for (const other of variants) {
            if (other !== line) {
                const similarity = calculateSimilarity(line, other);
                score += similarity * 10;
            }
        }
        
        return { line, score };
    });
    
    // 返回分數最高的行
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

// 更新引擎進度
function updateEngineProgress(engineNum, percent, status, isComplete = false, isError = false) {
    const progressBar = document.getElementById(`progress${engineNum}`);
    const statusText = document.getElementById(`status${engineNum}`);
    
    progressBar.style.width = percent + '%';
    statusText.textContent = status;
    
    if (isComplete) {
        progressBar.classList.add('complete');
        statusText.classList.add('complete');
    } else if (isError) {
        progressBar.classList.add('error');
        statusText.classList.add('error');
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
    // AI 融合結果通常是最佳的
    showTab('tab4');
    document.querySelectorAll('.tab-btn')[3].classList.add('active');
    showToast('已切換到 AI 智能融合結果');
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
    if (ocrResults.aiFusion) merged.push('=== AI 智能融合 ===\n' + ocrResults.aiFusion);
    
    const mergedText = merged.join('\n\n' + '='.repeat(50) + '\n\n');
    
    // 創建新的標籤顯示合併結果
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = mergedText;
    document.body.appendChild(tempTextarea);
    tempTextarea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextarea);
    
    showToast('已複製所有合併結果到剪貼簿');
}

// 選擇文字
function selectText(elementId) {
    const element = document.getElementById(elementId);
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    showToast('已選取文字');
}

// 複製文字
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

// 下載文字
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
        aiFusion: null
    };
    
    // 重設進度條
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`progress${i}`).style.width = '0%';
        document.getElementById(`progress${i}`).classList.remove('complete', 'error');
        document.getElementById(`status${i}`).classList.remove('complete', 'error');
        document.getElementById(`result${i}`).textContent = '等待辨識...';
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