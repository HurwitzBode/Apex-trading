// APEX — Yahoo Finance Chart + Quote Proxy
// Fetches OHLCV and price quote data server-side — no CORS proxies needed

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, symbol, symbols, interval, range } = req.query;

  // ── OHLCV chart data ──
  if (type === 'chart') {
    if (!symbol || typeof symbol !== 'string' || symbol.length > 30) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }
    const clean = symbol.replace(/[^a-zA-Z0-9.\-^=]/g, '');
    const iv    = (interval || '1d').replace(/[^a-zA-Z0-9]/g, '');
    const rng   = (range    || '6mo').replace(/[^a-zA-Z0-9]/g, '');

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?interval=${iv}&range=${rng}&includePrePost=false`;
      const data = await yfGet(url);
      // Cache 5 min on Vercel CDN edge
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      return res.status(200).json(data);
    } catch (err) {
      return res.status(502).json({ error: 'Failed to fetch chart data', detail: err.message });
    }
  }

  // ── Quote prices (watchlist) ──
  if (type === 'quote') {
    if (!symbols || typeof symbols !== 'string' || symbols.length > 200) {
      return res.status(400).json({ error: 'Invalid symbols' });
    }
    const clean = symbols.replace(/[^a-zA-Z0-9.,\-^=]/g, '');

    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(clean)}`;
      const data = await yfGet(url);
      // Cache 60s for quotes
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
      return res.status(200).json(data);
    } catch (err) {
      return res.status(502).json({ error: 'Failed to fetch quotes', detail: err.message });
    }
  }

  return res.status(400).json({ error: 'Missing type param (chart or quote)' });
}

async function yfGet(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(url, {
      headers: YF_HEADERS,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (!r.ok) throw new Error(`Yahoo Finance returned ${r.status}`);
    return await r.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
