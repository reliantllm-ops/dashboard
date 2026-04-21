#!/usr/bin/env node
/*
 * Local debug log server for the dashboard + chart builder.
 *
 * Usage:
 *   node debug-server.js
 *
 * Listens on http://localhost:8765 and accepts two kinds of POSTs:
 *   - POST /log       body = JSON log entry; appended to debug-log.jsonl
 *   - POST /snapshot  body = { html, metrics, ... }; overwrites debug-snapshot.json
 *
 * GET /tail?n=50      returns the last N log entries as JSON (for ad-hoc reading).
 *
 * CORS: allows any origin so the page JS can hit it.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8765;
const LOG_PATH = path.join(__dirname, 'debug-log.jsonl');
const SNAPSHOT_PATH = path.join(__dirname, 'debug-snapshot.json');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 5_000_000) reject(new Error('body too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  try {
    if (req.method === 'POST' && req.url === '/log') {
      const body = await readBody(req);
      const line = body.trim() + '\n';
      fs.appendFileSync(LOG_PATH, line);
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/snapshot') {
      const body = await readBody(req);
      fs.writeFileSync(SNAPSHOT_PATH, body);
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/tail')) {
      const url = new URL(req.url, 'http://localhost');
      const n = Math.max(1, Math.min(500, parseInt(url.searchParams.get('n') || '50', 10)));
      let lines = [];
      if (fs.existsSync(LOG_PATH)) {
        const raw = fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean);
        lines = raw.slice(-n);
      }
      res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end('[' + lines.join(',') + ']');
      return;
    }

    if (req.method === 'POST' && req.url === '/clear') {
      fs.writeFileSync(LOG_PATH, '');
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    res.writeHead(404, CORS_HEADERS);
    res.end('Not Found');
  } catch (err) {
    console.error(err);
    res.writeHead(500, CORS_HEADERS);
    res.end(String(err));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[debug-server] listening on http://localhost:${PORT}`);
  console.log(`[debug-server] logs -> ${LOG_PATH}`);
  console.log(`[debug-server] snapshot -> ${SNAPSHOT_PATH}`);
});
