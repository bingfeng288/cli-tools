#!/usr/bin/env node

import { readFileSync } from 'node:fs';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mcsvtranspose\x1b[0m - CSV transpose tool

  \x1b[1mUsage:\x1b[0m
    csvtranspose <file>
    cat data.csv | csvtranspose

  \x1b[1mOptions:\x1b[0m
    -d, --delimiter <char>  CSV delimiter (default: auto-detect)
    --no-header             First row is not header
    -h, --help              Show this help

  \x1b[1mExamples:\x1b[0m
    csvtranspose data.csv
    cat data.csv | csvtranspose
`);
}

// --- Parse CSV ---
function parseCSV(content, delimiter = null) {
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

  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(current.trim());
        current = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        row.push(current.trim());
        if (row.length > 0 && row.some(c => c !== '')) {
          rows.push(row);
        }
        row = [];
        current = '';
        if (char === '\r') i++;
      } else {
        current += char;
      }
    }
  }

  if (current || row.length > 0) {
    row.push(current.trim());
    if (row.some(c => c !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

// --- Transpose matrix ---
function transpose(rows) {
  if (rows.length === 0) return [];

  const maxCols = Math.max(...rows.map(r => r.length));
  const result = [];

  for (let col = 0; col < maxCols; col++) {
    const newRow = [];
    for (let row = 0; row < rows.length; row++) {
      newRow.push(rows[row][col] || '');
    }
    result.push(newRow);
  }

  return result;
}

// --- Format CSV ---
function formatCSV(rows, delimiter = ',') {
  return rows.map(row =>
    row.map(cell => {
      if (cell.includes(delimiter) || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(delimiter)
  ).join('\n');
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let file = null;
  let delimiter = null;
  let hasHeader = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--no-header') {
      hasHeader = false;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, delimiter, hasHeader };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read input
  let content;
  if (opts.file) {
    try {
      content = readFileSync(opts.file, 'utf-8');
    } catch (err) {
      console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
      process.exit(1);
    }
  } else if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    content = Buffer.concat(chunks).toString('utf-8');
  } else {
    showHelp();
    process.exit(1);
  }

  try {
    const rows = parseCSV(content, opts.delimiter);
    if (rows.length === 0) {
      console.log('');
      return;
    }

    const transposed = transpose(rows);
    console.log(formatCSV(transposed, opts.delimiter || ','));
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
