#!/usr/bin/env node

import { readFileSync } from 'node:fs';

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
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mjsontree\x1b[0m - JSON tree viewer

  \x1b[1mUsage:\x1b[0m
    jsontree [file] [options]
    cat data.json | jsontree

  \x1b[1mOptions:\x1b[0m
    -d, --depth <n>       Maximum depth to display (default: all)
    -a, --arrays          Show array indices
    -t, --types           Show type indicators
    -p, --paths           Show JSON paths
    --compact             Compact display
    --no-color            Disable colors
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    jsontree data.json
    jsontree data.json -d 3
    jsontree data.json -t
    jsontree data.json -p
    echo '{"a":{"b":1}}' | jsontree
`);
}

// --- Tree symbols ---
const SYMBOLS = {
  branch: '├── ',
  last: '└── ',
  indent: '│   ',
  space: '    ',
};

// --- Type indicators ---
function typeIndicator(value) {
  if (value === null) return `${C.dim}null${C.reset}`;
  if (Array.isArray(value)) return `${C.blue}[]${C.reset}`;
  if (typeof value === 'object') return `${C.cyan}{}${C.reset}`;
  if (typeof value === 'string') return `${C.green}""${C.reset}`;
  if (typeof value === 'number') return `${C.yellow}#${C.reset}`;
  if (typeof value === 'boolean') return `${C.magenta}?${C.reset}`;
  return '';
}

// --- Format value ---
function formatValue(value) {
  if (value === null) return `${C.dim}null${C.reset}`;
  if (value === undefined) return `${C.dim}undefined${C.reset}`;
  if (typeof value === 'string') return `${C.green}"${value}"${C.reset}`;
  if (typeof value === 'number') return `${C.yellow}${value}${C.reset}`;
  if (typeof value === 'boolean') return `${C.magenta}${value}${C.reset}`;
  return String(value);
}

// --- Render tree ---
function renderTree(data, options = {}, prefix = '', path = '$', isLast = true) {
  const {
    maxDepth = Infinity,
    showArrays = true,
    showTypes = false,
    showPaths = false,
    compact = false,
    currentDepth = 0,
  } = options;

  const lines = [];

  if (currentDepth >= maxDepth) {
    if (Array.isArray(data)) {
      lines.push(`${prefix}${C.blue}[${data.length} items]${C.reset}`);
    } else if (typeof data === 'object' && data !== null) {
      lines.push(`${prefix}${C.cyan}{${Object.keys(data).length} keys}${C.reset}`);
    }
    return lines;
  }

  if (data === null || typeof data !== 'object') {
    return lines;
  }

  const entries = Array.isArray(data)
    ? data.map((v, i) => [showArrays ? String(i) : null, v])
    : Object.entries(data);

  entries.forEach(([key, value], index) => {
    const isLastItem = index === entries.length - 1;
    const connector = isLastItem ? SYMBOLS.last : SYMBOLS.branch;
    const newPrefix = prefix + (isLastItem ? SYMBOLS.space : SYMBOLS.indent);

    let keyStr = '';
    if (key !== null) {
      keyStr = Array.isArray(data)
        ? `${C.dim}[${key}]${C.reset}`
        : `${C.cyan}${key}${C.reset}`;
    }

    let valueStr = '';
    let typeStr = '';

    if (showTypes) {
      typeStr = ` ${typeIndicator(value)}`;
    }

    if (value === null || typeof value !== 'object') {
      valueStr = `: ${formatValue(value)}`;
    } else if (Array.isArray(value)) {
      valueStr = value.length > 0 ? '' : `: ${C.blue}[]${C.reset}`;
    } else {
      const keys = Object.keys(value);
      valueStr = keys.length > 0 ? '' : `: ${C.cyan}{}${C.reset}`;
    }

    let pathStr = '';
    if (showPaths) {
      const currentPath = Array.isArray(data) ? `${path}[${key}]` : `${path}.${key}`;
      pathStr = ` ${C.dim}${currentPath}${C.reset}`;
    }

    lines.push(`${prefix}${connector}${keyStr}${typeStr}${valueStr}${pathStr}`);

    // Recurse into objects/arrays
    if (value !== null && typeof value === 'object') {
      const childPath = Array.isArray(data) ? `${path}[${key}]` : `${path}.${key}`;
      const childLines = renderTree(value, {
        ...options,
        currentDepth: currentDepth + 1,
      }, newPrefix, childPath, isLastItem);
      lines.push(...childLines);
    }
  });

  return lines;
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let maxDepth = Infinity;
  let showArrays = true;
  let showTypes = false;
  let showPaths = false;
  let compact = false;
  let noColor = false;
  let file = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-d' || arg === '--depth') {
      maxDepth = parseInt(args[++i]) || Infinity;
    } else if (arg === '-a' || arg === '--arrays') {
      showArrays = true;
    } else if (arg === '-t' || arg === '--types') {
      showTypes = true;
    } else if (arg === '-p' || arg === '--paths') {
      showPaths = true;
    } else if (arg === '--compact') {
      compact = true;
    } else if (arg === '--no-color') {
      noColor = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { maxDepth, showArrays, showTypes, showPaths, compact, noColor, file };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Disable colors if requested
  if (opts.noColor) {
    Object.keys(C).forEach(k => C[k] = '');
  }

  // Read input
  let input;
  if (opts.file) {
    try {
      input = readFileSync(opts.file, 'utf-8');
    } catch (err) {
      console.error(`  Error reading file: ${err.message}`);
      process.exit(1);
    }
  } else {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    input = Buffer.concat(chunks).toString('utf-8');
  }

  if (!input.trim()) {
    console.error('  Error: No JSON input');
    process.exit(1);
  }

  // Parse JSON
  let data;
  try {
    data = JSON.parse(input);
  } catch (err) {
    console.error(`  Error: Invalid JSON - ${err.message}`);
    process.exit(1);
  }

  // Render tree
  console.log();
  if (typeof data !== 'object' || data === null) {
    console.log(`  ${formatValue(data)}`);
  } else {
    const isArr = Array.isArray(data);
    const label = isArr
      ? `${C.blue}Array [${data.length}]${C.reset}`
      : `${C.cyan}Object {${Object.keys(data).length}}${C.reset}`;
    console.log(`  ${label}`);
    const lines = renderTree(data, opts, '  ', '$');
    console.log(lines.join('\n'));
  }
  console.log();
}

main();
