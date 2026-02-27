#!/usr/bin/env node
/**
 * Squish3D — local proxy server
 * Serves the HTML and proxies Anthropic API calls (keeps your key server-side)
 *
 * Setup:
 *   1. Set your API key below (or via env: ANTHROPIC_API_KEY=sk-... node server.js)
 *   2. Run:  node server.js
 *   3. Open: http://localhost:3000
 *
 * No npm install needed — uses only Node built-ins.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // CORS headers — allow the browser page to call back to this server
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── Proxy: POST /api → Anthropic ──────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const proxy = https.request(options, apiRes => {
        res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
        apiRes.pipe(res);
      });

      proxy.on('error', err => {
        console.error('Anthropic API error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });

      proxy.write(body);
      proxy.end();
    });
    return;
  }

  // ── Static files ───────────────────────────────────────────────────────────
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🍬 doodl3d running at http://localhost:${PORT}\n`);
});