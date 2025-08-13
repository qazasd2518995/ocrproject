// 統一的歷史記錄 API
// 使用 Vercel KV (Redis) 或記憶體快取

// 記憶體快取（僅開發用 - 生產環境請使用 Vercel KV）
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
  
  // Debug logging
  console.log('🔍 API Request:', {
    method: req.method,
    action: action,
    username: username,
    bodyKeys: Object.keys(req.body || {}),
    hasRecord: !!(req.body && req.body.record)
  });

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  const storageKey = `history:${username}`;
  console.log('🔑 Storage key:', storageKey);

  try {
    switch (action) {
      case 'list':
        // 獲取歷史記錄
        const history = await getHistory(storageKey);
        console.log(`📚 Returning ${history.length} records for user ${username}`);
        return res.status(200).json({ success: true, data: history });

      case 'add':
        // 添加新記錄
        if (!req.body.record) {
          return res.status(400).json({ error: 'Record required' });
        }
        
        const currentHistory = await getHistory(storageKey);
        console.log(`📝 Current history has ${currentHistory.length} records`);
        
        const newRecord = {
          ...req.body.record,
          id: req.body.record.id || Date.now().toString(),
          date: req.body.record.date || new Date().toISOString(),
          syncedAt: new Date().toISOString()
        };
        
        console.log(`➕ Adding new record:`, {
          id: newRecord.id,
          fileName: newRecord.fileName,
          user: username
        });
        
        currentHistory.unshift(newRecord);
        
        // 限制最多 100 筆
        if (currentHistory.length > 100) {
          currentHistory.splice(100);
        }
        
        await saveHistory(storageKey, currentHistory);
        console.log(`✅ Saved! Now has ${currentHistory.length} records`);
        
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
        console.log(`🗑️ Clearing all records for ${storageKey}`);
        await saveHistory(storageKey, []);
        
        // 驗證清除是否成功
        const verifyEmpty = await getHistory(storageKey);
        console.log(`🗑️ After clear, found ${verifyEmpty.length} records`);
        
        if (verifyEmpty.length > 0) {
          console.error(`❌ Clear failed! Still have ${verifyEmpty.length} records`);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to clear history - records still exist',
            remainingCount: verifyEmpty.length
          });
        }
        
        return res.status(200).json({ 
          success: true, 
          message: 'History cleared',
          verifiedEmpty: true
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
  // 優先使用 Vercel KV
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    console.log('🗄️ Using Vercel KV Storage');
    try {
      const { kv } = await import('@vercel/kv');
      const data = await kv.get(key);
      if (data) {
        console.log(`🗄️ Found ${data.length} records in KV Storage for ${key}`);
        return data;
      }
      console.log('🗄️ No data found in KV, returning empty array');
      return [];
    } catch (error) {
      console.error('🗄️ KV error:', error.message);
      // 如果 KV 失敗，嘗試 Blob Storage
    }
  }
  
  // 備用方案：Vercel Blob Storage
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('🗄️ Using Vercel Blob Storage (fallback)');
    try {
      // 使用 head 方法直接檢查 blob
      const { head } = await import('@vercel/blob');
      
      try {
        // 嘗試獲取 blob 的 metadata
        const blobDetails = await head(key);
        console.log(`🗄️ Found blob ${key} with URL: ${blobDetails.url}`);
        console.log(`  Size: ${blobDetails.size} bytes`);
        
        // 使用 URL 直接讀取內容
        const response = await fetch(blobDetails.url);
        const text = await response.text();
        const data = JSON.parse(text);
        console.log(`🗄️ Successfully loaded ${data.length} records from Blob Storage`);
        return data;
      } catch (headError) {
        // 如果 blob 不存在，返回空陣列
        console.log(`🗄️ No blob found for key: ${key}`);
        return [];
      }
    } catch (error) {
      console.error('🗄️ Blob Storage error:', error.message);
      return [];
    }
  }
  
  // 最後選擇：記憶體快取（僅供本地開發）
  console.log('💾 Using memory cache (dev mode - data will not persist!)');
  const data = memoryCache.get(key) || [];
  console.log(`💾 Found ${data.length} records in memory for ${key}`);
  return data;
}

async function saveHistory(key, data) {
  // 優先使用 Vercel KV
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    console.log(`🗄️ Saving ${data.length} records to KV Storage for ${key}`);
    try {
      const { kv } = await import('@vercel/kv');
      await kv.set(key, data);
      console.log('✅ Successfully saved to KV Storage');
      return;
    } catch (error) {
      console.error('❌ KV save error:', error.message);
      // 如果 KV 失敗，嘗試 Blob Storage
    }
  }
  
  // 備用方案：Vercel Blob Storage
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    console.log(`🗄️ Saving ${data.length} records to Blob Storage for ${key} (fallback)`);
    try {
      const { put, del, head } = await import('@vercel/blob');
      
      // 如果資料為空（清除操作），只刪除 blob
      if (data.length === 0) {
        try {
          await del(key);
          console.log(`🗑️ Deleted blob for ${key} (cleared history)`);
        } catch (delError) {
          console.log(`🗑️ No blob to delete for ${key}`);
        }
        
        // 驗證刪除
        try {
          await head(key);
          console.error(`❌ Blob still exists after deletion!`);
        } catch (verifyError) {
          console.log(`✅ Verified: Blob successfully deleted`);
        }
        
        return;
      }
      
      // 有資料時，先刪除舊的再建立新的
      try {
        await del(key);
        console.log(`🔄 Deleted old blob for ${key}`);
      } catch (delError) {
        // 忽略刪除錯誤（blob 可能不存在）
      }
      
      // 建立新的 blob
      const result = await put(key, JSON.stringify(data), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false
      });
      
      console.log(`✅ Successfully saved to Blob Storage`);
      console.log(`  URL: ${result.url}`);
      console.log(`  Pathname: ${result.pathname}`);
      
      // 驗證儲存
      try {
        const verifyBlob = await head(key);
        console.log(`✅ Verified: Blob exists with size ${verifyBlob.size} bytes`);
      } catch (verifyError) {
        console.error(`❌ Verification failed: Cannot find blob after save!`);
      }
      
      return;
    } catch (error) {
      console.error('❌ Blob save error:', error.message);
      throw error;
    }
  }
  
  // 最後選擇：記憶體快取（僅供本地開發）
  console.log(`💾 Saving ${data.length} records to memory cache for ${key} (dev mode - data will not persist!)`);
  memoryCache.set(key, data);
  
  // 顯示目前所有用戶的記錄數量（調試用）
  console.log('📊 Current memory cache status:');
  for (const [k, v] of memoryCache.entries()) {
    console.log(`  - ${k}: ${v.length} records`);
  }
}