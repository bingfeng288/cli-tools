#!/usr/bin/env node

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFileSync, writeFileSync } from 'node:fs';
import { URL } from 'node:url';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

function colorStatus(code) {
  if (code < 300) return `${C.bgGreen}${C.bold} ${code} ${C.reset}`;
  if (code < 400) return `${C.bgYellow}${C.bold} ${code} ${C.reset}`;
  if (code < 500) return `${C.bgRed}${C.bold} ${code} ${C.reset}`;
  return `${C.bgRed}${C.bold} ${code} ${C.reset}`;
}

function statusText(code) {
  const texts = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
    422: 'Unprocessable Entity', 429: 'Too Many Requests',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
  };
  return texts[code] || '';
}

function colorMethod(method) {
  const colors = { GET: C.green, POST: C.blue, PUT: C.yellow, PATCH: C.magenta, DELETE: C.red, HEAD: C.cyan, OPTIONS: C.dim };
  return `${colors[method] || C.white}${C.bold}${method}${C.reset}`;
}

function colorJson(str) {
  return str
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"\s*:/g, `${C.cyan}"$1"${C.reset}:`)
    .replace(/:\s*"([^"\\]*(\\.[^"\\]*)*)"/g, `: ${C.green}"$1"${C.reset}`)
    .replace(/:\s*(true|false)/g, `: ${C.yellow}$1${C.reset}`)
    .replace(/:\s*(null)/g, `: ${C.dim}$1${C.reset}`)
    .replace(/:\s*(-?\d+\.?\d*)/g, `: ${C.magenta}$1${C.reset}`);
}

function formatBody(body, contentType) {
  if (!contentType) return body;
  if (contentType.includes('json')) {
    try {
      const parsed = JSON.parse(body);
      return colorJson(JSON.stringify(parsed, null, 2));
    } catch { return body; }
  }
  return body;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// --- Help ---
function showHelp() {
  console.log(`
  ${C.bold}httpcraft${C.reset} - A developer-friendly HTTP client

  ${C.bold}Usage:${C.reset}
    httpcraft [method] <url> [options]

  ${C.bold}Methods:${C.reset}
    get, post, put, patch, delete, head, options

  ${C.bold}Options:${C.reset}
    -H, --header <key:value>    Add request header (repeatable)
    -d, --data <body>           Request body (JSON string or @file)
    -f, --form <key=value>      Form data (repeatable)
    -q, --quiet                 Show only response body
    -s, --silent                Hide progress info
    -i, --include               Show response headers
    -S, --save <file>           Save response to file
    --json                      Set Content-Type to application/json
    --timeout <ms>              Request timeout (default: 30000)
    -h, --help                  Show this help

  ${C.bold}Examples:${C.reset}
    httpcraft get https://httpbin.org/get
    httpcraft post https://httpbin.org/post -d '{"name":"test"}'
    httpcraft put https://httpbin.org/put -H "Authorization:Bearer token" -d @data.json
    httpcraft get https://httpbin.org/get -q
    httpcraft get https://httpbin.org/headers -H "X-Custom:value"
    httpcraft post https://httpbin.org/post -f name=test -f age=25
`);
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  let method = 'GET';
  let url = null;
  const headers = {};
  let body = null;
  let quiet = false;
  let silent = false;
  let include = false;
  let saveFile = null;
  let timeout = 30000;
  const formData = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (methods.includes(arg.toLowerCase())) {
      method = arg.toUpperCase();
    } else if (arg === '-H' || arg === '--header') {
      const h = args[++i];
      if (h) {
        const idx = h.indexOf(':');
        if (idx > 0) headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
      }
    } else if (arg === '-d' || arg === '--data') {
      body = args[++i];
      if (body?.startsWith('@')) {
        body = readFileSync(body.slice(1), 'utf-8');
      }
    } else if (arg === '-f' || arg === '--form') {
      const f = args[++i];
      if (f) formData.push(f);
    } else if (arg === '-q' || arg === '--quiet') {
      quiet = true;
    } else if (arg === '-s' || arg === '--silent') {
      silent = true;
    } else if (arg === '-i' || arg === '--include') {
      include = true;
    } else if (arg === '-S' || arg === '--save') {
      saveFile = args[++i];
    } else if (arg === '--json') {
      headers['Content-Type'] = 'application/json';
    } else if (arg === '--timeout') {
      timeout = parseInt(args[++i]) || 30000;
    } else if (!arg.startsWith('-') && !url) {
      url = arg;
    }
  }

  if (!url) {
    console.error('  Error: No URL provided');
    process.exit(1);
  }

  // Auto-add protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }

  // Handle form data
  if (formData.length > 0) {
    body = formData.map(f => {
      const [k, ...v] = f.split('=');
      return `${encodeURIComponent(k)}=${encodeURIComponent(v.join('='))}`;
    }).join('&');
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  // Auto-set content type for JSON body
  if (body && !headers['Content-Type'] && !headers['content-type']) {
    try { JSON.parse(body); headers['Content-Type'] = 'application/json'; } catch {}
  }

  return { method, url, headers, body, quiet, silent, include, saveFile, timeout };
}

// --- Make request ---
function makeRequest(opts) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(opts.url);
    const isHttps = urlObj.protocol === 'https:';
    const reqFn = isHttps ? httpsRequest : httpRequest;

    const reqOpts = {
      method: opts.method,
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': 'httpcraft/1.0',
        'Accept': '*/*',
        ...opts.headers,
      },
      timeout: opts.timeout,
    };

    if (opts.body) {
      reqOpts.headers['Content-Length'] = Buffer.byteLength(opts.body);
    }

    const startTime = Date.now();
    const req = reqFn(reqOpts, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const duration = Date.now() - startTime;
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({
          status: res.statusCode,
          statusText: statusText(res.statusCode),
          headers: res.headers,
          body,
          duration,
          size: Buffer.byteLength(body),
          url: opts.url,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// --- Display ---
function displayRequest(opts) {
  if (opts.silent || opts.quiet) return;
  console.log();
  console.log(`  ${C.dim}╭─ Request ─────────────────────────────────${C.reset}`);
  console.log(`  ${C.dim}│${C.reset} ${colorMethod(opts.method)} ${C.bold}${opts.url}${C.reset}`);
  const hdrs = Object.entries(opts.headers);
  if (hdrs.length > 0) {
    hdrs.forEach(([k, v]) => {
      console.log(`  ${C.dim}│${C.reset} ${C.dim}${k}:${C.reset} ${v}`);
    });
  }
  if (opts.body) {
    const preview = opts.body.length > 200 ? opts.body.slice(0, 200) + '...' : opts.body;
    console.log(`  ${C.dim}│${C.reset} ${C.dim}Body:${C.reset} ${preview}`);
  }
  console.log(`  ${C.dim}╰──────────────────────────────────────────${C.reset}`);
}

function displayResponse(res, opts) {
  if (opts.quiet) {
    console.log(res.body);
    return;
  }

  console.log();
  console.log(`  ${C.dim}╭─ Response ────────────────────────────────${C.reset}`);
  console.log(`  ${C.dim}│${C.reset} ${colorStatus(res.status)} ${res.statusText}  ${C.dim}${formatDuration(res.duration)}  ${formatSize(res.size)}${C.reset}`);

  if (opts.include) {
    console.log(`  ${C.dim}│${C.reset}`);
    Object.entries(res.headers).forEach(([k, v]) => {
      console.log(`  ${C.dim}│${C.reset} ${C.cyan}${k}:${C.reset} ${v}`);
    });
  }

  console.log(`  ${C.dim}│${C.reset}`);
  const contentType = res.headers['content-type'] || '';
  const formatted = formatBody(res.body, contentType);
  const lines = formatted.split('\n');
  lines.forEach(line => {
    console.log(`  ${C.dim}│${C.reset} ${line}`);
  });
  console.log(`  ${C.dim}╰──────────────────────────────────────────${C.reset}`);
  console.log();

  // Save to file
  if (opts.saveFile) {
    writeFileSync(opts.saveFile, res.body);
    console.log(`  ${C.dim}Saved to ${opts.saveFile}${C.reset}`);
    console.log();
  }
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.silent && !opts.quiet) {
    process.stdout.write(`  ${C.dim}Connecting...${C.reset}\r`);
  }

  try {
    displayRequest(opts);
    const res = await makeRequest(opts);
    displayResponse(res, opts);
  } catch (err) {
    console.error(`\n  ${C.red}Error:${C.reset} ${err.message}\n`);
    process.exit(1);
  }
}

main();
