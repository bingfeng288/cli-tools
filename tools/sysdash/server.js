#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { cpus, totalmem, freemem, uptime, hostname, platform, arch, release, networkInterfaces, loadavg } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3460;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml',
};

function safeExec(cmd) {
  try { return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim(); }
  catch { return ''; }
}

// --- System info functions ---
function getCpuInfo() {
  const cpuList = cpus();
  const usage = cpuList.map(cpu => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return ((total - idle) / total * 100).toFixed(1);
  });
  return {
    model: cpuList[0]?.model || 'Unknown',
    cores: cpuList.length,
    usage,
    average: (usage.reduce((a, b) => a + parseFloat(b), 0) / usage.length).toFixed(1),
    load: loadavg(),
  };
}

function getMemoryInfo() {
  const total = totalmem();
  const free = freemem();
  const used = total - free;
  return {
    total, free, used,
    percent: ((used / total) * 100).toFixed(1),
  };
}

function getDiskInfo() {
  const raw = safeExec("df -h / | tail -1");
  if (!raw) return { total: '?', used: '?', free: '?', percent: '?' };
  const parts = raw.split(/\s+/);
  return {
    total: parts[1] || '?',
    used: parts[2] || '?',
    free: parts[3] || '?',
    percent: parts[4] || '?',
  };
}

function getNetworkInfo() {
  const nets = networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs) {
      if (addr.internal) continue;
      result.push({ name, family: addr.family, address: addr.address });
    }
  }
  return result;
}

function getProcesses() {
  const raw = safeExec("ps aux --sort=-%mem 2>/dev/null || ps aux");
  if (!raw) return [];
  const lines = raw.split('\n').slice(1, 21); // Top 20
  return lines.map(line => {
    const parts = line.split(/\s+/);
    return {
      user: parts[0],
      pid: parts[1],
      cpu: parts[2],
      mem: parts[3],
      command: parts.slice(10).join(' ').slice(0, 80),
    };
  }).filter(p => p.pid);
}

function getUptime() {
  const sec = uptime();
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  return { seconds: sec, formatted: `${days}d ${hours}h ${mins}m` };
}

function getSystemInfo() {
  return {
    hostname: hostname(),
    platform: platform(),
    arch: arch(),
    release: release(),
    nodeVersion: process.version,
    uptime: getUptime(),
  };
}

// --- API ---
const routes = { GET: {}, POST: {} };
function route(method, path, handler) { routes[method][path] = handler; }

route('GET', '/api/system', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(getSystemInfo()));
});

route('GET', '/api/cpu', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(getCpuInfo()));
});

route('GET', '/api/memory', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(getMemoryInfo()));
});

route('GET', '/api/disk', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(getDiskInfo()));
});

route('GET', '/api/network', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(getNetworkInfo()));
});

route('GET', '/api/processes', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(getProcesses()));
});

route('GET', '/api/all', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    system: getSystemInfo(),
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    disk: getDiskInfo(),
    network: getNetworkInfo(),
    processes: getProcesses(),
  }));
});

// --- Server ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  for (const [method, routesMap] of Object.entries(routes)) {
    if (req.method !== method) continue;
    if (routesMap[pathname]) {
      try { await routesMap[pathname](req, res); }
      catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

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
  console.log(`\n  SysDash is running at http://localhost:${PORT}\n`);
});
