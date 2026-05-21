#!/usr/bin/env node

import { readFileSync } from 'node:fs';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mcsvsort\x1b[0m - CSV sorting tool

  \x1b[1mUsage:\x1b[0m
    csvsort <file> -k <column>
    cat data.csv | csvsort -k <column>

  \x1b[1mOptions:\x1b[0m
    -k, --key <columns>     Sort by columns (comma-separated)
    -r, --reverse           Sort descending
    -n, --numeric           Numeric sort
    -d, --delimiter <char>  CSV delimiter (default: auto-detect)
    --no-header             First row is not header
    -h, --help              Show this help

  \x1b[1mExamples:\x1b[0m
    csvsort data.csv -k name
    csvsort data.csv -k age -r
    csvsort data.csv -k lastname,firstname
    csvsort data.csv -k salary -n -r
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

// --- Find column indices ---
function findColumnIndices(headers, columns) {
  return columns.map(col => {
    const idx = headers.indexOf(col);
    if (idx === -1) {
      throw new Error(`Column "${col}" not found. Available: ${headers.join(', ')}`);
    }
    return idx;
  });
}

// --- Compare values ---
function compareValues(a, b, numeric = false) {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;

  if (numeric) {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
  }

  // Try numeric comparison
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numA - numB;
  }

  // String comparison
  return String(a).localeCompare(String(b));
}

// --- Sort rows ---
function sortRows(rows, keyIndices, options = {}) {
  const { reverse = false, numeric = false } = options;

  return [...rows].sort((a, b) => {
    for (const idx of keyIndices) {
      const cmp = compareValues(a[idx], b[idx], numeric);
      if (cmp !== 0) {
        return reverse ? -cmp : cmp;
      }
    }
    return 0;
  });
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
  let keys = [];
  let reverse = false;
  let numeric = false;
  let delimiter = null;
  let hasHeader = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-k' || arg === '--key') {
      keys = args[++i].split(',').map(k => k.trim());
    } else if (arg === '-r' || arg === '--reverse') {
      reverse = true;
    } else if (arg === '-n' || arg === '--numeric') {
      numeric = true;
    } else if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--no-header') {
      hasHeader = false;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, keys, reverse, numeric, delimiter, hasHeader };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (opts.keys.length === 0) {
    console.error(`  ${C.red}Error:${C.reset} Please specify sort columns with -k`);
    process.exit(1);
  }

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

    const headers = opts.hasHeader ? rows[0] : rows[0].map((_, i) => `col${i}`);
    const dataRows = opts.hasHeader ? rows.slice(1) : rows;

    const keyIndices = findColumnIndices(headers, opts.keys);

    const sorted = sortRows(dataRows, keyIndices, {
      reverse: opts.reverse,
      numeric: opts.numeric,
    });

    const output = opts.hasHeader ? [headers, ...sorted] : sorted;
    console.log(formatCSV(output, opts.delimiter || ','));
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
