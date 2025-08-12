# GOT-OCR2.0 本地伺服器

## ⚠️ 系統需求

### 必要條件：
- **NVIDIA GPU**（建議至少 8GB VRAM）
- **Python 3.10**
- **CUDA 11.7+**
- **至少 16GB RAM**

### 如果沒有 GPU：
- 可以在 CPU 上運行，但速度會**非常慢**（每張圖片可能需要 1-2 分鐘）
- 建議使用 Google Colab 或其他雲端 GPU 服務

## 📦 安裝步驟

### 1. 進入目錄
```bash
cd got-ocr-server
```

### 2. 安裝 Python 依賴
```bash
# 方法一：使用啟動腳本（推薦）
./start.sh

# 方法二：手動安裝
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 首次運行（下載模型）
第一次運行時會自動下載 GOT-OCR2.0 模型（約 1.5GB），請耐心等待。

```bash
python app.py
```

## 🚀 使用方式

### 啟動伺服器
```bash
./start.sh
# 或
python app.py
```

伺服器會在 `http://localhost:5000` 啟動

### API 端點

#### 1. 健康檢查
```
GET http://localhost:5000/health
```

#### 2. 基本 OCR
```
POST http://localhost:5000/ocr
Content-Type: application/json

{
  "image": "base64_encoded_image",
  "ocr_type": "ocr"  // 或 "format"
}
```

#### 3. 進階 OCR
```
POST http://localhost:5000/ocr/advanced
Content-Type: application/json

{
  "image": "base64_encoded_image",
  "ocr_type": "ocr",
  "ocr_box": "",  // 可選：框選區域
  "ocr_color": ""  // 可選：顏色過濾
}
```

## 🔧 OCR 類型說明

- **ocr**：純文字辨識
- **format**：保留格式的辨識（表格、佈局等）
- **multi-crop**：多區域裁切辨識
- **format-render**：格式化並生成 HTML

## 💻 整合到網頁

已準備好的整合檔案：
- `index-got.html`：支援 GOT-OCR2.0 的網頁介面
- `js/got-ocr-client.js`：與伺服器通訊的 JavaScript

## ⚡ 效能說明

| 硬體 | 速度 | 建議 |
|------|------|------|
| RTX 3090/4090 | 1-3 秒/張 | 最佳 |
| RTX 3070/3080 | 3-5 秒/張 | 良好 |
| RTX 3060 | 5-10 秒/張 | 可用 |
| CPU | 60-120 秒/張 | 不建議 |

## 🐛 常見問題

### 1. CUDA out of memory
- 降低圖片解析度
- 使用較小的批次大小
- 升級 GPU

### 2. 模型下載失敗
- 檢查網路連接
- 手動下載模型到 `~/.cache/huggingface/`

### 3. ImportError
- 確認 Python 版本為 3.10
- 重新安裝依賴：`pip install -r requirements.txt --upgrade`

## 📝 注意事項

1. **首次啟動較慢**：需要下載模型
2. **GPU 記憶體**：建議至少 8GB VRAM
3. **網路需求**：首次需要連網下載模型
4. **API 限制**：本地無限制，但受硬體性能影響