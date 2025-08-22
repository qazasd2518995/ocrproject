# Groq API Key 設定教學

## 🎯 快速設定（推薦方法）

### 在 Vercel 設定環境變數

1. **前往 Vercel Dashboard**
   - 訪問 [vercel.com](https://vercel.com)
   - 登入您的帳號

2. **選擇專案**
   - 找到您的 OCR 專案
   - 點擊進入專案設定

3. **設定環境變數**
   - 點擊 `Settings` 標籤
   - 選擇 `Environment Variables`
   - 點擊 `Add New` 按鈕

4. **新增 Groq API Key**
   ```
   Name: GROQ_API_KEY
   Value: your_groq_api_key_here
   Environment: All (Production, Preview, Development)
   ```

5. **重新部署**
   - 前往 `Deployments` 標籤
   - 點擊最新部署右側的 ⋯ 選單
   - 選擇 `Redeploy`

## 🔑 取得 Groq API Key

1. **前往 Groq Console**
   - 訪問 [console.groq.com](https://console.groq.com)
   - 使用 Google/GitHub 帳號註冊或登入

2. **創建 API Key**
   - 點擊左側選單的 `API Keys`
   - 點擊 `Create API Key` 按鈕
   - 輸入 Key 名稱（例如：OCR-System）
   - 複製生成的 API Key

⚠️ **重要**：API Key 只會顯示一次，請立即複製並安全保存！

## 🛠️ 替代方法（臨時測試）

如果您只是想快速測試功能，可以在瀏覽器中臨時設定：

```javascript
// 在瀏覽器控制台執行
localStorage.setItem('groq_api_key', 'your_groq_api_key_here');
```

然後重新載入頁面。

## 📊 Groq 免費額度

- **每月免費額度**：充足用於個人使用
- **速度**：業界最快的 LLM 推論
- **模型**：Llama 3 70B（最強開源模型）
- **無需信用卡**：註冊即可使用

## ✅ 驗證設定

設定完成後，系統會：

1. **自動檢測**：系統會自動偵測 API Key
2. **狀態顯示**：在瀏覽器控制台顯示連接狀態
3. **智能處理**：上傳發票後自動使用 AI 格式化

## 🐛 疑難排解

### 問題：顯示「請先設定 Groq API Key」

**解決方案**：
1. 確認 Vercel 環境變數名稱正確：`GROQ_API_KEY`
2. 確認 API Key 沒有多餘的空格
3. 重新部署專案讓環境變數生效
4. 檢查瀏覽器控制台的詳細錯誤訊息

### 問題：API Key 有效但仍然失敗

**檢查項目**：
1. 網路連接是否正常
2. Groq 服務是否可用
3. API Key 是否已達使用限制
4. 檢查 API Key 權限設定

## 📞 技術支援

如果遇到問題，請：
1. 檢查瀏覽器控制台的錯誤訊息
2. 確認按照以上步驟正確設定
3. 如需協助，請提供具體的錯誤訊息