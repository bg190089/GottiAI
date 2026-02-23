export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' });

  try {
    const { system, userMsg, images } = req.body;
    if (!userMsg) return res.status(400).json({ error: 'userMsg obrigatório' });

    // Suporta: só texto, só arquivos, ou texto + arquivos juntos
    let userContent;
    if (images && images.length > 0) {
      const parts = [];
      for (const img of images) {
        if (img.type === 'application/pdf') {
          parts.push({ type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: img.base64 } });
        } else {
          const mt = img.type && img.type.startsWith('image/') ? img.type : 'image/jpeg';
          parts.push({ type: 'image',
            source: { type: 'base64', media_type: mt, data: img.base64 } });
        }
      }
      parts.push({ type: 'text', text: userMsg });
      userContent = parts;
    } else {
      userContent = userMsg;
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: system || '',
        messages: [{ role: 'user', content: userContent }]
      })
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: err?.error?.message || r.statusText });
    }

    const data    = await r.json();
    const content = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return res.status(200).json({ content });
  } catch (e) {
    console.error('generate error:', e);
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
}
