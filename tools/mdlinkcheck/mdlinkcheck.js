#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { request } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { join, dirname, extname } from 'node:path';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mmdlinkcheck\x1b[0m - Markdown link checker

  \x1b[1mUsage:\x1b[0m
    mdlinkcheck <file...> [options]

  \x1b[1mOptions:\x1b[0m
    --external            Check external URLs
    --timeout <ms>        HTTP timeout (default: 5000)
    --ignore <pattern>    Ignore URL pattern
    -v, --verbose         Show all links (not just broken)
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    mdlinkcheck README.md
    mdlinkcheck *.md
    mdlinkcheck README.md --external
    mdlinkcheck README.md --ignore "http://localhost"
`);
}

// --- Extract links ---
function extractLinks(content) {
  const links = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Markdown links: [text](url)
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      links.push({
        line: i + 1,
        text: match[1],
        url: match[2],
        type: 'link',
      });
    }

    // Images: ![alt](url)
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    while ((match = imgRegex.exec(line)) !== null) {
      links.push({
        line: i + 1,
        text: match[1],
        url: match[2],
        type: 'image',
      });
    }

    // Reference links: [text][ref]
    const refRegex = /\[([^\]]*)\]\[([^\]]+)\]/g;
    while ((match = refRegex.exec(line)) !== null) {
      links.push({
        line: i + 1,
        text: match[1],
        url: `[${match[2]}]`,
        type: 'reference',
      });
    }
  }

  return links;
}

// --- Check link ---
async function checkLink(url, timeout = 5000) {
  // Skip anchors
  if (url.startsWith('#')) {
    return { status: 'anchor', valid: true };
  }

  // Skip mailto
  if (url.startsWith('mailto:')) {
    return { status: 'mailto', valid: true };
  }

  // Check local file
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const cleanUrl = url.split('#')[0];
    return {
      status: 'local',
      valid: existsSync(cleanUrl),
    };
  }

  // Check external URL
  return new Promise((resolve) => {
    const reqFn = url.startsWith('https://') ? httpsRequest : request;
    const timeoutId = setTimeout(() => {
      resolve({ status: 'timeout', valid: false });
    }, timeout);

    const req = reqFn(url, { method: 'HEAD', timeout }, (res) => {
      clearTimeout(timeoutId);
      resolve({
        status: res.statusCode,
        valid: res.statusCode >= 200 && res.statusCode < 400,
      });
    });

    req.on('error', () => {
      clearTimeout(timeoutId);
      resolve({ status: 'error', valid: false });
    });

    req.end();
  });
}

// --- Check file ---
async function checkFile(filePath, options = {}) {
  const {
    checkExternal = false,
    timeout = 5000,
    ignore = [],
    verbose = false,
  } = options;

  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return { file: filePath, error: err.message, links: [] };
  }

  const links = extractLinks(content);
  const results = [];

  for (const link of links) {
    // Skip ignored patterns
    if (ignore.some(p => link.url.includes(p))) continue;

    // Skip external if not checking
    if (!checkExternal && (link.url.startsWith('http://') || link.url.startsWith('https://'))) {
      results.push({ ...link, status: 'skipped', valid: true });
      continue;
    }

    const result = await checkLink(link.url, timeout);
    results.push({ ...link, ...result });
  }

  return { file: filePath, links: results };
}

// --- Display results ---
function displayResults(results, verbose = false) {
  let totalLinks = 0;
  let brokenLinks = 0;
  let skippedLinks = 0;

  for (const { file, links, error } of results) {
    if (error) {
      console.log(`\n  ${C.red}Error:${C.reset} ${file}: ${error}`);
      continue;
    }

    const broken = links.filter(l => !l.valid);
    const skipped = links.filter(l => l.status === 'skipped');

    totalLinks += links.length;
    brokenLinks += broken.length;
    skippedLinks += skipped.length;

    if (broken.length > 0) {
      console.log(`\n  ${C.bold}${file}${C.reset} (${broken.length} broken)\n`);
      broken.forEach(link => {
        console.log(`  ${C.red}✗${C.reset} Line ${link.line}: ${link.url}`);
        if (link.text) console.log(`    ${C.dim}Text: ${link.text}${C.reset}`);
      });
    } else if (verbose) {
      console.log(`\n  ${C.green}✓${C.reset} ${file}: all links OK`);
    }
  }

  console.log(`\n  ${C.bold}Summary${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(30)}${C.reset}`);
  console.log(`  ${C.dim}Total:${C.reset}    ${totalLinks}`);
  console.log(`  ${C.green}Valid:${C.reset}    ${totalLinks - brokenLinks - skippedLinks}`);
  console.log(`  ${C.red}Broken:${C.reset}   ${brokenLinks}`);
  if (skippedLinks > 0) console.log(`  ${C.yellow}Skipped:${C.reset}  ${skippedLinks}`);
  console.log();

  return brokenLinks > 0;
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let checkExternal = false;
  let timeout = 5000;
  let ignore = [];
  let verbose = false;
  const files = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--external') checkExternal = true;
    else if (arg === '--timeout') timeout = parseInt(args[++i]) || 5000;
    else if (arg === '--ignore') ignore.push(args[++i]);
    else if (arg === '-v' || arg === '--verbose') verbose = true;
    else if (!arg.startsWith('-')) files.push(arg);
  }

  return { checkExternal, timeout, ignore, verbose, files };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (opts.files.length === 0) {
    console.error('  Error: No files specified');
    process.exit(1);
  }

  const results = [];
  for (const file of opts.files) {
    results.push(await checkFile(file, opts));
  }

  const hasBroken = displayResults(results, opts.verbose);
  process.exit(hasBroken ? 1 : 0);
}

main();
