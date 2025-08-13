// 統一的歷史記錄 API
// 使用 Vercel Blob Storage 或記憶體快取

// 記憶體快取（開發用）
const memoryCache = new Map();

export default async function handler(req, res) {
  // 設定 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;
  const { username } = req.body || req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  const storageKey = `history:${username}`;

  try {
    switch (action) {
      case 'list':
        // 獲取歷史記錄
        const history = await getHistory(storageKey);
        return res.status(200).json({ success: true, data: history });

      case 'add':
        // 添加新記錄
        if (!req.body.record) {
          return res.status(400).json({ error: 'Record required' });
        }
        
        const currentHistory = await getHistory(storageKey);
        const newRecord = {
          ...req.body.record,
          id: Date.now().toString(),
          date: new Date().toISOString(),
          syncedAt: new Date().toISOString()
        };
        
        currentHistory.unshift(newRecord);
        
        // 限制最多 100 筆
        if (currentHistory.length > 100) {
          currentHistory.splice(100);
        }
        
        await saveHistory(storageKey, currentHistory);
        return res.status(200).json({ 
          success: true, 
          message: 'History added',
          record: newRecord 
        });

      case 'delete':
        // 刪除單筆記錄
        const { recordId } = req.body;
        if (!recordId) {
          return res.status(400).json({ error: 'Record ID required' });
        }
        
        const historyToUpdate = await getHistory(storageKey);
        const filtered = historyToUpdate.filter(r => r.id !== recordId);
        await saveHistory(storageKey, filtered);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Record deleted' 
        });

      case 'clear':
        // 清除所有記錄
        await saveHistory(storageKey, []);
        return res.status(200).json({ 
          success: true, 
          message: 'History cleared' 
        });

      case 'sync':
        // 同步本地和雲端記錄
        const { localHistory } = req.body;
        const cloudHistory = await getHistory(storageKey);
        
        // 合併記錄（以時間戳為準，避免重複）
        const mergedMap = new Map();
        
        // 先加入雲端記錄
        cloudHistory.forEach(record => {
          mergedMap.set(record.id, record);
        });
        
        // 加入本地記錄（如果不存在）
        if (localHistory && Array.isArray(localHistory)) {
          localHistory.forEach(record => {
            if (!mergedMap.has(record.id)) {
              mergedMap.set(record.id, {
                ...record,
                syncedAt: new Date().toISOString()
              });
            }
          });
        }
        
        // 轉換回陣列並排序
        const merged = Array.from(mergedMap.values())
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 100); // 限制 100 筆
        
        await saveHistory(storageKey, merged);
        
        return res.status(200).json({ 
          success: true, 
          data: merged,
          message: 'History synced' 
        });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Server error' 
    });
  }
}

// 儲存函數
async function getHistory(key) {
  // 如果有 Vercel Blob Storage
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { get } = await import('@vercel/blob');
      const result = await get(key);
      if (result) {
        const text = await result.text();
        return JSON.parse(text);
      }
    } catch (error) {
      console.log('Blob not found, returning empty array');
    }
    return [];
  }
  
  // 否則使用記憶體快取（僅供開發）
  return memoryCache.get(key) || [];
}

async function saveHistory(key, data) {
  // 如果有 Vercel Blob Storage
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    await put(key, JSON.stringify(data), {
      access: 'public',
      contentType: 'application/json'
    });
    return;
  }
  
  // 否則使用記憶體快取（僅供開發）
  memoryCache.set(key, data);
}