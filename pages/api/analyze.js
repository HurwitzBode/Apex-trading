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

    // Hard cap on messages array to prevent abuse
    if (messages.length > 10) {
      return res.status(400).json({ error: 'Too many messages' });
    }

    // Validate each message has role + content string (no injected system prompts)
    for (const msg of messages) {
      if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({ error: 'Invalid message role' });
      }
      if (typeof msg.content !== 'string' || msg.content.length > 8000) {
        return res.status(400).json({ error: 'Invalid message content' });
      }
    }

    const CLAUDE_KEY = process.env.CLAUDE_API_KEY;
    if (!CLAUDE_KEY) {
      console.error('[APEX AI] CLAUDE_API_KEY env var not set');
      return res.status(500).json({ error: 'AI service not configured' });
    }

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
