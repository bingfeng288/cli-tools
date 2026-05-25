#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const ADMIN_PORT = process.env.ADMIN_PORT || 3461;
const MOCK_PORT = process.env.MOCK_PORT || 3462;

function readMocks() {
  const file = join(DATA_DIR, 'mocks.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf-8'));
}

function writeMocks(mocks) {
  writeFileSync(join(DATA_DIR, 'mocks.json'), JSON.stringify(mocks, null, 2));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

// --- Admin API ---
const adminRoutes = { GET: {}, POST: {}, PUT: {}, PATCH: {}, DELETE: {} };
function adminRoute(method, path, handler) { adminRoutes[method][path] = handler; }

adminRoute('GET', '/api/mocks', (req, res) => {
  const mocks = readMocks();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(mocks));
});

adminRoute('POST', '/api/mocks', async (req, res) => {
  const body = await parseBody(req);
  const mocks = readMocks();
  const mock = {
    id: uid(),
    method: (body.method || 'GET').toUpperCase(),
    path: body.path || '/api/example',
    status: body.status || 200,
    headers: body.headers || { 'Content-Type': 'application/json' },
    body: body.body || '{"message": "Hello from MockAPI"}',
    delay: body.delay || 0,
    enabled: body.enabled !== false,
    description: body.description || '',
    createdAt: new Date().toISOString(),
  };
  mocks.push(mock);
  writeMocks(mocks);
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(mock));
});

adminRoute('PATCH', '/api/mocks/:id', async (req, res, params) => {
  const mocks = readMocks();
  const idx = mocks.findIndex(m => m.id === params.id);
  if (idx === -1) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  const body = await parseBody(req);
  Object.assign(mocks[idx], body);
  writeMocks(mocks);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(mocks[idx]));
});

adminRoute('DELETE', '/api/mocks/:id', (req, res, params) => {
  let mocks = readMocks();
  mocks = mocks.filter(m => m.id !== params.id);
  writeMocks(mocks);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

adminRoute('POST', '/api/mocks/import', async (req, res) => {
  const body = await parseBody(req);
  if (!body.mocks || !Array.isArray(body.mocks)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid format' }));
    return;
  }
  const existing = readMocks();
  const imported = body.mocks.map(m => ({
    id: uid(),
    method: (m.method || 'GET').toUpperCase(),
    path: m.path || '/',
    status: m.status || 200,
    headers: m.headers || { 'Content-Type': 'application/json' },
    body: typeof m.body === 'string' ? m.body : JSON.stringify(m.body, null, 2),
    delay: m.delay || 0,
    enabled: true,
    description: m.description || '',
    createdAt: new Date().toISOString(),
  }));
  writeMocks([...existing, ...imported]);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ imported: imported.length }));
});

adminRoute('GET', '/api/stats', (req, res) => {
  const mocks = readMocks();
  const methods = {};
  mocks.forEach(m => methods[m.method] = (methods[m.method] || 0) + 1);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    total: mocks.length,
    enabled: mocks.filter(m => m.enabled).length,
    methods,
  }));
});

// --- Admin Server ---
function matchRoute(routesMap, method, pathname) {
  if (!routesMap[method]) return null;
  for (const [pattern, handler] of Object.entries(routesMap[method])) {
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
    if (match) return { handler, params };
  }
  return null;
}

const adminServer = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${ADMIN_PORT}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const route = matchRoute(adminRoutes, req.method, pathname);
  if (route) {
    try { await route.handler(req, res, route.params); }
    catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
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

adminServer.listen(ADMIN_PORT, () => {
  console.log(`\n  MockAPI Admin: http://localhost:${ADMIN_PORT}`);
});

// --- Mock Server ---
const requestLog = [];

const mockServer = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${MOCK_PORT}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const mocks = readMocks();
  const mock = mocks.find(m => m.enabled && m.method === method && m.path === pathname);

  // Log request
  requestLog.unshift({
    method, path: pathname, timestamp: new Date().toISOString(),
    matched: !!mock, status: mock?.status || 404,
  });
  if (requestLog.length > 100) requestLog.length = 100;

  if (!mock) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'No mock found', path: pathname, method }));
    return;
  }

  // Apply delay
  if (mock.delay > 0) {
    await new Promise(r => setTimeout(r, mock.delay));
  }

  // Set headers
  for (const [k, v] of Object.entries(mock.headers || {})) {
    res.setHeader(k, v);
  }

  res.writeHead(mock.status);
  res.end(mock.body);
});

mockServer.listen(MOCK_PORT, () => {
  console.log(`  Mock Server:  http://localhost:${MOCK_PORT}\n`);
});

// --- Request log API (on admin server) ---
adminRoute('GET', '/api/logs', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(requestLog));
});
