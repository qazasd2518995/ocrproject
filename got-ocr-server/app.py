"""
GOT-OCR2.0 API 伺服器
需要 NVIDIA GPU 和至少 8GB VRAM
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import os
import tempfile
from PIL import Image
import torch
from transformers import AutoModel, AutoTokenizer
import logging

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允許跨域請求

# 全域變數
model = None
tokenizer = None

def initialize_model():
    """初始化 GOT-OCR2.0 模型"""
    global model, tokenizer
    
    try:
        logger.info("正在載入 GOT-OCR2.0 模型...")
        
        # 檢查是否有 GPU
        if not torch.cuda.is_available():
            logger.warning("警告：未檢測到 NVIDIA GPU，模型將在 CPU 上運行（速度會很慢）")
            device_map = 'cpu'
        else:
            device_map = 'cuda'
            logger.info(f"檢測到 GPU: {torch.cuda.get_device_name(0)}")
        
        # 載入 tokenizer 和模型
        tokenizer = AutoTokenizer.from_pretrained(
            'ucaslcl/GOT-OCR2_0', 
            trust_remote_code=True
        )
        
        model = AutoModel.from_pretrained(
            'ucaslcl/GOT-OCR2_0',
            trust_remote_code=True,
            low_cpu_mem_usage=True,
            device_map=device_map,
            use_safetensors=True,
            pad_token_id=tokenizer.eos_token_id
        )
        
        if torch.cuda.is_available():
            model = model.eval().cuda()
        else:
            model = model.eval()
        
        logger.info("模型載入完成！")
        return True
        
    except Exception as e:
        logger.error(f"模型載入失敗: {str(e)}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查端點"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'gpu_available': torch.cuda.is_available()
    })

@app.route('/ocr', methods=['POST'])
def perform_ocr():
    """執行 OCR"""
    try:
        if model is None:
            return jsonify({'error': '模型尚未載入'}), 500
        
        # 獲取請求數據
        data = request.json
        image_base64 = data.get('image')
        ocr_type = data.get('ocr_type', 'ocr')  # 預設使用純文字 OCR
        
        if not image_base64:
            return jsonify({'error': '未提供圖片'}), 400
        
        # 解碼 base64 圖片
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes))
        
        # 儲存為臨時檔案（GOT-OCR 需要檔案路徑）
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
            image.save(tmp_file.name)
            temp_path = tmp_file.name
        
        try:
            logger.info(f"執行 OCR，類型: {ocr_type}")
            
            # 根據不同的 OCR 類型執行
            if ocr_type == 'format':
                # 格式化文字 OCR
                result = model.chat(tokenizer, temp_path, ocr_type='format')
            elif ocr_type == 'multi-crop':
                # 多區域裁切 OCR
                result = model.chat_crop(tokenizer, temp_path, ocr_type='ocr')
            elif ocr_type == 'format-render':
                # 格式化並渲染
                render_file = tempfile.mktemp(suffix='.html')
                result = model.chat(tokenizer, temp_path, ocr_type='format', 
                                  render=True, save_render_file=render_file)
                # 讀取渲染的 HTML
                if os.path.exists(render_file):
                    with open(render_file, 'r', encoding='utf-8') as f:
                        render_html = f.read()
                    os.remove(render_file)
                else:
                    render_html = None
            else:
                # 預設純文字 OCR
                result = model.chat(tokenizer, temp_path, ocr_type='ocr')
                render_html = None
            
            # 清理臨時檔案
            os.remove(temp_path)
            
            response = {
                'success': True,
                'text': result,
                'ocr_type': ocr_type
            }
            
            if ocr_type == 'format-render' and render_html:
                response['render_html'] = render_html
            
            return jsonify(response)
            
        except Exception as e:
            # 確保清理臨時檔案
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
            
    except Exception as e:
        logger.error(f"OCR 錯誤: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/ocr/advanced', methods=['POST'])
def perform_advanced_ocr():
    """執行進階 OCR（支援框選、顏色等）"""
    try:
        if model is None:
            return jsonify({'error': '模型尚未載入'}), 500
        
        data = request.json
        image_base64 = data.get('image')
        ocr_type = data.get('ocr_type', 'ocr')
        ocr_box = data.get('ocr_box', '')  # 框選區域
        ocr_color = data.get('ocr_color', '')  # 顏色過濾
        
        if not image_base64:
            return jsonify({'error': '未提供圖片'}), 400
        
        # 解碼圖片
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes))
        
        # 儲存臨時檔案
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
            image.save(tmp_file.name)
            temp_path = tmp_file.name
        
        try:
            # 執行進階 OCR
            if ocr_box:
                result = model.chat(tokenizer, temp_path, ocr_type=ocr_type, ocr_box=ocr_box)
            elif ocr_color:
                result = model.chat(tokenizer, temp_path, ocr_type=ocr_type, ocr_color=ocr_color)
            else:
                result = model.chat(tokenizer, temp_path, ocr_type=ocr_type)
            
            os.remove(temp_path)
            
            return jsonify({
                'success': True,
                'text': result,
                'ocr_type': ocr_type,
                'ocr_box': ocr_box,
                'ocr_color': ocr_color
            })
            
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
            
    except Exception as e:
        logger.error(f"進階 OCR 錯誤: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # 初始化模型
    if initialize_model():
        logger.info("啟動 Flask 伺服器...")
        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        logger.error("無法啟動伺服器：模型載入失敗")