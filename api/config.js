// 簡單的配置端點
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const groqApiKey = process.env.GROQ_API_KEY;

    res.status(200).json({
        success: true,
        config: {
            GROQ_API_KEY: groqApiKey || null
        },
        hasValidKey: !!groqApiKey,
        timestamp: new Date().toISOString()
    });
}