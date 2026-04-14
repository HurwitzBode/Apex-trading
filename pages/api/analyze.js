// APEX — Claude AI Analysis API Route
// Works locally (npm run dev) and on Vercel automatically

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const CLAUDE_KEY = process.env.CLAUDE_API_KEY ||
      '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';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages,
      }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (err) {
    console.error('[APEX AI]', err);
    return res.status(500).json({ error: err.message });
  }
}
