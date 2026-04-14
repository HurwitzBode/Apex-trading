// APEX — Local Dev Server
// Serves static files AND proxies Claude API calls (no CORS issues)
// Run with: node server.js

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT       = 8080;
const CLAUDE_KEY = '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';

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);

  // ── CORS headers for all responses ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── /api/analyze — proxy to Claude ──
  if (req.method === 'POST' && parsed.pathname === '/api/analyze') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const postData = JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages:   payload.messages,
      });

      const options = {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers: {
          'x-api-key':         CLAUDE_KEY,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
          'content-length':    Buffer.byteLength(postData),
        },
      };

      const proxyReq = https.request(options, proxyRes => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
        });
      });

      proxyReq.on('error', err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });

      proxyReq.write(postData);
      proxyReq.end();
    });
    return;
  }

  // ── Static file serving ──
  let filePath = path.join(__dirname, parsed.pathname === '/' ? 'index.html' : parsed.pathname);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n  APEX running at http://localhost:${PORT}`);
  console.log(`  Auth     → http://localhost:${PORT}/auth.html`);
  console.log(`  Dashboard→ http://localhost:${PORT}/dashboard.html`);
  console.log(`  Claude   → proxied via /api/analyze\n`);
});
