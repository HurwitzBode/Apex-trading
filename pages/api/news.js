// APEX — Live News API Route
// Fetches Yahoo Finance RSS server-side — no third-party limits, no CORS issues

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;
  if (!symbol || typeof symbol !== 'string' || symbol.length > 20) {
    return res.status(400).json({ error: 'Invalid symbol' });
  }

  // Sanitize symbol — only allow alphanumeric, dots, hyphens, carets
  const clean = symbol.replace(/[^a-zA-Z0-9.\-^=]/g, '');

  // Cache header — 5 minutes on CDN edge
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  try {
    const items = await fetchRssItems(clean);

    // Fallback to broad market news if ticker-specific returns nothing
    if (!items.length) {
      const fallback = await fetchRssItems('%5EGSPC'); // S&P 500
      return res.status(200).json({ items: fallback, source: 'market' });
    }

    return res.status(200).json({ items, source: 'ticker' });
  } catch (err) {
    console.error('[APEX News]', err);
    return res.status(500).json({ error: 'Failed to fetch news' });
  }
}

async function fetchRssItems(symbol) {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}&region=IN&lang=en-US`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; APEX/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!r.ok) return [];

    const xml = await r.text();
    return parseRss(xml);
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

function parseRss(xml) {
  // Lightweight XML parser — no dependencies needed
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title   = extractTag(block, 'title');
    const link    = extractTag(block, 'link') || extractCdata(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const source  = extractTag(block, 'source') || extractAttr(block, 'source', 'url') || 'Yahoo Finance';

    if (title) {
      items.push({
        h:   decodeHtmlEntities(title),
        url: link ? link.trim() : null,
        t:   pubDate ? formatDate(pubDate) : '',
        src: decodeHtmlEntities(source) || 'Yahoo Finance',
      });
    }
    if (items.length >= 8) break;
  }

  return items;
}

function extractTag(xml, tag) {
  // Handle both plain and CDATA
  const cdataMatch = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i').exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i').exec(xml);
  if (plainMatch) return plainMatch[1].trim();
  return null;
}

function extractCdata(xml, tag) {
  const m = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i').exec(xml);
  return m ? m[1].trim() : null;
}

function extractAttr(xml, tag, attr) {
  const m = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i').exec(xml);
  return m ? m[1] : null;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}
