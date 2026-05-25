#!/usr/bin/env node

import { readFileSync } from 'node:fs';

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mjsoncsv\x1b[0m - JSON to CSV converter

  \x1b[1mUsage:\x1b[0m
    jsoncsv [file] [options]
    cat data.json | jsoncsv

  \x1b[1mOptions:\x1b[0m
    -d, --delimiter <char>    Field delimiter (default: ,)
    -n, --no-header           Don't include header row
    -f, --flatten             Flatten nested objects
    --select <fields>         Select specific fields (comma-separated)
    --filter <expr>           Filter rows (field=value)
    -h, --help                Show this help

  \x1b[1mExamples:\x1b[0m
    jsoncsv data.json
    jsoncsv data.json -d ";"
    jsoncsv data.json -f
    jsoncsv data.json --select "name,age,city"
    jsoncsv data.json --filter "age>25"
    echo '[{"a":1},{"a":2}]' | jsoncsv
`);
}

// --- Flatten object ---
function flatten(obj, prefix = '') {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, newKey));
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

// --- Get all keys ---
function getAllKeys(data, doFlatten = false) {
  const keys = new Set();

  data.forEach(item => {
    const processed = doFlatten ? flatten(item) : item;
    Object.keys(processed).forEach(k => keys.add(k));
  });

  return [...keys];
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

// --- Filter expression ---
function matchesFilter(item, filter) {
  const match = filter.match(/^([a-zA-Z0-9._]+)\s*(==|!=|>|<|>=|<=|=)\s*(.+)$/);
  if (!match) return true;

  const [, field, op, value] = match;
  const itemValue = field.split('.').reduce((o, k) => o?.[k], item);

  if (itemValue === undefined) return false;

  let expected = value.trim();
  if (expected.startsWith('"') && expected.endsWith('"')) expected = expected.slice(1, -1);
  if (expected === 'true') expected = true;
  if (expected === 'false') expected = false;
  if (!isNaN(expected) && expected !== '') expected = Number(expected);

  switch (op) {
    case '=':
    case '==': return itemValue == expected;
    case '!=': return itemValue != expected;
    case '>': return itemValue > expected;
    case '<': return itemValue < expected;
    case '>=': return itemValue >= expected;
    case '<=': return itemValue <= expected;
    default: return true;
  }
}

// --- Convert to CSV ---
function toCsv(data, options = {}) {
  const {
    delimiter = ',',
    noHeader = false,
    flatten: doFlatten = false,
    select = null,
    filter = null,
  } = options;

  // Filter
  if (filter) {
    data = data.filter(item => matchesFilter(item, filter));
  }

  // Flatten
  const processed = doFlatten ? data.map(item => flatten(item)) : data;

  // Get headers
  let headers = getAllKeys(processed, doFlatten);
  if (select) {
    headers = select.split(',').map(s => s.trim());
  }

  // Build CSV
  const lines = [];

  if (!noHeader) {
    lines.push(headers.map(h => escapeField(h, delimiter)).join(delimiter));
  }

  processed.forEach(item => {
    const row = headers.map(h => {
      const value = item[h] !== undefined ? item[h] : h.split('.').reduce((o, k) => o?.[k], item);
      return escapeField(value, delimiter);
    });
    lines.push(row.join(delimiter));
  });

  return lines.join('\n');
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let delimiter = ',';
  let noHeader = false;
  let flatten = false;
  let select = null;
  let filter = null;
  let file = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i] || ',';
    } else if (arg === '-n' || arg === '--no-header') {
      noHeader = true;
    } else if (arg === '-f' || arg === '--flatten') {
      flatten = true;
    } else if (arg === '--select') {
      select = args[++i];
    } else if (arg === '--filter') {
      filter = args[++i];
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { delimiter, noHeader, flatten, select, filter, file };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

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
    if (!Array.isArray(data)) data = [data];
  } catch (err) {
    console.error(`  Error: Invalid JSON - ${err.message}`);
    process.exit(1);
  }

  // Convert
  const csv = toCsv(data, opts);
  console.log(csv);
}

main();
