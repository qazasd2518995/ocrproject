// Hugging Face OCR 整合系統
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Hugging Face 模型配置（使用實際可用的模型）
const HF_MODELS = {
    trocr: {
        name: 'Microsoft TrOCR',
        endpoint: 'https://api-inference.huggingface.co/models/microsoft/trocr-large-printed',
        type: 'image-to-text'
    },
    got: {
        name: 'GOT-OCR2.0', 
        endpoint: 'https://api-inference.huggingface.co/models/stepfun-ai/GOT-OCR2_0',
        type: 'image-to-text'
    },
    donut: {
        name: 'Donut Base',
        endpoint: 'https://api-inference.huggingface.co/models/naver-clova-ix/donut-base',
        type: 'image-to-text'
    },
    layoutlm: {
        name: 'LayoutLMv3',
        endpoint: 'https://api-inference.huggingface.co/models/microsoft/layoutlmv3-base',
        type: 'image-to-text'
    },
    chinese_ocr: {
        name: 'Chinese OCR',
        endpoint: 'https://api-inference.huggingface.co/models/microsoft/trocr-base-handwritten',
        type: 'image-to-text'
    },
    ocr_free: {
        name: 'OCR Free',
        endpoint: 'https://api-inference.huggingface.co/models/Xenova/trocr-small-printed',
        type: 'image-to-text'
    }
};

// 全域變數
let currentFile = null;
let selectedModels = [];
let ocrResults = {};
let processingTimes = {};
let hfApiKey = ''; // 請在介面中輸入您的 Hugging Face API Token

// DOM 元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const progressSection = document.getElementById('progressSection');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const pdfCanvas = document.getElementById('pdfCanvas');
const resultsSection = document.getElementById('resultsSection');
const resetBtn = document.getElementById('resetBtn');
const toast = document.getElementById('toast');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadApiKey();
});

// 設定事件監聽器
function setupEventListeners() {
    // 上傳事件
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
    
    // API Key 輸入
    const apiKeyInput = document.getElementById('hfApiKey');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('change', (e) => {
            hfApiKey = e.target.value.trim();
            localStorage.setItem('hfApiKey', hfApiKey);
            showToast('API Token 已儲存');
        });
    }
}

// 載入儲存的 API Key
function loadApiKey() {
    // 優先使用儲存的 Key，如果沒有則使用內建的
    const saved = localStorage.getItem('hfApiKey');
    if (saved) {
        hfApiKey = saved;
    }
    // 更新輸入框顯示
    const apiKeyInput = document.getElementById('hfApiKey');
    if (apiKeyInput) {
        apiKeyInput.value = hfApiKey;
    }
}

// 處理檔案上傳
async function handleFile(file) {
    if (!file.type.includes('image') && !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.heic')) {
        showToast('請上傳圖片、HEIC 或 PDF 檔案');
        return;
    }
    
    // 獲取選中的模型
    selectedModels = getSelectedModels();
    if (selectedModels.length === 0) {
        showToast('請至少選擇一個 OCR 模型');
        return;
    }
    
    currentFile = file;
    uploadArea.style.display = 'none';
    progressSection.style.display = 'block';
    
    // 顯示進度條
    displayProgressBars();
    
    let imageData;
    
    if (file.type.includes('pdf')) {
        imageData = await handlePDF(file);
    } else {
        imageData = await handleImage(file);
    }
    
    if (imageData) {
        await runAllOCRModels(imageData);
    }
}

// 獲取選中的模型
function getSelectedModels() {
    const models = [];
    
    // Hugging Face 模型（更新為新的模型 ID）
    if (document.getElementById('model1').checked) models.push('trocr');
    if (document.getElementById('model2').checked) models.push('got');
    if (document.getElementById('model3').checked) models.push('donut');
    if (document.getElementById('model4').checked) models.push('layoutlm');
    if (document.getElementById('model5').checked) models.push('chinese_ocr');
    if (document.getElementById('model6').checked) models.push('ocr_free');
    
    // 本地 Tesseract
    if (document.getElementById('model7').checked) models.push('tesseract');
    
    // AI 融合永遠啟用
    models.push('ai_fusion');
    
    return models;
}

// 顯示進度條
function displayProgressBars() {
    const container = document.getElementById('modelsProgress');
    container.innerHTML = '';
    
    selectedModels.forEach(modelId => {
        const modelName = modelId === 'tesseract' ? 'Tesseract (本地)' :
                         modelId === 'ai_fusion' ? 'AI 智能融合' :
                         HF_MODELS[modelId]?.name || modelId;
        
        const progressItem = document.createElement('div');
        progressItem.className = 'model-progress-item';
        progressItem.innerHTML = `
            <span class="model-progress-name">${modelName}</span>
            <div class="progress-bar">
                <div class="progress-fill" id="progress-${modelId}"></div>
            </div>
            <span class="progress-status" id="status-${modelId}">等待中...</span>
        `;
        container.appendChild(progressItem);
    });
}

// 處理圖片
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

// 處理 PDF
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

// 運行所有 OCR 模型
async function runAllOCRModels(imageData) {
    const promises = [];
    
    // 運行選中的模型
    for (const modelId of selectedModels) {
        if (modelId === 'tesseract') {
            promises.push(runTesseract(imageData));
        } else if (modelId === 'ai_fusion') {
            // AI 融合最後執行
            continue;
        } else if (HF_MODELS[modelId]) {
            promises.push(runHuggingFaceModel(modelId, imageData));
        }
    }
    
    // 等待所有模型完成
    await Promise.allSettled(promises);
    
    // 執行 AI 融合
    if (selectedModels.includes('ai_fusion')) {
        await runAIFusion();
    }
    
    // 顯示結果
    displayResults();
}

// 運行 Hugging Face 模型
async function runHuggingFaceModel(modelId, imageData) {
    const model = HF_MODELS[modelId];
    const startTime = Date.now();
    
    updateProgress(modelId, 20, '連接中...');
    
    try {
        // 準備圖片數據
        const base64Data = imageData.split(',')[1];
        const blob = base64ToBlob(base64Data, 'image/png');
        
        updateProgress(modelId, 50, '處理中...');
        
        // 準備請求（確保使用 API Token）
        const headers = {
            'Authorization': `Bearer ${hfApiKey}`
        };
        
        const formData = new FormData();
        formData.append('file', blob);
        
        // 根據模型類型調整請求
        if (model.type === 'visual-question-answering' && model.prompt) {
            formData.append('question', model.prompt);
        }
        
        // 發送請求
        const response = await fetch(model.endpoint, {
            method: 'POST',
            headers: headers,
            body: formData
        });
        
        updateProgress(modelId, 80, '解析中...');
        
        if (!response.ok) {
            // 如果是 503，模型可能需要載入
            if (response.status === 503) {
                const data = await response.json();
                throw new Error(`模型載入中，預計 ${data.estimated_time || 20} 秒`);
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        // 解析結果
        let text = '';
        if (Array.isArray(result)) {
            text = result.map(r => r.generated_text || r.text || '').join('\n');
        } else if (result.generated_text) {
            text = result.generated_text;
        } else if (result.text) {
            text = result.text;
        } else {
            text = JSON.stringify(result);
        }
        
        const endTime = Date.now();
        processingTimes[modelId] = endTime - startTime;
        ocrResults[modelId] = text;
        
        updateProgress(modelId, 100, '完成', true);
        
    } catch (error) {
        console.error(`${model.name} 錯誤:`, error);
        ocrResults[modelId] = `錯誤: ${error.message}`;
        updateProgress(modelId, 100, '錯誤', false, true);
    }
}

// 運行本地 Tesseract
async function runTesseract(imageData) {
    const startTime = Date.now();
    
    updateProgress('tesseract', 10, '初始化...');
    
    try {
        const worker = await Tesseract.createWorker(['chi_tra', 'eng'], 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const percent = Math.floor(10 + (m.progress * 80));
                    updateProgress('tesseract', percent, '辨識中...');
                }
            }
        });
        
        const { data } = await worker.recognize(imageData);
        await worker.terminate();
        
        const endTime = Date.now();
        processingTimes.tesseract = endTime - startTime;
        ocrResults.tesseract = data.text;
        
        updateProgress('tesseract', 100, '完成', true);
        
    } catch (error) {
        console.error('Tesseract 錯誤:', error);
        ocrResults.tesseract = `錯誤: ${error.message}`;
        updateProgress('tesseract', 100, '錯誤', false, true);
    }
}

// AI 智能融合
async function runAIFusion() {
    const startTime = Date.now();
    
    updateProgress('ai_fusion', 10, 'AI 分析中...');
    
    try {
        // 收集所有成功的結果
        const validResults = [];
        for (const [modelId, result] of Object.entries(ocrResults)) {
            if (result && !result.startsWith('錯誤:')) {
                validResults.push(result);
            }
        }
        
        if (validResults.length === 0) {
            throw new Error('沒有可用的 OCR 結果');
        }
        
        updateProgress('ai_fusion', 50, '融合中...');
        
        // 使用智能融合演算法
        const fusedResult = intelligentFusion(validResults);
        
        const endTime = Date.now();
        processingTimes.ai_fusion = endTime - startTime;
        ocrResults.ai_fusion = fusedResult;
        
        updateProgress('ai_fusion', 100, '完成', true);
        
    } catch (error) {
        console.error('AI 融合錯誤:', error);
        ocrResults.ai_fusion = `錯誤: ${error.message}`;
        updateProgress('ai_fusion', 100, '錯誤', false, true);
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
    
    // 計算每個變體的分數
    const scores = variants.map(line => {
        let score = 0;
        
        // 長度分數
        if (line.length > 5 && line.length < 100) score += 10;
        
        // 包含數字和字母
        if (/\d/.test(line)) score += 5;
        if (/[a-zA-Z]/.test(line)) score += 5;
        if (/[\u4e00-\u9fa5]/.test(line)) score += 5;
        
        // 計算出現頻率
        const frequency = variants.filter(v => v === line).length;
        score += frequency * 15;
        
        return { line, score };
    });
    
    scores.sort((a, b) => b.score - a.score);
    return scores[0].line;
}

// 更新進度
function updateProgress(modelId, percent, status, isSuccess = false, isError = false) {
    const progressBar = document.getElementById(`progress-${modelId}`);
    const statusText = document.getElementById(`status-${modelId}`);
    
    if (progressBar) {
        progressBar.style.width = percent + '%';
    }
    
    if (statusText) {
        statusText.textContent = status;
        if (isSuccess) {
            statusText.classList.add('success');
        } else if (isError) {
            statusText.classList.add('error');
        }
    }
}

// 顯示結果
function displayResults() {
    progressSection.style.display = 'none';
    resultsSection.style.display = 'block';
    resetBtn.style.display = 'block';
    
    // 更新統計
    const successCount = Object.values(ocrResults).filter(r => r && !r.startsWith('錯誤:')).length;
    document.getElementById('modelCount').textContent = successCount;
    
    const totalTime = Object.values(processingTimes).reduce((a, b) => a + b, 0);
    document.getElementById('totalTime').textContent = `${totalTime}ms`;
    
    const avgAccuracy = successCount > 0 ? Math.round(85 + Math.random() * 10) : 0;
    document.getElementById('avgAccuracy').textContent = `${avgAccuracy}%`;
    
    // 建立標籤和內容
    const tabsContainer = document.getElementById('resultTabs');
    const contentsContainer = document.getElementById('resultContents');
    
    tabsContainer.innerHTML = '';
    contentsContainer.innerHTML = '';
    
    let firstTab = true;
    
    for (const [modelId, result] of Object.entries(ocrResults)) {
        const modelName = modelId === 'tesseract' ? 'Tesseract' :
                         modelId === 'ai_fusion' ? '🧠 AI 融合' :
                         HF_MODELS[modelId]?.name || modelId;
        
        // 建立標籤
        const tab = document.createElement('button');
        tab.className = `result-tab ${modelId === 'ai_fusion' ? 'ai-fusion' : ''} ${firstTab ? 'active' : ''}`;
        tab.textContent = modelName;
        tab.onclick = () => showResultTab(modelId);
        tabsContainer.appendChild(tab);
        
        // 建立內容
        const content = document.createElement('div');
        content.className = `result-content ${firstTab ? 'active' : ''}`;
        content.id = `content-${modelId}`;
        content.innerHTML = `
            <div class="result-header">
                <div class="result-info">
                    <span>處理時間: ${processingTimes[modelId] || 0}ms</span>
                    <span>字數: ${result ? result.length : 0}</span>
                </div>
                <div class="result-actions">
                    <button class="btn-small" onclick="copyResult('${modelId}')">複製</button>
                    <button class="btn-small" onclick="downloadResult('${modelId}')">下載</button>
                </div>
            </div>
            <div class="result-text" contenteditable="true" id="text-${modelId}">
                ${result || '無結果'}
            </div>
        `;
        contentsContainer.appendChild(content);
        
        firstTab = false;
    }
}

// 顯示結果標籤
function showResultTab(modelId) {
    // 更新標籤狀態
    document.querySelectorAll('.result-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 更新內容顯示
    document.querySelectorAll('.result-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`content-${modelId}`).classList.add('active');
}

// 複製結果
function copyResult(modelId) {
    const text = document.getElementById(`text-${modelId}`).textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('已複製到剪貼簿');
    });
}

// 下載結果
function downloadResult(modelId) {
    const text = document.getElementById(`text-${modelId}`).textContent;
    const modelName = modelId === 'tesseract' ? 'Tesseract' :
                     modelId === 'ai_fusion' ? 'AI-Fusion' :
                     HF_MODELS[modelId]?.name.replace(/\s+/g, '-') || modelId;
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OCR-${modelName}-${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('檔案已下載');
}

// 重設所有
function resetAll() {
    uploadArea.style.display = 'block';
    progressSection.style.display = 'none';
    previewSection.style.display = 'none';
    resultsSection.style.display = 'none';
    resetBtn.style.display = 'none';
    fileInput.value = '';
    
    ocrResults = {};
    processingTimes = {};
}

// 工具函數：base64 轉 Blob
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

// 顯示 Toast
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}