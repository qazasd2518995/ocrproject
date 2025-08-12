// API 狀態管理模組
class APIStatusManager {
    constructor() {
        this.apiKey = 'K87802744288957';
        this.maxMonthlyLimit = 25000;
        this.usageData = {
            today: 0,
            month: 0,
            remaining: 25000,
            lastChecked: null
        };
        this.loadLocalData();
    }

    // 載入本地儲存的使用數據
    loadLocalData() {
        const savedData = localStorage.getItem('ocrApiUsage');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            // 檢查是否是新的一天或新的月份
            const today = new Date().toDateString();
            const thisMonth = new Date().getMonth();
            const savedMonth = parsed.lastChecked ? new Date(parsed.lastChecked).getMonth() : -1;
            
            if (parsed.lastChecked && new Date(parsed.lastChecked).toDateString() !== today) {
                // 新的一天，重置今日使用量
                parsed.today = 0;
            }
            
            if (savedMonth !== thisMonth) {
                // 新的月份，重置月使用量
                parsed.month = 0;
                parsed.remaining = this.maxMonthlyLimit;
            }
            
            this.usageData = parsed;
        }
    }

    // 儲存使用數據到本地
    saveLocalData() {
        this.usageData.lastChecked = new Date().toISOString();
        localStorage.setItem('ocrApiUsage', JSON.stringify(this.usageData));
    }

    // 更新使用量（每次 OCR 後調用）
    incrementUsage() {
        this.usageData.today++;
        this.usageData.month++;
        this.usageData.remaining = Math.max(0, this.maxMonthlyLimit - this.usageData.month);
        this.saveLocalData();
        this.updateDisplay();
    }

    // 檢查 API 狀態
    async checkAPIStatus() {
        try {
            // 使用小測試圖片檢查 API
            const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
            
            const base64Data = testImage.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {type: 'image/png'});
            
            const formData = new FormData();
            formData.append('file', blob, 'test.png');
            formData.append('apikey', this.apiKey);
            formData.append('language', 'eng');
            
            const response = await fetch('https://api.ocr.space/parse/image', {
                method: 'POST',
                body: formData
            });
            
            // 從 response headers 獲取使用量資訊（如果 API 提供）
            const headers = response.headers;
            const rateLimit = headers.get('X-RateLimit-Limit');
            const rateRemaining = headers.get('X-RateLimit-Remaining');
            
            if (rateRemaining) {
                this.usageData.remaining = parseInt(rateRemaining);
                this.usageData.month = this.maxMonthlyLimit - this.usageData.remaining;
            }
            
            const result = await response.json();
            
            if (response.ok && !result.IsErroredOnProcessing) {
                return {
                    status: 'active',
                    message: '✅ API 正常運作'
                };
            } else {
                return {
                    status: 'error',
                    message: '⚠️ API 有錯誤：' + (result.ErrorMessage || '未知錯誤')
                };
            }
        } catch (error) {
            return {
                status: 'offline',
                message: '❌ 無法連接 API'
            };
        }
    }

    // 更新前端顯示
    updateDisplay() {
        const todayUsageEl = document.getElementById('todayUsage');
        const monthUsageEl = document.getElementById('monthUsage');
        const remainingCallsEl = document.getElementById('remainingCalls');
        const usageFillEl = document.getElementById('usageFill');
        
        if (todayUsageEl) todayUsageEl.textContent = this.usageData.today + ' 次';
        if (monthUsageEl) monthUsageEl.textContent = this.usageData.month + ' 次';
        if (remainingCallsEl) {
            remainingCallsEl.textContent = this.usageData.remaining + ' 次';
            
            // 根據剩餘量改變顏色
            if (this.usageData.remaining < 1000) {
                remainingCallsEl.style.color = '#f44336';
            } else if (this.usageData.remaining < 5000) {
                remainingCallsEl.style.color = '#ff9800';
            } else {
                remainingCallsEl.style.color = '#4CAF50';
            }
        }
        
        // 更新進度條
        if (usageFillEl) {
            const percentage = (this.usageData.month / this.maxMonthlyLimit) * 100;
            usageFillEl.style.width = percentage + '%';
            usageFillEl.setAttribute('data-percent', Math.round(percentage) + '%');
            
            // 根據使用量改變顏色
            usageFillEl.className = 'usage-fill';
            if (percentage > 80) {
                usageFillEl.classList.add('danger');
            } else if (percentage > 60) {
                usageFillEl.classList.add('warning');
            }
        }
    }

    // 初始化顯示
    async initialize() {
        this.updateDisplay();
        
        const statusEl = document.getElementById('apiStatusText');
        if (statusEl) {
            statusEl.textContent = '檢查中...';
            const status = await this.checkAPIStatus();
            statusEl.textContent = status.message;
            
            // 根據狀態改變顏色
            if (status.status === 'active') {
                statusEl.style.color = '#4CAF50';
            } else if (status.status === 'error') {
                statusEl.style.color = '#ff9800';
            } else {
                statusEl.style.color = '#f44336';
            }
        }
    }
}

// 全域函數供 HTML 使用
let apiStatusManager = null;

async function checkAPIStatus() {
    if (!apiStatusManager) {
        apiStatusManager = new APIStatusManager();
    }
    await apiStatusManager.initialize();
}

// 初始化 API 狀態管理器
document.addEventListener('DOMContentLoaded', () => {
    // 建立全域實例
    if (!window.apiStatusManager) {
        window.apiStatusManager = new APIStatusManager();
    }
    
    // 檢查是否已經選擇了 OCR.space API
    setTimeout(() => {
        const selectedEngine = document.querySelector('input[name="ocrEngine"]:checked');
        if (selectedEngine && selectedEngine.value === 'ocr-space') {
            window.apiStatusManager.initialize();
        }
    }, 100);
});

// 匯出給其他模組使用
window.APIStatusManager = APIStatusManager;