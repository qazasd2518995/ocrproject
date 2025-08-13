// 添加歷史記錄
export default async function handler(req, res) {
  // 設定 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, record } = req.body;
    
    if (!username || !record) {
      return res.status(400).json({ error: 'Username and record required' });
    }

    // 獲取現有歷史記錄
    const history = await getHistoryFromStorage(username) || [];
    
    // 添加新記錄到開頭
    history.unshift({
      ...record,
      id: Date.now().toString(),
      date: new Date().toISOString()
    });
    
    // 限制最多 100 筆記錄
    if (history.length > 100) {
      history.splice(100);
    }
    
    // 儲存更新的歷史記錄
    await saveHistoryToStorage(username, history);
    
    return res.status(200).json({
      success: true,
      message: 'History added successfully'
    });
  } catch (error) {
    console.error('Error adding history:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to add history' 
    });
  }
}

// 儲存管理（示範用 - 實際需要使用 Vercel KV）
const storage = new Map();

async function getHistoryFromStorage(username) {
  // 實際部署時使用 Vercel KV:
  // const kv = process.env.KV_REST_API_URL ? await import('@vercel/kv') : null;
  // if (kv) {
  //   return await kv.get(`history:${username}`);
  // }
  
  return storage.get(`history:${username}`) || [];
}

async function saveHistoryToStorage(username, history) {
  // 實際部署時使用 Vercel KV:
  // const kv = process.env.KV_REST_API_URL ? await import('@vercel/kv') : null;
  // if (kv) {
  //   await kv.set(`history:${username}`, history, { ex: 30 * 24 * 60 * 60 }); // 30 天過期
  // }
  
  storage.set(`history:${username}`, history);
}