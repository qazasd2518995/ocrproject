pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const pdfCanvas = document.getElementById('pdfCanvas');
const resultSection = document.getElementById('resultSection');
const resultText = document.getElementById('resultText');
const resetBtn = document.getElementById('resetBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const toast = document.getElementById('toast');

let currentFile = null;
let ocrResult = '';
let advancedOCR = null;

// 初始化進階 OCR
document.addEventListener('DOMContentLoaded', () => {
    advancedOCR = new AdvancedOCR();
});

uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
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
    if (file) {
        handleFile(file);
    }
});

async function handleFile(file) {
    if (!file.type.includes('image') && !file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.heic')) {
        showToast('請上傳圖片、HEIC 或 PDF 檔案');
        return;
    }
    
    currentFile = file;
    uploadArea.style.display = 'none';
    progressSection.style.display = 'block';
    
    updateProgress(10, '正在載入檔案...');
    
    if (file.type.includes('pdf')) {
        await handlePDF(file);
    } else {
        await handleImage(file);
    }
}

async function handleImage(file) {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        const imageData = e.target.result;
        
        previewImage.src = imageData;
        previewImage.style.display = 'block';
        pdfCanvas.style.display = 'none';
        previewSection.style.display = 'block';
        
        updateProgress(30, '正在準備 OCR 引擎...');
        
        try {
            // 使用進階 OCR 模組
            const text = await advancedOCR.performOCR(imageData, updateProgress);
            
            updateProgress(100, '辨識完成！');
            
            setTimeout(() => {
                displayResult(text);
            }, 500);
            
        } catch (error) {
            console.error('OCR 錯誤:', error);
            showToast('辨識失敗，請重試');
            resetForm();
        }
    };
    
    reader.readAsDataURL(file);
}

async function handlePDF(file) {
    updateProgress(20, '正在載入 PDF...');
    
    const fileReader = new FileReader();
    
    fileReader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target.result);
        
        try {
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
            
            updateProgress(40, '正在準備 OCR 引擎...');
            
            const imageData = canvas.toDataURL('image/png');
            
            // 使用進階 OCR 模組
            const text = await advancedOCR.performOCR(imageData, updateProgress);
            
            updateProgress(100, '辨識完成！');
            
            setTimeout(() => {
                displayResult(text);
            }, 500);
            
        } catch (error) {
            console.error('PDF 處理錯誤:', error);
            showToast('PDF 處理失敗，請重試');
            resetForm();
        }
    };
    
    fileReader.readAsArrayBuffer(file);
}

function updateProgress(percent, text) {
    progressFill.style.width = `${percent}%`;
    progressText.textContent = text;
}

function displayResult(text) {
    ocrResult = text;
    resultText.textContent = text;
    progressSection.style.display = 'none';
    resultSection.style.display = 'block';
    resetBtn.style.display = 'block';
}

selectAllBtn.addEventListener('click', () => {
    const range = document.createRange();
    range.selectNodeContents(resultText);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    showToast('已選取全部文字');
});

copyBtn.addEventListener('click', () => {
    const selection = window.getSelection();
    const selectedText = selection.toString() || resultText.textContent;
    
    navigator.clipboard.writeText(selectedText).then(() => {
        showToast('已複製到剪貼簿');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = selectedText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('已複製到剪貼簿');
    });
});

downloadBtn.addEventListener('click', () => {
    const text = resultText.textContent;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `辨識結果_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('檔案已下載');
});

resetBtn.addEventListener('click', resetForm);

function resetForm() {
    uploadArea.style.display = 'block';
    progressSection.style.display = 'none';
    previewSection.style.display = 'none';
    resultSection.style.display = 'none';
    resetBtn.style.display = 'none';
    fileInput.value = '';
    resultText.textContent = '';
    progressFill.style.width = '0%';
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

resultText.addEventListener('input', () => {
    const cursorPosition = getCaretPosition(resultText);
    ocrResult = resultText.textContent;
    setCaretPosition(resultText, cursorPosition);
});

function getCaretPosition(element) {
    let caretOffset = 0;
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;
    }
    return caretOffset;
}

function setCaretPosition(element, offset) {
    const range = document.createRange();
    const selection = window.getSelection();
    const textNodes = getTextNodes(element);
    let currentOffset = 0;
    let found = false;
    
    for (let i = 0; i < textNodes.length; i++) {
        const node = textNodes[i];
        const nodeLength = node.textContent.length;
        
        if (currentOffset + nodeLength >= offset) {
            range.setStart(node, offset - currentOffset);
            range.collapse(true);
            found = true;
            break;
        }
        
        currentOffset += nodeLength;
    }
    
    if (!found) {
        range.selectNodeContents(element);
        range.collapse(false);
    }
    
    selection.removeAllRanges();
    selection.addRange(range);
}

function getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    
    return textNodes;
}