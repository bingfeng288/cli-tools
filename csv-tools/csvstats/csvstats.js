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
  \x1b[1mcsvstats\x1b[0m - CSV column statistics tool

  \x1b[1mUsage:\x1b[0m
    csvstats <file>
    cat data.csv | csvstats

  \x1b[1mOptions:\x1b[0m
    -c, --columns <cols>    Specific columns (comma-separated)
    -d, --delimiter <char>  CSV delimiter (default: auto-detect)
    --json                  Output as JSON
    -h, --help              Show this help

  \x1b[1mStatistics:\x1b[0m
    count, unique, missing
    min, max, range
    mean, median, mode
    std_dev, variance
    p25, p50, p75

  \x1b[1mExamples:\x1b[0m
    csvstats data.csv
    csvstats data.csv -c age,salary
    csvstats data.csv --json
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

// --- Statistics functions ---
function computeStats(values) {
  const nums = values.filter(v => v !== '' && v !== null && v !== undefined)
    .map(v => parseFloat(v))
    .filter(n => !isNaN(n));

  const allValues = values.filter(v => v !== '' && v !== null && v !== undefined);
  const missing = values.length - allValues.length;
  const unique = new Set(allValues).size;

  if (nums.length === 0) {
    return {
      count: values.length,
      unique,
      missing,
      isNumeric: false,
    };
  }

  // Sort for percentiles
  const sorted = [...nums].sort((a, b) => a - b);
  const n = sorted.length;

  // Basic stats
  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max - min;
  const sum = sorted.reduce((s, v) => s + v, 0);
  const mean = sum / n;

  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // Mode
  const freq = new Map();
  for (const v of sorted) {
    freq.set(v, (freq.get(v) || 0) + 1);
  }
  const maxFreq = Math.max(...freq.values());
  const modes = Array.from(freq.entries())
    .filter(([_, f]) => f === maxFreq)
    .map(([v]) => v);

  // Variance and std dev
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  // Percentiles
  const percentile = (p) => {
    const idx = (p / 100) * (n - 1);
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    if (low === high) return sorted[low];
    return sorted[low] + (sorted[high] - sorted[low]) * (idx - low);
  };

  return {
    count: values.length,
    unique,
    missing,
    isNumeric: true,
    min,
    max,
    range,
    mean,
    median,
    mode: modes.length === 1 ? modes[0] : modes,
    variance,
    stdDev,
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
  };
}

// --- Format number ---
function formatNumber(n) {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

// --- Display stats ---
function displayStats(columnName, stats) {
  console.log();
  console.log(`  ${C.bold}${C.cyan}${columnName}${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);

  console.log(`  Count:    ${stats.count}`);
  console.log(`  Unique:   ${stats.unique}`);
  if (stats.missing > 0) {
    console.log(`  Missing:  ${C.yellow}${stats.missing}${C.reset}`);
  }

  if (stats.isNumeric) {
    console.log();
    console.log(`  Min:      ${formatNumber(stats.min)}`);
    console.log(`  Max:      ${formatNumber(stats.max)}`);
    console.log(`  Range:    ${formatNumber(stats.range)}`);
    console.log();
    console.log(`  Mean:     ${formatNumber(stats.mean)}`);
    console.log(`  Median:   ${formatNumber(stats.median)}`);
    const modeStr = Array.isArray(stats.mode) ? stats.mode.map(formatNumber).join(', ') : formatNumber(stats.mode);
    console.log(`  Mode:     ${modeStr}`);
    console.log();
    console.log(`  Std Dev:  ${formatNumber(stats.stdDev)}`);
    console.log(`  Variance: ${formatNumber(stats.variance)}`);
    console.log();
    console.log(`  P25:      ${formatNumber(stats.p25)}`);
    console.log(`  P50:      ${formatNumber(stats.p50)}`);
    console.log(`  P75:      ${formatNumber(stats.p75)}`);
  }
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let file = null;
  let columns = null;
  let delimiter = null;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-c' || arg === '--columns') {
      columns = args[++i].split(',').map(c => c.trim());
    } else if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--json') {
      json = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, columns, delimiter, json };
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

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Determine columns to analyze
    const columnsToAnalyze = opts.columns || headers;

    // Compute stats for each column
    const results = {};
    for (const colName of columnsToAnalyze) {
      const colIdx = headers.indexOf(colName);
      if (colIdx === -1) {
        console.error(`  ${C.yellow}Warning:${C.reset} Column "${colName}" not found, skipping`);
        continue;
      }

      const values = dataRows.map(row => row[colIdx] || '');
      results[colName] = computeStats(values);
    }

    // Output
    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      for (const [colName, stats] of Object.entries(results)) {
        displayStats(colName, stats);
      }
      console.log();
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
