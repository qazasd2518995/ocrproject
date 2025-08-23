// 免費 LLM 發票格式化模組
// 支援多種免費 LLM 服務：Hugging Face, Groq, Cohere, AI21, DeepInfra, Together, Replicate

class FreeLLMInvoiceFormatter {
    constructor() {
        this.isEnabled = true;
        this.provider = 'groq'; // 預設使用 Groq (免費且快速)
        this.apiKeys = this.loadAPIKeys();
        this.models = this.getAvailableModels();
        this.selectedModel = this.loadSelectedModel();
        this.initializeSettings();
    }

    initializeSettings() {
        // 固定設定，不依賴 localStorage
        this.isEnabled = true;
        this.provider = 'groq';
    }

    loadAPIKeys() {
        return {
            huggingface: this.getAPIKey('huggingface'),
            cohere: this.getAPIKey('cohere'),
            ai21: this.getAPIKey('ai21'),
            groq: this.getAPIKey('groq'),
            deepinfra: this.getAPIKey('deepinfra'),
            together: this.getAPIKey('together'),
            replicate: this.getAPIKey('replicate')
        };
    }

    // 從 Vercel 環境變數獲取 API Key
    getAPIKey(provider) {
        // 檢查全域變數（從 Vercel API 載入的環境變數）
        if (typeof window !== 'undefined' && window.ENV_VARS) {
            const envKey = window.ENV_VARS[`${provider.toUpperCase()}_API_KEY`];
            if (envKey && envKey.trim() !== '') {
                return envKey;
            }
        }

        // 如果沒有找到環境變數
        console.warn(`⚠️ 未找到 ${provider.toUpperCase()}_API_KEY 環境變數`);
        return '';
    }

    loadSelectedModel() {
        // 固定使用最強的 Groq 模型
        return 'llama3-70b-8192';
    }

    getAvailableModels() {
        return {
            huggingface: [
                { id: 'microsoft/DialoGPT-large', name: 'DialoGPT Large', cost: 'free' },
                { id: 'HuggingFaceH4/zephyr-7b-beta', name: 'Zephyr 7B Beta', cost: 'free' },
                { id: 'mistralai/Mistral-7B-Instruct-v0.1', name: 'Mistral 7B Instruct', cost: 'free' }
            ],
            groq: [
                { id: 'llama3-70b-8192', name: 'Llama 3 70B (最強推薦)', cost: 'free' },
                { id: 'llama3-8b-8192', name: 'Llama 3 8B (快速)', cost: 'free' },
                { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', cost: 'free' },
                { id: 'gemma-7b-it', name: 'Gemma 7B IT', cost: 'free' }
            ],
            cohere: [
                { id: 'command', name: 'Command (通用)', cost: 'free_trial' },
                { id: 'command-light', name: 'Command Light (快速)', cost: 'free_trial' }
            ],
            ai21: [
                { id: 'j2-light', name: 'Jurassic-2 Light', cost: 'free_trial' },
                { id: 'j2-mid', name: 'Jurassic-2 Mid', cost: 'free_trial' }
            ],
            deepinfra: [
                { id: 'meta-llama/Llama-2-70b-chat-hf', name: 'Llama 2 70B Chat', cost: 'free' },
                { id: 'codellama/CodeLlama-34b-Instruct-hf', name: 'Code Llama 34B', cost: 'free' }
            ],
            together: [
                { id: 'togethercomputer/llama-2-70b-chat', name: 'Llama 2 70B Chat', cost: 'free_credits' },
                { id: 'mistralai/Mistral-7B-Instruct-v0.1', name: 'Mistral 7B Instruct', cost: 'free_credits' }
            ],
            replicate: [
                { id: 'meta/llama-2-70b-chat', name: 'Llama 2 70B Chat', cost: 'free_credits' },
                { id: 'mistralai/mistral-7b-instruct-v0.1', name: 'Mistral 7B', cost: 'free_credits' }
            ]
        };
    }

    // 主要格式化函數
    async formatInvoiceText(rawText) {
        if (!this.isEnabled) {
            return rawText;
        }

        // 重新載入 API Keys（可能在運行時已更新）
        this.apiKeys = this.loadAPIKeys();

        try {
            console.log('🤖 免費 LLM 發票格式化開始...');
            console.log('使用供應商:', this.provider);
            console.log('使用模型:', this.selectedModel);
            
            let formattedText;
            switch (this.provider) {
                case 'groq':
                    formattedText = await this.callGroq(rawText);
                    break;
                case 'huggingface':
                    formattedText = await this.callHuggingFace(rawText);
                    break;
                case 'cohere':
                    formattedText = await this.callCohere(rawText);
                    break;
                case 'ai21':
                    formattedText = await this.callAI21(rawText);
                    break;
                case 'deepinfra':
                    formattedText = await this.callDeepInfra(rawText);
                    break;
                case 'together':
                    formattedText = await this.callTogether(rawText);
                    break;
                case 'replicate':
                    formattedText = await this.callReplicate(rawText);
                    break;
                default:
                    throw new Error('不支援的供應商: ' + this.provider);
            }
            
            return formattedText;
            
        } catch (error) {
            console.error('❌ 免費 LLM 格式化錯誤:', error);
            return this.fallbackFormat(rawText, error.message);
        }
    }

    // 建立智能提示詞
    createPrompt(rawText) {
        return `請將以下OCR辨識的發票文字整理成簡化格式，只提取貨品編號和規格。

OCR原始文字：
"""
${rawText}
"""

請按照以下要求整理：
1. 識別所有商品項目
2. 對每個項目只提取：貨品編號、品名規格
3. 使用繁體中文
4. 格式要清晰易讀
5. 忽略數量、單價、金額等資訊

輸出格式：
📋 發票明細
════════════════════════════════════

項目 1：
• 貨品編號：[編號]
• 品名規格：[完整品名規格]

項目 2：
• 貨品編號：[編號]
• 品名規格：[完整品名規格]

────────────────────────────────────
📦 共 [項目數] 項商品
⚡ 由 ${this.provider.toUpperCase()} ${this.selectedModel} 處理

只輸出整理後的發票，不要額外說明。`;
    }

    // Groq API 調用（最推薦：免費、快速、準確）
    async callGroq(rawText) {
        if (!this.apiKeys.groq) {
            throw new Error('請先設定 Groq API Key');
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKeys.groq}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.selectedModel,
                messages: [
                    {
                        role: 'system',
                        content: '你是專業的台灣發票處理助手，擅長整理和格式化發票資料。'
                    },
                    {
                        role: 'user',
                        content: this.createPrompt(rawText)
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Groq API 錯誤: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // Hugging Face API 調用
    async callHuggingFace(rawText) {
        if (!this.apiKeys.huggingface) {
            throw new Error('請先設定 Hugging Face API Key');
        }

        const response = await fetch(`https://api-inference.huggingface.co/models/${this.selectedModel}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKeys.huggingface}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: this.createPrompt(rawText),
                parameters: {
                    max_length: 1000,
                    temperature: 0.3
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Hugging Face API 錯誤: ${error.error || response.statusText}`);
        }

        const data = await response.json();
        return data[0]?.generated_text || data.generated_text || '處理失敗';
    }

    // Cohere API 調用
    async callCohere(rawText) {
        if (!this.apiKeys.cohere) {
            throw new Error('請先設定 Cohere API Key');
        }

        const response = await fetch('https://api.cohere.ai/v1/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKeys.cohere}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.selectedModel,
                prompt: this.createPrompt(rawText),
                max_tokens: 1000,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Cohere API 錯誤: ${error.message || response.statusText}`);
        }

        const data = await response.json();
        return data.generations[0].text;
    }

    // AI21 API 調用
    async callAI21(rawText) {
        if (!this.apiKeys.ai21) {
            throw new Error('請先設定 AI21 API Key');
        }

        const response = await fetch(`https://api.ai21.com/studio/v1/${this.selectedModel}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKeys.ai21}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: this.createPrompt(rawText),
                maxTokens: 1000,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`AI21 API 錯誤: ${error.message || response.statusText}`);
        }

        const data = await response.json();
        return data.completions[0].data.text;
    }

    // DeepInfra API 調用
    async callDeepInfra(rawText) {
        if (!this.apiKeys.deepinfra) {
            throw new Error('請先設定 DeepInfra API Key');
        }

        const response = await fetch(`https://api.deepinfra.com/v1/openai/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKeys.deepinfra}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.selectedModel,
                messages: [
                    {
                        role: 'user',
                        content: this.createPrompt(rawText)
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`DeepInfra API 錯誤: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // Together API 調用
    async callTogether(rawText) {
        if (!this.apiKeys.together) {
            throw new Error('請先設定 Together API Key');
        }

        const response = await fetch('https://api.together.xyz/inference', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKeys.together}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.selectedModel,
                prompt: this.createPrompt(rawText),
                max_tokens: 1000,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Together API 錯誤: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.output.choices[0].text;
    }

    // Replicate API 調用
    async callReplicate(rawText) {
        if (!this.apiKeys.replicate) {
            throw new Error('請先設定 Replicate API Key');
        }

        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${this.apiKeys.replicate}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                version: this.selectedModel,
                input: {
                    prompt: this.createPrompt(rawText),
                    max_length: 1000,
                    temperature: 0.3
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Replicate API 錯誤: ${error.detail || response.statusText}`);
        }

        const data = await response.json();
        // Replicate 是異步的，這裡簡化處理
        return data.output || '處理中...請稍後重試';
    }

    // 降級格式化
    fallbackFormat(text, errorMsg) {
        const isAPIKeyError = errorMsg.includes('API Key') || errorMsg.includes('Authorization') || errorMsg.includes('401');
        
        let suggestions = '';
        if (isAPIKeyError) {
            suggestions = `💡 需要設定 Vercel 環境變數：

📋 設定步驟：
1. 前往 Vercel Dashboard
2. 選擇您的專案  
3. 進入 Settings → Environment Variables
4. 新增變數：GROQ_API_KEY = your_api_key
5. 重新部署專案

🔗 取得免費 Groq API Key：https://console.groq.com`;
        } else {
            suggestions = `💡 建議：
1. 檢查網路連接
2. 稍後重試  
3. 檢查 Vercel 環境變數設定`;
        }

        return `📋 發票內容（AI 處理失敗，顯示原始 OCR 結果）
════════════════════════════════════════════

${text}

────────────────────────────────────────────
⚠️ 錯誤：${errorMsg}

${suggestions}`;
    }

    // 測試連接
    async testConnection() {
        try {
            const testText = '測試商品\\n數量：1個\\n價格：100元';
            const result = await this.formatInvoiceText(testText);
            if (result && result !== testText) {
                return { success: true, message: '✅ 連接成功！LLM 正常工作' };
            } else {
                return { success: false, message: '⚠️ 連接成功但無回應' };
            }
        } catch (error) {
            return { success: false, message: '❌ 連接失敗：' + error.message };
        }
    }
}

// 創建全域實例
window.freeLLMFormatter = new FreeLLMInvoiceFormatter();

console.log('🚀 免費 LLM 格式化器已載入！支援 7 種免費服務');
console.log('💡 推薦使用 Groq（免費且快速）：localStorage.setItem("groq_api_key", "your_groq_key")');