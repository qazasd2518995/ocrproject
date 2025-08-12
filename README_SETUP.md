# 源正山鋼索五金行 OCR 系統 - 安裝指南

## 🚀 快速開始

### 1. 複製專案
```bash
git clone https://github.com/qazasd2518995/ocrproject.git
cd ocrproject
```

### 2. 設定 API Keys

#### 方法一：直接在程式碼中設定（簡單）
編輯 `js/google-vision-pro.js` 檔案，替換以下內容：
```javascript
const OCR_SPACE_API_KEY = 'YOUR_OCR_SPACE_API_KEY';
const GOOGLE_VISION_API_KEY = 'YOUR_GOOGLE_VISION_API_KEY';
```

#### 方法二：使用配置檔案（推薦）
1. 複製配置範例檔案：
```bash
cp config.example.js config.js
```

2. 編輯 `config.js`，填入您的 API Keys

### 3. 取得 API Keys

#### OCR.space API（免費）
1. 訪問 https://ocr.space/ocrapi
2. 註冊帳號
3. 取得免費 API Key（每月 25,000 次請求）

#### Google Vision API
1. 訪問 https://cloud.google.com/vision
2. 建立 Google Cloud 專案
3. 啟用 Vision API
4. 建立 API Key

### 4. 開啟系統
直接在瀏覽器中開啟 `login.html`

## 📝 登入資訊
- 帳號：`2518995`
- 密碼：`2518995`

## 🔧 系統架構

### 主要檔案
- `login.html` - 登入頁面
- `index-google-pro.html` - 主系統頁面（專業版）
- `js/google-vision-pro.js` - 核心 JavaScript 檔案
- `css/style-pro.css` - 專業版樣式

### 其他版本（選用）
- `index.html` - 基礎版本（包含 Tesseract）
- `index-google.html` - Google Vision 加強版
- `index-hf.html` - Hugging Face 版本

## 🌟 功能特色
- ✅ 登入系統保護
- ✅ 雙引擎 OCR（OCR.space + Google Vision）
- ✅ 歷史記錄管理
- ✅ 支援 HEIC、JPG、PNG、PDF
- ✅ 自動圖片壓縮
- ✅ 結果比較模式

## 📱 瀏覽器支援
- Chrome 90+
- Safari 14+
- Firefox 88+
- Edge 90+

## ⚠️ 注意事項
1. HEIC 格式轉換需要 Safari 瀏覽器或安裝相關擴充功能
2. 歷史記錄儲存在瀏覽器 localStorage，清除瀏覽器資料會遺失
3. API Keys 請妥善保管，不要公開分享

## 🆘 常見問題

### Q: OCR 辨識失敗？
A: 請檢查：
- API Keys 是否正確設定
- 網路連線是否正常
- 圖片大小是否超過限制（10MB）

### Q: 無法登入？
A: 預設帳密為 `2518995`，如需修改請編輯 `login.html` 中的驗證邏輯

### Q: 歷史記錄不見了？
A: 歷史記錄儲存在瀏覽器本地，清除瀏覽器資料或更換瀏覽器會遺失

## 📄 授權
僅供內部使用