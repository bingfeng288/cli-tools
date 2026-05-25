#!/usr/bin/env node

import { readFileSync } from 'node:fs';

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mmdtable\x1b[0m - Markdown table generator

  \x1b[1mUsage:\x1b[0m
    mdtable [file] [options]
    cat data.json | mdtable

  \x1b[1mInput Formats:\x1b[0m
    JSON array of objects    [{"name":"Alice","age":30}, ...]
    JSON array of arrays     [["Name","Age"],["Alice",30], ...]
    CSV data                 name,age\nAlice,30\n...

  \x1b[1mOptions:\x1b[0m
    -f, --format <fmt>       Input format: json, csv (auto-detected)
    -a, --align <align>      Column alignment: left, center, right (default: left)
    -w, --width <width>      Minimum column width
    --no-header              Don't treat first row as header
    --border                 Add outer borders
    -h, --help               Show this help

  \x1b[1mExamples:\x1b[0m
    echo '[{"name":"Alice","age":30}]' | mdtable
    mdtable data.json
    mdtable data.csv
    echo 'name,age\nAlice,30' | mdtable -f csv
    mdtable data.json -a center
    mdtable data.json --border
`);
}

// --- Parse CSV ---
function parseCsv(text, hasHeader = true) {
  const lines = text.trim().split('\n').map(line => {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });

  if (lines.length === 0) return { headers: [], rows: [] };

  if (hasHeader) {
    return {
      headers: lines[0],
      rows: lines.slice(1),
    };
  }

  return {
    headers: lines[0].map((_, i) => `Column ${i + 1}`),
    rows: lines,
  };
}

// --- Parse JSON ---
function parseJson(text, hasHeader = true) {
  const data = JSON.parse(text);

  if (!Array.isArray(data) || data.length === 0) {
    return { headers: [], rows: [] };
  }

  // Array of objects
  if (typeof data[0] === 'object' && !Array.isArray(data[0])) {
    const headers = [...new Set(data.flatMap(obj => Object.keys(obj)))];
    const rows = data.map(obj => headers.map(h => String(obj[h] ?? '')));
    return { headers, rows };
  }

  // Array of arrays
  if (Array.isArray(data[0])) {
    if (hasHeader) {
      return {
        headers: data[0].map(String),
        rows: data.slice(1).map(row => row.map(String)),
      };
    }
    return {
      headers: data[0].map((_, i) => `Column ${i + 1}`),
      rows: data.map(row => row.map(String)),
    };
  }

  // Array of primitives
  return {
    headers: ['Value'],
    rows: data.map(v => [String(v)]),
  };
}

// --- Generate markdown table ---
function generateTable(headers, rows, alignment = 'left', minWidth = 0, border = false) {
  if (headers.length === 0) return '';

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxData = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxData, minWidth);
  });

  // Alignment markers
  const alignMarker = {
    left: (w) => ':' + '-'.repeat(w - 1),
    center: (w) => ':' + '-'.repeat(w - 2) + ':',
    right: (w) => '-'.repeat(w - 1) + ':',
  };

  const getMarker = (w) => {
    if (alignment === 'center') return alignMarker.center(w);
    if (alignment === 'right') return alignMarker.right(w);
    return alignMarker.left(w);
  };

  const pad = (str, w) => str.padEnd(w);
  const b = border ? '| ' : '';
  const e = border ? ' |' : '';
  const s = border ? '|' : '';

  // Build table
  const lines = [];

  // Header
  lines.push(b + headers.map((h, i) => pad(h, widths[i])).join(' | ') + e);

  // Separator
  lines.push(s + widths.map(w => getMarker(w)).join('|') + s);

  // Rows
  for (const row of rows) {
    const cells = headers.map((_, i) => pad(row[i] || '', widths[i]));
    lines.push(b + cells.join(' | ') + e);
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

  let format = null;
  let alignment = 'left';
  let minWidth = 0;
  let noHeader = false;
  let border = false;
  let file = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-f' || arg === '--format') {
      format = args[++i]?.toLowerCase();
    } else if (arg === '-a' || arg === '--align') {
      alignment = args[++i]?.toLowerCase() || 'left';
    } else if (arg === '-w' || arg === '--width') {
      minWidth = parseInt(args[++i]) || 0;
    } else if (arg === '--no-header') {
      noHeader = true;
    } else if (arg === '--border') {
      border = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { format, alignment, minWidth, noHeader, border, file };
}

// --- Auto-detect format ---
function detectFormat(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
  return 'csv';
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
    console.error('  Error: No input data');
    process.exit(1);
  }

  // Detect format
  const format = opts.format || detectFormat(input);

  // Parse input
  let headers, rows;
  try {
    if (format === 'json') {
      const result = parseJson(input, !opts.noHeader);
      headers = result.headers;
      rows = result.rows;
    } else {
      const result = parseCsv(input, !opts.noHeader);
      headers = result.headers;
      rows = result.rows;
    }
  } catch (err) {
    console.error(`  Error parsing input: ${err.message}`);
    process.exit(1);
  }

  // Generate table
  const table = generateTable(headers, rows, opts.alignment, opts.minWidth, opts.border);
  console.log(table);
}

main();
