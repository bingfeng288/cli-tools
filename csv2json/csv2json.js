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
  cyan: '\x1b[36m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mcsv2json\x1b[0m - CSV to JSON converter

  \x1b[1mUsage:\x1b[0m
    csv2json <file>
    cat data.csv | csv2json

  \x1b[1mOptions:\x1b[0m
    -d, --delimiter <char>    CSV delimiter (default: auto-detect)
    --no-header               First row is not header
    --indent <n>              JSON indentation (default: 2)
    --compact                 Compact JSON output
    --array                   Output as array of arrays
    --columns <cols>          Specify column names (comma-separated)
    -h, --help                Show this help

  \x1b[1mExamples:\x1b[0m
    csv2json data.csv
    csv2json data.csv -d ";"
    csv2json data.csv --no-header
    csv2json data.csv --compact
    cat data.csv | csv2json
`);
}

// --- Parse CSV ---
function parseCSV(content, delimiter = null) {
  // Auto-detect delimiter
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

  // Last row
  if (current || row.length > 0) {
    row.push(current.trim());
    if (row.some(c => c !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

// --- Convert to JSON objects ---
function toJsonObjects(rows, headers = null) {
  if (rows.length === 0) return [];

  const headerRow = headers || rows[0];
  const dataRows = headers ? rows : rows.slice(1);

  return dataRows.map(row => {
    const obj = {};
    headerRow.forEach((header, i) => {
      let value = row[i] || '';

      // Try to parse numbers
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        value = parseFloat(value);
      }
      // Try to parse booleans
      else if (value.toLowerCase() === 'true') {
        value = true;
      } else if (value.toLowerCase() === 'false') {
        value = false;
      }
      // Try to parse null
      else if (value.toLowerCase() === 'null') {
        value = null;
      }

      obj[header] = value;
    });
    return obj;
  });
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
  let indent = 2;
  let compact = false;
  let arrayMode = false;
  let columns = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--no-header') {
      hasHeader = false;
    } else if (arg === '--indent') {
      indent = parseInt(args[++i]) || 2;
    } else if (arg === '--compact') {
      compact = true;
    } else if (arg === '--array') {
      arrayMode = true;
    } else if (arg === '--columns') {
      columns = args[++i].split(',').map(c => c.trim());
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, delimiter, hasHeader, indent, compact, arrayMode, columns };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read CSV
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

  // Parse CSV
  const rows = parseCSV(content, opts.delimiter);

  if (rows.length === 0) {
    console.log('[]');
    process.exit(0);
  }

  let result;

  if (opts.arrayMode) {
    // Output as array of arrays
    result = rows;
  } else {
    // Output as array of objects
    const headers = opts.columns || (opts.hasHeader ? rows[0] : null);
    const dataRows = opts.hasHeader && !opts.columns ? rows.slice(1) : rows;
    result = toJsonObjects(dataRows, headers);
  }

  // Output
  const output = opts.compact ? JSON.stringify(result) : JSON.stringify(result, null, opts.indent);
  console.log(output);
}

main();
