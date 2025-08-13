# 部署到 Vercel 指南

## 🚀 快速部署

### 方法一：使用 Vercel CLI（推薦）

1. **安裝 Vercel CLI**
```bash
npm i -g vercel
```

2. **在專案目錄執行**
```bash
vercel
```

3. **按照提示操作**
- 選擇帳號
- 確認專案名稱
- 選擇部署設定

### 方法二：使用 GitHub 整合

1. **訪問 Vercel**
- 前往 https://vercel.com
- 使用 GitHub 帳號登入

2. **匯入專案**
- 點擊 "New Project"
- 選擇 "Import Git Repository"
- 選擇 `qazasd2518995/ocrproject`

3. **配置設定**
- Framework Preset: `Other`
- Build Command: 留空
- Output Directory: 留空
- Install Command: 留空

4. **點擊 Deploy**

## 📁 專案結構

```
/
├── index.html       # 登入頁面
├── main.html        # OCR 主系統
├── css/            # 樣式檔案
├── js/             # JavaScript 檔案
├── vercel.json     # Vercel 配置
└── package.json    # 專案資訊
```

## 🔑 系統資訊

### 登入帳號
- 帳號：`2518995`
- 密碼：`2518995`

### API Keys（已內建）
- OCR.space: `K87802744288957`
- Google Vision: `AIzaSyA4GoTq74PCU0g-QEEjsxsFIADdM0RJZQ8`

## 🌐 訪問網站

部署完成後，您的網站將可以透過以下網址訪問：
- `https://[your-project-name].vercel.app`

## ⚙️ 環境變數（選用）

如果您想要使用環境變數管理 API Keys：

1. 在 Vercel Dashboard 中設定：
```
OCR_SPACE_API_KEY=your_key
GOOGLE_VISION_API_KEY=your_key
```

2. 修改程式碼以讀取環境變數（需要後端支援）

## 🔄 更新部署

### 自動部署
- 推送到 GitHub main 分支會自動觸發部署

### 手動部署
```bash
vercel --prod
```

## 📝 注意事項

1. **CORS 問題**
   - Google Vision API 可能會有 CORS 限制
   - 建議使用 Vercel Functions 作為代理

2. **API 限制**
   - OCR.space: 每月 25,000 次免費
   - Google Vision: 需注意配額限制

3. **檔案大小**
   - 圖片上傳限制為 10MB
   - 自動壓縮至適當大小

## 🛠️ 故障排除

### 登入無法跳轉？
- 檢查 sessionStorage 是否啟用
- 確認路徑設定正確

### OCR 失敗？
- 檢查網路連線
- 確認 API Keys 有效
- 查看瀏覽器 Console 錯誤訊息

### 歷史記錄遺失？
- 歷史記錄儲存在瀏覽器 localStorage
- 清除瀏覽器資料會遺失記錄

## 📞 支援

如有問題，請聯繫系統管理員。