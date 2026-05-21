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
  \x1b[1mcsvmerge\x1b[0m - CSV merge/join tool

  \x1b[1mUsage:\x1b[0m
    csvmerge <file1> <file2> -k <column>

  \x1b[1mOptions:\x1b[0m
    -k, --key <column>      Join column (default: first column)
    -t, --type <type>       Join type: inner, left, right, full (default: inner)
    -d, --delimiter <char>  CSV delimiter (default: auto-detect)
    --fill <value>          Fill value for missing data (default: empty)
    -h, --help              Show this help

  \x1b[1mJoin Types:\x1b[0m
    inner   Only matching rows from both files
    left    All rows from file1, matching from file2
    right   All rows from file2, matching from file1
    full    All rows from both files

  \x1b[1mExamples:\x1b[0m
    csvmerge users.csv orders.csv -k user_id
    csvmerge data1.csv data2.csv -k id -t left
    csvmerge data1.csv data2.csv -k id -t full --fill N/A
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

// --- Build index ---
function buildIndex(rows, keyIdx) {
  const index = new Map();
  for (const row of rows) {
    const key = row[keyIdx] || '';
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(row);
  }
  return index;
}

// --- Merge CSV ---
function mergeCSV(rows1, rows2, keyIdx1, keyIdx2, joinType, fillValue = '') {
  const headers1 = rows1[0] || [];
  const headers2 = rows2[0] || [];
  const data1 = rows1.slice(1);
  const data2 = rows2.slice(1);

  // Remove key column from headers2 to avoid duplication
  const headers2Filtered = headers2.filter((_, i) => i !== keyIdx2);
  const mergedHeaders = [...headers1, ...headers2Filtered];

  // Build indices
  const index1 = buildIndex(data1, keyIdx1);
  const index2 = buildIndex(data2, keyIdx2);

  const merged = [];
  const usedKeys = new Set();

  // Process based on join type
  if (joinType === 'inner' || joinType === 'left' || joinType === 'full') {
    for (const [key, rows1Group] of index1) {
      usedKeys.add(key);
      if (index2.has(key)) {
        const rows2Group = index2.get(key);
        for (const row1 of rows1Group) {
          for (const row2 of rows2Group) {
            const mergedRow = [...row1];
            for (let i = 0; i < row2.length; i++) {
              if (i !== keyIdx2) {
                mergedRow.push(row2[i]);
              }
            }
            merged.push(mergedRow);
          }
        }
      } else if (joinType === 'left' || joinType === 'full') {
        for (const row1 of rows1Group) {
          const mergedRow = [...row1];
          for (let i = 0; i < headers2.length; i++) {
            if (i !== keyIdx2) {
              mergedRow.push(fillValue);
            }
          }
          merged.push(mergedRow);
        }
      }
    }
  }

  if (joinType === 'right' || joinType === 'full') {
    for (const [key, rows2Group] of index2) {
      if (!usedKeys.has(key) || joinType === 'right') {
        if (joinType === 'right' || !index1.has(key)) {
          for (const row2 of rows2Group) {
            const mergedRow = [];
            for (let i = 0; i < headers1.length; i++) {
              if (i === keyIdx1) {
                mergedRow.push(key);
              } else {
                mergedRow.push(fillValue);
              }
            }
            for (let i = 0; i < row2.length; i++) {
              if (i !== keyIdx2) {
                mergedRow.push(row2[i]);
              }
            }
            merged.push(mergedRow);
          }
        }
      }
    }
  }

  return { headers: mergedHeaders, rows: merged };
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

  let file1 = null;
  let file2 = null;
  let key = null;
  let joinType = 'inner';
  let delimiter = null;
  let fillValue = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-k' || arg === '--key') {
      key = args[++i];
    } else if (arg === '-t' || arg === '--type') {
      joinType = args[++i];
    } else if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--fill') {
      fillValue = args[++i];
    } else if (!arg.startsWith('-')) {
      if (!file1) file1 = arg;
      else if (!file2) file2 = arg;
    }
  }

  return { file1, file2, key, joinType, delimiter, fillValue };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.file1 || !opts.file2) {
    showHelp();
    process.exit(1);
  }

  try {
    const content1 = readFileSync(opts.file1, 'utf-8');
    const content2 = readFileSync(opts.file2, 'utf-8');

    const rows1 = parseCSV(content1, opts.delimiter);
    const rows2 = parseCSV(content2, opts.delimiter);

    if (rows1.length === 0 || rows2.length === 0) {
      console.error(`  ${C.red}Error:${C.reset} One or both files are empty`);
      process.exit(1);
    }

    const headers1 = rows1[0];
    const headers2 = rows2[0];

    const keyIdx1 = opts.key ? headers1.indexOf(opts.key) : 0;
    const keyIdx2 = opts.key ? headers2.indexOf(opts.key) : 0;

    if (keyIdx1 === -1) {
      throw new Error(`Key column "${opts.key}" not found in ${opts.file1}`);
    }
    if (keyIdx2 === -1) {
      throw new Error(`Key column "${opts.key}" not found in ${opts.file2}`);
    }

    const result = mergeCSV(rows1, rows2, keyIdx1, keyIdx2, opts.joinType, opts.fillValue);
    const output = [result.headers, ...result.rows];
    console.log(formatCSV(output, opts.delimiter || ','));
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
