#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const PORT = process.env.PORT || 3459;

function readData(name) {
  const file = join(DATA_DIR, `${name}.json`);
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function writeData(name, data) {
  writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parseBody(req) {
  return new Promise((resolve) => {
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
  '.json': 'application/json', '.svg': 'image/svg+xml',
};

const routes = { GET: {}, POST: {}, PUT: {}, PATCH: {}, DELETE: {} };
function route(method, path, handler) { routes[method][path] = handler; }

// --- Snippets API ---
route('GET', '/api/snippets', (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const lang = url.searchParams.get('lang') || '';
  const tag = url.searchParams.get('tag') || '';

  let snippets = readData('snippets');
  if (q) {
    snippets = snippets.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  if (lang) snippets = snippets.filter(s => s.language === lang);
  if (tag) snippets = snippets.filter(s => (s.tags || []).includes(tag));

  snippets.sort((a, b) => b.updatedAt?.localeCompare(a.updatedAt) || 0);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(snippets));
});

route('POST', '/api/snippets', async (req, res) => {
  const body = await parseBody(req);
  const snippets = readData('snippets');
  const snippet = {
    id: uid(),
    title: body.title || 'Untitled',
    description: body.description || '',
    code: body.code || '',
    language: body.language || 'javascript',
    tags: body.tags || [],
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  snippets.unshift(snippet);
  writeData('snippets', snippets);
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(snippet));
});

route('PATCH', '/api/snippets/:id', async (req, res, params) => {
  const snippets = readData('snippets');
  const idx = snippets.findIndex(s => s.id === params.id);
  if (idx === -1) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  const body = await parseBody(req);
  Object.assign(snippets[idx], body, { updatedAt: new Date().toISOString() });
  writeData('snippets', snippets);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(snippets[idx]));
});

route('DELETE', '/api/snippets/:id', (req, res, params) => {
  let snippets = readData('snippets');
  snippets = snippets.filter(s => s.id !== params.id);
  writeData('snippets', snippets);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

route('GET', '/api/tags', (req, res) => {
  const snippets = readData('snippets');
  const tags = new Set();
  snippets.forEach(s => (s.tags || []).forEach(t => tags.add(t)));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify([...tags].sort()));
});

route('GET', '/api/languages', (req, res) => {
  const snippets = readData('snippets');
  const langs = new Set(snippets.map(s => s.language));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify([...langs].sort()));
});

route('GET', '/api/stats', (req, res) => {
  const snippets = readData('snippets');
  const langs = {};
  const tags = {};
  snippets.forEach(s => {
    langs[s.language] = (langs[s.language] || 0) + 1;
    (s.tags || []).forEach(t => tags[t] = (tags[t] || 0) + 1);
  });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    total: snippets.length,
    languages: langs,
    tags,
    recent: snippets.slice(0, 5),
  }));
});

// --- Server ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

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

  let filePath = join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (existsSync(filePath) && !filePath.includes('..')) {
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(readFileSync(join(__dirname, 'public', 'index.html')));
});

server.listen(PORT, () => {
  console.log(`\n  SnippetBox is running at http://localhost:${PORT}\n`);
});
