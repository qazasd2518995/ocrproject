// 獲取歷史記錄列表
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
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    // 使用 Vercel KV 或 Edge Config
    // 這裡使用簡單的記憶體儲存作為示範（實際部署需要使用 Vercel KV）
    const history = await getHistoryFromStorage(username);
    
    return res.status(200).json({
      success: true,
      data: history || []
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch history' 
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
  
  // 暫時使用記憶體儲存
  return storage.get(`history:${username}`) || [];
}