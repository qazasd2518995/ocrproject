module.exports = function handler(req, res) {
  // 簡單的環境變數 API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const groqKey = process.env.GROQ_API_KEY;
  
  res.json({
    groq_available: !!groqKey,
    key_preview: groqKey ? `${groqKey.substring(0, 8)}...${groqKey.slice(-4)}` : null,
    timestamp: new Date().toISOString()
  });
}