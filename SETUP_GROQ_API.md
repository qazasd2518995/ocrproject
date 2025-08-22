# Groq API Key 設定教學（僅限 Vercel 環境變數）

## 🎯 Vercel 環境變數設定

本系統僅支援透過 Vercel 環境變數設定 API Key，確保安全性和統一管理。

### 📋 設定步驟

1. **取得免費 Groq API Key**
   - 前往 [console.groq.com](https://console.groq.com)
   - 使用 Google/GitHub 帳號註冊或登入
   - 點擊左側選單的 `API Keys`
   - 點擊 `Create API Key` 按鈕
   - 輸入 Key 名稱（例如：OCR-System）
   - 複製生成的 API Key

   ⚠️ **重要**：API Key 只會顯示一次，請立即複製並安全保存！

2. **在 Vercel Dashboard 設定環境變數**
   - 前往 [vercel.com/dashboard](https://vercel.com/dashboard)
   - 登入您的帳號
   - 找到您的 OCR 專案並點擊進入

3. **新增環境變數**
   - 點擊 `Settings` 標籤
   - 選擇 `Environment Variables`
   - 點擊 `Add New` 按鈕
   - 設定如下：
     ```
     Name: GROQ_API_KEY
     Value: your_groq_api_key_here
     Environment: All (Production, Preview, Development)
     ```

4. **重新部署專案**
   - 前往 `Deployments` 標籤
   - 點擊最新部署右側的 ⋯ 選單
   - 選擇 `Redeploy`

## 📊 Groq 服務特色

- **完全免費**：無需信用卡，註冊即可使用
- **極速響應**：業界最快的 LLM 推論服務
- **強大模型**：Llama 3 70B（最強開源模型）
- **充足額度**：每月免費額度足夠個人使用

## ✅ 驗證設定

設定完成後，系統會自動：

1. 從 Vercel 環境變數載入 API Key
2. 在瀏覽器控制台顯示連接狀態
3. 啟用 AI 智能發票格式化功能
4. 上傳發票後自動使用 Groq LLM 處理

成功訊息：`✅ 系統已從 Vercel 環境變數載入 Groq API Key`

## 🐛 疑難排解

### 問題：顯示「未設定 GROQ_API_KEY 環境變數」

**解決方案**：
1. 確認環境變數名稱正確：`GROQ_API_KEY`（全大寫）
2. 確認 API Key 沒有多餘的空格
3. 確認環境變數套用到所有環境（Production, Preview, Development）
4. 重新部署專案讓環境變數生效

### 問題：環境變數設定正確但仍然失敗

**檢查項目**：
1. 等待 1-2 分鐘讓部署完成
2. 強制重新整理瀏覽器（Ctrl+F5 或 Cmd+Shift+R）
3. 檢查瀏覽器控制台的詳細錯誤訊息
4. 確認 API Key 格式正確（應以 `gsk_` 開頭）

### 問題：API 額度不足

**解決方案**：
- Groq 提供充足的免費額度
- 如有需要可升級到付費方案
- 檢查 [console.groq.com](https://console.groq.com) 的使用統計

## 🔒 安全性說明

使用 Vercel 環境變數的優點：

- **安全**：API Key 不會暴露在前端代碼中
- **統一**：所有用戶共享同一個配置，無需個別設定
- **管理**：集中管理，易於更新和維護
- **合規**：符合安全最佳實踐

## 📞 技術支援

如果遇到問題：

1. 檢查瀏覽器控制台的完整錯誤訊息
2. 確認嚴格按照以上步驟設定
3. 等待部署完成後再測試
4. 如需協助，請提供具體的錯誤截圖