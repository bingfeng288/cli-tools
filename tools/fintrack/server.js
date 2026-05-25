#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const PORT = process.env.PORT || 3458;

// --- Data helpers ---
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

// --- MIME types ---
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// --- Request body parser ---
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// --- Router ---
const routes = { GET: {}, POST: {}, PUT: {}, PATCH: {}, DELETE: {} };

function route(method, path, handler) {
  routes[method][path] = handler;
}

// --- API Routes ---

// Transactions
route('GET', '/api/transactions', (req, res) => {
  const transactions = readData('transactions');
  // Support filtering
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const month = url.searchParams.get('month');
  const type = url.searchParams.get('type');
  const category = url.searchParams.get('category');

  let filtered = transactions;
  if (month) filtered = filtered.filter(t => t.date.startsWith(month));
  if (type) filtered = filtered.filter(t => t.type === type);
  if (category) filtered = filtered.filter(t => t.category === category);

  // Sort by date desc
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(filtered));
});

route('POST', '/api/transactions', async (req, res) => {
  const body = await parseBody(req);
  const transactions = readData('transactions');
  const transaction = {
    id: uid(),
    type: body.type || 'expense',
    amount: parseFloat(body.amount) || 0,
    category: body.category || 'other',
    description: body.description || '',
    date: body.date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  transactions.push(transaction);
  writeData('transactions', transactions);
  res.writeHead(201, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(transaction));
});

route('DELETE', '/api/transactions/:id', (req, res, params) => {
  let transactions = readData('transactions');
  transactions = transactions.filter(t => t.id !== params.id);
  writeData('transactions', transactions);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

// Budgets
route('GET', '/api/budgets', (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const budgets = readData('budgets');
  const monthBudgets = budgets.filter(b => b.month === month);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(monthBudgets));
});

route('POST', '/api/budgets', async (req, res) => {
  const body = await parseBody(req);
  const budgets = readData('budgets');
  const month = body.month || new Date().toISOString().slice(0, 7);
  // Update or create
  const idx = budgets.findIndex(b => b.month === month && b.category === body.category);
  if (idx >= 0) {
    budgets[idx].amount = parseFloat(body.amount) || 0;
  } else {
    budgets.push({
      id: uid(),
      month,
      category: body.category || 'other',
      amount: parseFloat(body.amount) || 0,
    });
  }
  writeData('budgets', budgets);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});

// Stats
route('GET', '/api/stats', (req, res) => {
  const transactions = readData('transactions');
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  const monthTx = transactions.filter(t => t.date.startsWith(currentMonth));
  const lastMonthTx = transactions.filter(t => t.date.startsWith(lastMonth));

  const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const lastIncome = lastMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const lastExpense = lastMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Category breakdown
  const categories = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + t.amount;
  });

  // Daily expenses for chart
  const dailyExpenses = {};
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    dailyExpenses[t.date] = (dailyExpenses[t.date] || 0) + t.amount;
  });

  // Last 6 months trend
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.toISOString().slice(0, 7);
    const mTx = transactions.filter(t => t.date.startsWith(m));
    monthlyTrend.push({
      month: m,
      income: mTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: mTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    });
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    currentMonth: { income, expense, balance: income - expense },
    lastMonth: { income: lastIncome, expense: lastExpense },
    categories,
    dailyExpenses,
    monthlyTrend,
    transactionCount: monthTx.length,
  }));
});

// --- Static files & SPA ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // API routing
  for (const [method, routesMap] of Object.entries(routes)) {
    if (req.method !== method) continue;
    for (const [pattern, handler] of Object.entries(routesMap)) {
      // Simple param matching
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
        try {
          await handler(req, res, params);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
    }
  }

  // Static files
  let filePath = join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (existsSync(filePath) && !filePath.includes('..')) {
    const ext = extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(readFileSync(filePath));
    return;
  }

  // SPA fallback
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(readFileSync(join(__dirname, 'public', 'index.html')));
});

server.listen(PORT, () => {
  console.log(`\n  FinTrack is running at http://localhost:${PORT}\n`);
});
