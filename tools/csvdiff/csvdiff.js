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
  \x1b[1mcsvdiff\x1b[0m - CSV file comparison tool

  \x1b[1mUsage:\x1b[0m
    csvdiff <file1> <file2>

  \x1b[1mOptions:\x1b[0m
    -k, --key <column>     Key column for row matching (default: first column)
    -d, --delimiter <char> CSV delimiter (default: auto-detect)
    --json                 Output as JSON
    --summary              Show only summary
    -h, --help             Show this help

  \x1b[1mExamples:\x1b[0m
    csvdiff old.csv new.csv
    csvdiff old.csv new.csv -k id
    csvdiff old.csv new.csv --json
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
  let delimiter = null;
  let json = false;
  let summary = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-k' || arg === '--key') {
      key = args[++i];
    } else if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--summary') {
      summary = true;
    } else if (!arg.startsWith('-')) {
      if (!file1) file1 = arg;
      else if (!file2) file2 = arg;
    }
  }

  return { file1, file2, key, delimiter, json, summary };
}

// --- Find key column index ---
function findKeyIndex(headers, key) {
  if (!key) return 0;
  const idx = headers.indexOf(key);
  if (idx === -1) {
    throw new Error(`Key column "${key}" not found. Available: ${headers.join(', ')}`);
  }
  return idx;
}

// --- Compare CSV files ---
function compareCSV(rows1, rows2, keyIdx) {
  const headers1 = rows1[0] || [];
  const headers2 = rows2[0] || [];
  const data1 = rows1.slice(1);
  const data2 = rows2.slice(1);

  // Build maps by key
  const map1 = new Map();
  const map2 = new Map();

  for (const row of data1) {
    const key = row[keyIdx] || '';
    map1.set(key, row);
  }

  for (const row of data2) {
    const key = row[keyIdx] || '';
    map2.set(key, row);
  }

  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  // Find removed and changed
  for (const [key, row1] of map1) {
    if (!map2.has(key)) {
      removed.push({ key, row: row1 });
    } else {
      const row2 = map2.get(key);
      if (JSON.stringify(row1) === JSON.stringify(row2)) {
        unchanged.push({ key, row: row1 });
      } else {
        const diffs = [];
        for (let i = 0; i < Math.max(row1.length, row2.length); i++) {
          if (row1[i] !== row2[i]) {
            diffs.push({
              column: headers1[i] || `col${i}`,
              oldValue: row1[i] || '',
              newValue: row2[i] || '',
            });
          }
        }
        changed.push({ key, oldRow: row1, newRow: row2, diffs });
      }
    }
  }

  // Find added
  for (const [key, row2] of map2) {
    if (!map1.has(key)) {
      added.push({ key, row: row2 });
    }
  }

  return { headers: headers1, added, removed, changed, unchanged };
}

// --- Display diff ---
function displayDiff(result, options = {}) {
  const { summary = false } = options;
  const { headers, added, removed, changed, unchanged } = result;

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    console.log(`  ${C.green}Files are identical${C.reset}`);
    return;
  }

  console.log();

  if (!summary) {
    if (added.length > 0) {
      console.log(`  ${C.green}Added rows:${C.reset}`);
      for (const { key, row } of added) {
        console.log(`    ${C.green}+${C.reset} [${key}] ${row.join(', ')}`);
      }
      console.log();
    }

    if (removed.length > 0) {
      console.log(`  ${C.red}Removed rows:${C.reset}`);
      for (const { key, row } of removed) {
        console.log(`    ${C.red}-${C.reset} [${key}] ${row.join(', ')}`);
      }
      console.log();
    }

    if (changed.length > 0) {
      console.log(`  ${C.yellow}Changed rows:${C.reset}`);
      for (const { key, diffs } of changed) {
        console.log(`    ${C.yellow}~${C.reset} [${key}]`);
        for (const { column, oldValue, newValue } of diffs) {
          console.log(`      ${C.red}- ${column}: ${oldValue}${C.reset}`);
          console.log(`      ${C.green}+ ${column}: ${newValue}${C.reset}`);
        }
      }
      console.log();
    }
  }

  // Summary
  console.log(`  ${C.bold}Summary${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(30)}${C.reset}`);
  if (added.length > 0) console.log(`  ${C.green}Added:${C.reset}      ${added.length}`);
  if (removed.length > 0) console.log(`  ${C.red}Removed:${C.reset}    ${removed.length}`);
  if (changed.length > 0) console.log(`  ${C.yellow}Changed:${C.reset}    ${changed.length}`);
  if (unchanged.length > 0) console.log(`  ${C.dim}Unchanged:${C.reset}  ${unchanged.length}`);
  console.log();
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
    const keyIdx = findKeyIndex(headers1, opts.key);

    const result = compareCSV(rows1, rows2, keyIdx);

    if (opts.json) {
      console.log(JSON.stringify({
        added: result.added.map(({ key, row }) => ({ key, row })),
        removed: result.removed.map(({ key, row }) => ({ key, row })),
        changed: result.changed.map(({ key, diffs }) => ({ key, diffs })),
        summary: {
          added: result.added.length,
          removed: result.removed.length,
          changed: result.changed.length,
          unchanged: result.unchanged.length,
        },
      }, null, 2));
    } else {
      displayDiff(result, { summary: opts.summary });
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
