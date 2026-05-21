#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mjwtdecode\x1b[0m - JWT token decoder and inspector

  \x1b[1mUsage:\x1b[0m
    jwtdecode <token>
    echo "<token>" | jwtdecode
    jwtdecode <token> --secret <secret>

  \x1b[1mOptions:\x1b[0m
    -s, --secret <secret>   Verify HMAC signature (HS256/384/512)
    --json                  Output as JSON
    --header                Show only header
    --payload               Show only payload
    -h, --help              Show this help

  \x1b[1mExamples:\x1b[0m
    jwtdecode eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.xxx
    jwtdecode token.txt --secret my-secret
    cat token.jwt | jwtdecode
`);
}

// --- Base64URL decode ---
function base64UrlDecode(str) {
  // Add padding if needed
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  return Buffer.from(padded, 'base64').toString('utf-8');
}

// --- Base64URL encode ---
function base64UrlEncode(str) {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// --- Decode JWT ---
function decodeJwt(token) {
  const parts = token.trim().split('.');

  if (parts.length < 2 || parts.length > 3) {
    throw new Error('Invalid JWT format: expected 2 or 3 parts separated by dots');
  }

  const header = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));
  const signature = parts.length === 3 ? parts[2] : null;

  return { header, payload, signature, raw: { header: parts[0], payload: parts[1], signature: parts[2] || null } };
}

// --- Verify HMAC signature ---
function verifySignature(token, secret, algorithm) {
  const parts = token.split('.');
  const signingInput = `${parts[0]}.${parts[1]}`;

  const algMap = {
    'HS256': 'sha256',
    'HS384': 'sha384',
    'HS512': 'sha512',
  };

  const hashAlg = algMap[algorithm];
  if (!hashAlg) {
    throw new Error(`Unsupported algorithm: ${algorithm}. Only HS256/HS384/HS512 supported.`);
  }

  const expected = createHmac(hashAlg, secret)
    .update(signingInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return expected === parts[2];
}

// --- Format timestamp ---
function formatTimestamp(ts) {
  const date = new Date(ts * 1000);
  return date.toISOString();
}

// --- Check token status ---
function getTokenStatus(payload) {
  const now = Math.floor(Date.now() / 1000);
  const status = { expired: false, notYetValid: false, times: {} };

  if (payload.exp !== undefined) {
    status.times.expiresAt = formatTimestamp(payload.exp);
    status.times.expiresIn = payload.exp - now;
    if (payload.exp < now) {
      status.expired = true;
    }
  }

  if (payload.iat !== undefined) {
    status.times.issuedAt = formatTimestamp(payload.iat);
    status.times.age = now - payload.iat;
  }

  if (payload.nbf !== undefined) {
    status.times.notBefore = formatTimestamp(payload.nbf);
    if (payload.nbf > now) {
      status.notYetValid = true;
    }
  }

  return status;
}

// --- Format duration ---
function formatDuration(seconds) {
  const abs = Math.abs(seconds);
  const sign = seconds < 0 ? '-' : '';

  if (abs < 60) return `${sign}${abs}s`;
  if (abs < 3600) return `${sign}${Math.floor(abs / 60)}m ${abs % 60}s`;
  if (abs < 86400) return `${sign}${Math.floor(abs / 3600)}h ${Math.floor((abs % 3600) / 60)}m`;
  return `${sign}${Math.floor(abs / 86400)}d ${Math.floor((abs % 86400) / 3600)}h`;
}

// --- Display decoded token ---
function displayToken(decoded, status, options = {}) {
  const { showHeader = true, showPayload = true, signatureValid = null } = options;

  console.log();

  if (showHeader) {
    console.log(`  ${C.bold}${C.cyan}Header${C.reset}`);
    console.log(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);
    console.log(JSON.stringify(decoded.header, null, 2).split('\n').map(l => `  ${l}`).join('\n'));
    console.log();
  }

  if (showPayload) {
    console.log(`  ${C.bold}${C.magenta}Payload${C.reset}`);
    console.log(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);
    console.log(JSON.stringify(decoded.payload, null, 2).split('\n').map(l => `  ${l}`).join('\n'));
    console.log();
  }

  // Status
  console.log(`  ${C.bold}Status${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);

  if (status.expired) {
    console.log(`  ${C.red}EXPIRED${C.reset} ${formatDuration(status.times.expiresIn)} ago`);
  } else if (status.times.expiresIn !== undefined) {
    console.log(`  ${C.green}Valid${C.reset} - expires in ${formatDuration(status.times.expiresIn)}`);
  }

  if (status.notYetValid) {
    console.log(`  ${C.yellow}NOT YET VALID${C.reset} - becomes valid in ${formatDuration(status.times.notBefore - Math.floor(Date.now() / 1000))}`);
  }

  if (status.times.issuedAt) {
    console.log(`  ${C.dim}Issued:${C.reset} ${status.times.issuedAt} (${formatDuration(status.times.age)} ago)`);
  }

  if (signatureValid !== null) {
    if (signatureValid) {
      console.log(`  ${C.green}Signature: VALID${C.reset}`);
    } else {
      console.log(`  ${C.red}Signature: INVALID${C.reset}`);
    }
  }

  console.log();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let token = null;
  let secret = null;
  let json = false;
  let showHeader = true;
  let showPayload = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-s' || arg === '--secret') {
      secret = args[++i];
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--header') {
      showPayload = false;
    } else if (arg === '--payload') {
      showHeader = false;
    } else if (!arg.startsWith('-')) {
      token = arg;
    }
  }

  return { token, secret, json, showHeader, showPayload };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read token
  let token = opts.token;
  if (!token && !process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    token = Buffer.concat(chunks).toString('utf-8').trim();
  }

  if (!token) {
    showHelp();
    process.exit(1);
  }

  // Check if it's a file path
  try {
    const fileContent = readFileSync(token, 'utf-8').trim();
    if (fileContent.includes('.')) {
      token = fileContent;
    }
  } catch (e) {
    // Not a file, treat as token
  }

  try {
    const decoded = decodeJwt(token);
    const status = getTokenStatus(decoded.payload);

    // Verify signature if secret provided
    let signatureValid = null;
    if (opts.secret) {
      try {
        signatureValid = verifySignature(token, opts.secret, decoded.header.alg || 'HS256');
      } catch (err) {
        console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
        process.exit(1);
      }
    }

    if (opts.json) {
      const result = {
        header: decoded.header,
        payload: decoded.payload,
        status: {
          expired: status.expired,
          notYetValid: status.notYetValid,
          ...status.times,
        },
      };
      if (signatureValid !== null) {
        result.signatureValid = signatureValid;
      }
      console.log(JSON.stringify(result, null, 2));
    } else {
      displayToken(decoded, status, {
        showHeader: opts.showHeader,
        showPayload: opts.showPayload,
        signatureValid,
      });
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
