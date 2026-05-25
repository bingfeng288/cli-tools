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
  \x1b[1mcsvflatten\x1b[0m - JSON to flat CSV converter

  \x1b[1mUsage:\x1b[0m
    csvflatten <file.json>
    cat data.json | csvflatten

  \x1b[1mOptions:\x1b[0m
    -d, --delimiter <char>    CSV delimiter (default: ,)
    --separator <char>        Key separator for nested objects (default: .)
    --no-header               Don't output header row
    --columns <cols>          Select specific columns (comma-separated)
    -h, --help                Show this help

  \x1b[1mExamples:\x1b[0m
    csvflatten data.json
    csvflatten data.json -d ";"
    csvflatten data.json --columns name,address.city
    cat data.json | csvflatten
`);
}

// --- Flatten object ---
function flattenObject(obj, prefix = '', separator = '.') {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey, separator));
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

// --- Get all keys ---
function getAllKeys(data, separator = '.') {
  const keys = new Set();

  for (const item of data) {
    const flat = flattenObject(item, '', separator);
    for (const key of Object.keys(flat)) {
      keys.add(key);
    }
  }

  return Array.from(keys);
}

// --- Escape CSV field ---
function escapeField(value, delimiter) {
  if (value === null || value === undefined) return '';

  const str = String(value);

  if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

// --- Convert to CSV ---
function toCsv(data, options = {}) {
  const { delimiter = ',', hasHeader = true, separator = '.', columns = null } = options;

  if (data.length === 0) return '';

  const flatData = data.map(d => flattenObject(d, '', separator));
  const headers = columns || getAllKeys(data, separator);

  const lines = [];

  // Header
  if (hasHeader) {
    lines.push(headers.map(h => escapeField(h, delimiter)).join(delimiter));
  }

  // Data rows
  for (const item of flatData) {
    const row = headers.map(h => escapeField(item[h], delimiter));
    lines.push(row.join(delimiter));
  }

  return lines.join('\n');
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let file = null;
  let delimiter = ',';
  let separator = '.';
  let hasHeader = true;
  let columns = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--separator') {
      separator = args[++i];
    } else if (arg === '--no-header') {
      hasHeader = false;
    } else if (arg === '--columns') {
      columns = args[++i].split(',').map(c => c.trim());
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, delimiter, separator, hasHeader, columns };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read JSON
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

  // Parse JSON
  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} Invalid JSON: ${err.message}`);
    process.exit(1);
  }

  // Ensure data is an array
  if (!Array.isArray(data)) {
    data = [data];
  }

  // Convert to CSV
  const csv = toCsv(data, {
    delimiter: opts.delimiter,
    hasHeader: opts.hasHeader,
    separator: opts.separator,
    columns: opts.columns,
  });

  console.log(csv);
}

main();
