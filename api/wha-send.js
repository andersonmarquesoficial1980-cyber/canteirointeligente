export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { number, text, conversation_id } = req.body;
    
    const resp = await fetch('http://216.238.123.122:3000/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, text, conversation_id }),
    });
    
    const data = await resp.json();
    res.status(resp.ok ? 200 : 500).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
