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
  \x1b[1mcsvpivot\x1b[0m - CSV pivot table tool

  \x1b[1mUsage:\x1b[0m
    csvpivot <file> -r <row> -c <col> -v <value>
    cat data.csv | csvpivot -r <row> -c <col> -v <value>

  \x1b[1mOptions:\x1b[0m
    -r, --row <column>      Row field
    -c, --col <column>      Column field
    -v, --value <column>    Value field
    -a, --agg <func>        Aggregation: sum, count, avg, min, max (default: sum)
    -d, --delimiter <char>  CSV delimiter (default: auto-detect)
    --fill <value>          Fill value for missing data (default: 0)
    --json                  Output as JSON
    -h, --help              Show this help

  \x1b[1mExamples:\x1b[0m
    csvpivot sales.csv -r product -c region -v amount
    csvpivot data.csv -r department -c status -v count -a count
    csvpivot data.csv -r month -c category -v revenue -a avg
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

// --- Aggregate functions ---
const AGG_FUNCS = {
  sum: (values) => values.reduce((s, v) => s + (parseFloat(v) || 0), 0),
  count: (values) => values.length,
  avg: (values) => {
    const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
    return nums.length > 0 ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
  },
  min: (values) => {
    const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.min(...nums) : 0;
  },
  max: (values) => {
    const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
    return nums.length > 0 ? Math.max(...nums) : 0;
  },
};

// --- Format number ---
function formatNumber(n) {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

// --- Create pivot table ---
function createPivot(rows, headers, rowIdx, colIdx, valIdx, aggFunc, fillValue = 0) {
  const dataRows = rows.slice(1);

  // Collect unique row and column values
  const rowValues = new Set();
  const colValues = new Set();
  const data = new Map();

  for (const row of dataRows) {
    const rowVal = row[rowIdx] || '';
    const colVal = row[colIdx] || '';
    const value = row[valIdx] || '';

    rowValues.add(rowVal);
    colValues.add(colVal);

    const key = `${rowVal}\0${colVal}`;
    if (!data.has(key)) {
      data.set(key, []);
    }
    data.get(key).push(value);
  }

  // Sort values
  const sortedRowValues = Array.from(rowValues).sort();
  const sortedColValues = Array.from(colValues).sort();

  // Build pivot table
  const pivotRows = [];
  for (const rowVal of sortedRowValues) {
    const pivotRow = [rowVal];
    for (const colVal of sortedColValues) {
      const key = `${rowVal}\0${colVal}`;
      const values = data.get(key) || [];
      if (values.length > 0) {
        pivotRow.push(formatNumber(AGG_FUNCS[aggFunc](values)));
      } else {
        pivotRow.push(fillValue.toString());
      }
    }
    pivotRows.push(pivotRow);
  }

  return {
    headers: [headers[rowIdx], ...sortedColValues],
    rows: pivotRows,
  };
}

// --- Display pivot table ---
function displayPivot(pivot) {
  const { headers, rows } = pivot;

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const dataWidths = rows.map(r => (r[i] || '').length);
    return Math.max(h.length, ...dataWidths);
  });

  // Header
  console.log();
  console.log(headers.map((h, i) => h.padStart(widths[i])).join('  '));
  console.log(widths.map(w => '─'.repeat(w)).join('──'));

  // Rows
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padStart(widths[i])).join('  '));
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

  let file = null;
  let rowField = null;
  let colField = null;
  let valField = null;
  let agg = 'sum';
  let delimiter = null;
  let fillValue = '0';
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-r' || arg === '--row') {
      rowField = args[++i];
    } else if (arg === '-c' || arg === '--col') {
      colField = args[++i];
    } else if (arg === '-v' || arg === '--value') {
      valField = args[++i];
    } else if (arg === '-a' || arg === '--agg') {
      agg = args[++i];
    } else if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--fill') {
      fillValue = args[++i];
    } else if (arg === '--json') {
      json = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, rowField, colField, valField, agg, delimiter, fillValue, json };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.rowField || !opts.colField || !opts.valField) {
    console.error(`  ${C.red}Error:${C.reset} Please specify --row, --col, and --value`);
    process.exit(1);
  }

  if (!AGG_FUNCS[opts.agg]) {
    console.error(`  ${C.red}Error:${C.reset} Unknown aggregation: ${opts.agg}`);
    console.error(`  Available: ${Object.keys(AGG_FUNCS).join(', ')}`);
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

    const headers = rows[0];

    const rowIdx = headers.indexOf(opts.rowField);
    const colIdx = headers.indexOf(opts.colField);
    const valIdx = headers.indexOf(opts.valField);

    if (rowIdx === -1) throw new Error(`Row field "${opts.rowField}" not found`);
    if (colIdx === -1) throw new Error(`Column field "${opts.colField}" not found`);
    if (valIdx === -1) throw new Error(`Value field "${opts.valField}" not found`);

    const pivot = createPivot(rows, headers, rowIdx, colIdx, valIdx, opts.agg, opts.fillValue);

    if (opts.json) {
      const result = {};
      for (const row of pivot.rows) {
        const rowKey = row[0];
        result[rowKey] = {};
        for (let i = 1; i < pivot.headers.length; i++) {
          result[rowKey][pivot.headers[i]] = row[i];
        }
      }
      console.log(JSON.stringify(result, null, 2));
    } else {
      displayPivot(pivot);
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
