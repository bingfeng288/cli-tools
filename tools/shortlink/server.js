#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const PORT = process.env.PORT || 3463;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

function readLinks() {
  const file = join(DATA_DIR, 'links.json');
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function writeLinks(links) {
  writeFileSync(join(DATA_DIR, 'links.json'), JSON.stringify(links, null, 2));
}

function generateCode(length = 6) {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const hash = createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest();
  for (let i = 0; i < length; i++) {
    code += chars[hash[i] % chars.length];
  }
  return code;
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
  });
}

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json',
};

// --- API Routes ---
const routes = { GET: {}, POST: {}, DELETE: {} };
function route(method, path, handler) { routes[method][path] = handler; }

// Create short link
route('POST', '/api/links', async (req, res) => {
  const body = await parseBody(req);
  const url = body.url;
  if (!url) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'URL required' }));
    return;
  }

  // Validate URL
  try { new URL(url); } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  const links = readLinks();

  // Check for custom alias
  let code = body.alias || generateCode();
  if (links[code]) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Alias already exists' }));
    return;
  }

  links[code] = {
    url,
    code,
    title: body.title || '',
    createdAt: new Date().toISOString(),
    clicks: [],
    clickCount: 0,
  };

  writeLinks(links);

  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    code,
    shortUrl: `${BASE_URL}/${code}`,
    originalUrl: url,
  }));
});

// List all links
route('GET', '/api/links', (req, res) => {
  const links = readLinks();
  const list = Object.values(links).sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(list));
});

// Get link details
route('GET', '/api/links/:code', (req, res, params) => {
  const links = readLinks();
  const link = links[params.code];
  if (!link) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(link));
});

// Delete link
route('DELETE', '/api/links/:code', (req, res, params) => {
  const links = readLinks();
  if (!links[params.code]) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  delete links[params.code];
  writeLinks(links);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

// Stats
route('GET', '/api/stats', (req, res) => {
  const links = readLinks();
  const all = Object.values(links);
  const totalClicks = all.reduce((s, l) => s + l.clickCount, 0);
  const topLinks = [...all].sort((a, b) => b.clickCount - a.clickCount).slice(0, 10);

  // Clicks over time (last 7 days)
  const clicksByDay = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    clicksByDay[d] = 0;
  }
  all.forEach(l => {
    (l.clicks || []).forEach(c => {
      const d = c.time?.slice(0, 10);
      if (d && d in clicksByDay) clicksByDay[d]++;
    });
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    totalLinks: all.length,
    totalClicks,
    topLinks,
    clicksByDay,
  }));
});

// --- Server ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API routing
  for (const [method, routesMap] of Object.entries(routes)) {
    if (req.method !== method) continue;
    for (const [pattern, handler] of Object.entries(routesMap)) {
      const patternParts = pattern.split('/');
      const pathParts = pathname.split('/');
      if (patternParts.length !== pathParts.length) continue;
      const params = {};
      let match = true;
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
          params[patternParts[i].slice(1)] = pathParts[i];
        } else if (patternParts[i] !== pathParts[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        try { await handler(req, res, params); }
        catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
    }
  }

  // Redirect short links
  if (req.method === 'GET' && pathname.length > 1) {
    const code = pathname.slice(1);
    const links = readLinks();
    const link = links[code];
    if (link) {
      // Track click
      link.clicks.push({
        time: new Date().toISOString(),
        referer: req.headers.referer || '',
        ua: req.headers['user-agent'] || '',
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      });
      link.clickCount++;
      writeLinks(links);

      res.writeHead(302, { Location: link.url });
      res.end();
      return;
    }
  }

  // Static files
  let filePath = join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (existsSync(filePath)) {
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(readFileSync(join(__dirname, 'public', 'index.html')));
});

server.listen(PORT, () => {
  console.log(`\n  ShortLink is running at http://localhost:${PORT}\n`);
});
