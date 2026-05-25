#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

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
  \x1b[1mcsvsplit\x1b[0m - CSV file splitting tool

  \x1b[1mUsage:\x1b[0m
    csvsplit <file> -n <rows>
    csvsplit <file> -p <parts>

  \x1b[1mOptions:\x1b[0m
    -n, --rows <n>          Max rows per file (excluding header)
    -p, --parts <n>         Split into N parts
    -o, --output <dir>      Output directory (default: current)
    -d, --delimiter <char>  CSV delimiter (default: auto-detect)
    --no-header             Don't repeat header in each chunk
    -h, --help              Show this help

  \x1b[1mExamples:\x1b[0m
    csvsplit data.csv -n 1000
    csvsplit data.csv -p 5
    csvsplit data.csv -n 500 -o output/
`);
}

// --- Parse CSV lines ---
function parseCSVLines(content, delimiter = null) {
  if (!delimiter) {
    const firstLine = content.split('\n')[0];
    const counts = {
      ',': (firstLine.match(/,/g) || []).length,
      '\t': (firstLine.match(/\t/g) || []).length,
      ';': (firstLine.match(/;/g) || []).length,
      '|': (firstLine.match(/\|/g) || []).length,
    };
    delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
        current += char;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        current += char;
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        lines.push(current);
        current = '';
        if (char === '\r') i++;
      } else {
        current += char;
      }
    }
  }

  if (current) {
    lines.push(current);
  }

  return { lines, delimiter };
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let file = null;
  let rows = null;
  let parts = null;
  let output = '.';
  let delimiter = null;
  let noHeader = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--rows') {
      rows = parseInt(args[++i]);
    } else if (arg === '-p' || arg === '--parts') {
      parts = parseInt(args[++i]);
    } else if (arg === '-o' || arg === '--output') {
      output = args[++i];
    } else if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--no-header') {
      noHeader = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, rows, parts, output, delimiter, noHeader };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.file) {
    showHelp();
    process.exit(1);
  }

  if (!opts.rows && !opts.parts) {
    console.error(`  ${C.red}Error:${C.reset} Please specify --rows or --parts`);
    process.exit(1);
  }

  try {
    const content = readFileSync(opts.file, 'utf-8');
    const { lines, delimiter } = parseCSVLines(content, opts.delimiter);

    if (lines.length === 0) {
      console.error(`  ${C.red}Error:${C.reset} File is empty`);
      process.exit(1);
    }

    const header = lines[0];
    const dataLines = lines.slice(1);

    // Create output directory if needed
    try {
      mkdirSync(opts.output, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    // Calculate chunk size
    let chunkSize;
    if (opts.parts) {
      chunkSize = Math.ceil(dataLines.length / opts.parts);
    } else {
      chunkSize = opts.rows;
    }

    // Split into chunks
    const chunks = [];
    for (let i = 0; i < dataLines.length; i += chunkSize) {
      chunks.push(dataLines.slice(i, i + chunkSize));
    }

    // Write chunks
    const ext = extname(opts.file);
    const baseName = basename(opts.file, ext);

    for (let i = 0; i < chunks.length; i++) {
      const chunkNum = String(i + 1).padStart(3, '0');
      const outputFile = join(opts.output, `${baseName}_${chunkNum}${ext}`);

      const lines = opts.noHeader ? chunks[i] : [header, ...chunks[i]];
      writeFileSync(outputFile, lines.join('\n') + '\n');

      console.log(`  ${C.green}Created:${C.reset} ${outputFile} (${chunks[i].length} rows)`);
    }

    console.log();
    console.log(`  ${C.bold}Summary${C.reset}`);
    console.log(`  ${C.dim}${'─'.repeat(30)}${C.reset}`);
    console.log(`  Total rows: ${dataLines.length}`);
    console.log(`  Files created: ${chunks.length}`);
    console.log(`  Rows per file: ~${chunkSize}`);
    console.log();

  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
