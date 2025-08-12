#!/bin/bash

echo "========================================="
echo "GOT-OCR2.0 伺服器啟動腳本"
echo "========================================="

# 檢查 Python 版本
python3 --version

# 檢查是否有虛擬環境
if [ ! -d "venv" ]; then
    echo "建立虛擬環境..."
    python3 -m venv venv
fi

# 啟用虛擬環境
source venv/bin/activate

# 安裝依賴
echo "安裝依賴套件..."
pip install -r requirements.txt

# 檢查 GPU
python3 -c "import torch; print(f'GPU 可用: {torch.cuda.is_available()}'); print(f'GPU 名稱: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"無\"}')"

# 啟動伺服器
echo "啟動 GOT-OCR2.0 伺服器..."
python3 app.py