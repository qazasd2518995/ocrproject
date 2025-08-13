# 設定 Vercel 持久化儲存（重要！）

## 問題診斷
目前的問題是 API 使用記憶體快取，在 Vercel 的無狀態環境中，每個請求可能在不同的實例上執行，導致資料無法在裝置間共享。

## 解決方案選項

### 選項 1：Vercel KV Storage（推薦）

#### 步驟 1：在 Vercel 專案中啟用 KV Storage

1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案
3. 點擊上方的 **Storage** 標籤
4. 點擊 **Create Database**
5. 選擇 **KV** (Redis)
6. 輸入資料庫名稱（例如：`ocr-history`）
7. 選擇區域（建議選擇離您最近的區域）
8. 點擊 **Create**

#### 步驟 2：連接資料庫到專案

1. 建立資料庫後，點擊 **Connect Project**
2. 選擇您的專案
3. 選擇環境：**Production**, **Preview**, **Development**（全選）
4. 點擊 **Connect**

#### 步驟 3：驗證環境變數

Vercel 會自動設定以下環境變數：
- `KV_URL`
- `KV_REST_API_URL` 
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

### 選項 2：Vercel Blob Storage（備用方案）

如果您已經有 Blob Storage 或想使用它：

#### 步驟 1：啟用 Blob Storage

1. 在 Vercel Dashboard 的 Storage 頁面
2. 點擊 **Create Database**
3. 選擇 **Blob**
4. 設定名稱和區域
5. 點擊 **Create**

#### 步驟 2：連接到專案

1. 點擊 **Connect Project**
2. 選擇環境
3. 確認連接

#### 步驟 3：驗證環境變數

Vercel 會設定：
- `BLOB_READ_WRITE_TOKEN`

## API 優先順序

目前 API 已設定為按以下順序嘗試儲存方案：
1. **Vercel KV** - 如果有 KV 環境變數
2. **Vercel Blob** - 如果有 Blob 環境變數
3. **記憶體快取** - 僅供本地開發（資料不會持久化！）

## 部署步驟

環境變數設定完成後：
1. 提交並推送程式碼到 GitHub
2. Vercel 會自動觸發重新部署
3. 等待部署完成（約 1-2 分鐘）

## 驗證設定

部署完成後測試：
1. 在手機上上傳並進行 OCR
2. 在電腦上登入查看歷史記錄
3. 讓朋友在不同裝置登入測試
4. 記錄應該會正確同步

## 查看日誌

在 Vercel Dashboard：
1. 進入專案
2. 點擊 **Functions** 標籤
3. 選擇 `api/history`
4. 查看 **Logs** 確認使用的儲存類型

您應該看到：
- `🗄️ Using Vercel KV Storage` - 表示使用 KV（最佳）
- `🗄️ Using Vercel Blob Storage` - 表示使用 Blob（次佳）
- `💾 Using memory cache` - 表示仍在使用記憶體（需要設定儲存）

## 免費額度

### Vercel KV
- 30,000 個請求/月
- 256MB 儲存空間

### Vercel Blob
- 100GB 頻寬/月
- 5GB 儲存空間

兩者都足夠一般使用。

## 故障排除

如果設定後仍有問題：

1. **檢查環境變數**
   - Vercel Dashboard → Settings → Environment Variables
   - 確認 KV 或 Blob 相關變數已設定

2. **檢查日誌錯誤**
   - 查看 Functions 日誌
   - 尋找 `KV error` 或 `Blob error` 訊息

3. **清除瀏覽器快取**
   - 清除本地儲存
   - 重新登入測試

4. **確認跨裝置同步**
   - 使用不同瀏覽器或無痕模式測試
   - 確認資料能在不同裝置間同步