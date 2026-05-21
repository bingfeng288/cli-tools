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
  \x1b[1mcsvsample\x1b[0m - CSV row sampling tool

  \x1b[1mUsage:\x1b[0m
    csvsample <file> -n <count>
    csvsample <file> -p <percent>
    cat data.csv | csvsample -n <count>

  \x1b[1mOptions:\x1b[0m
    -n, --count <n>         Number of rows to sample
    -p, --percent <n>       Percentage of rows to sample (0-100)
    -s, --seed <n>          Random seed for reproducibility
    --first <n>             Get first N rows
    --last <n>              Get last N rows
    -d, --delimiter <char>  CSV delimiter (default: auto-detect)
    --no-header             First row is not header
    -h, --help              Show this help

  \x1b[1mExamples:\x1b[0m
    csvsample data.csv -n 100
    csvsample data.csv -p 10
    csvsample data.csv -n 50 --seed 42
    csvsample data.csv --first 10
    cat data.csv | csvsample -n 50
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

// --- Seeded random number generator ---
function createRNG(seed) {
  let s = seed;
  return function() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// --- Fisher-Yates shuffle ---
function shuffle(array, rng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
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
  let count = null;
  let percent = null;
  let seed = null;
  let first = null;
  let last = null;
  let delimiter = null;
  let hasHeader = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--count') {
      count = parseInt(args[++i]);
    } else if (arg === '-p' || arg === '--percent') {
      percent = parseFloat(args[++i]);
    } else if (arg === '-s' || arg === '--seed') {
      seed = parseInt(args[++i]);
    } else if (arg === '--first') {
      first = parseInt(args[++i]);
    } else if (arg === '--last') {
      last = parseInt(args[++i]);
    } else if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--no-header') {
      hasHeader = false;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, count, percent, seed, first, last, delimiter, hasHeader };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.count && !opts.percent && !opts.first && !opts.last) {
    console.error(`  ${C.red}Error:${C.reset} Please specify --count, --percent, --first, or --last`);
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

    const header = opts.hasHeader ? rows[0] : null;
    const dataRows = opts.hasHeader ? rows.slice(1) : rows;

    let sampled;

    if (opts.first) {
      sampled = dataRows.slice(0, opts.first);
    } else if (opts.last) {
      sampled = dataRows.slice(-opts.last);
    } else {
      let sampleCount;
      if (opts.percent) {
        sampleCount = Math.ceil(dataRows.length * opts.percent / 100);
      } else {
        sampleCount = opts.count;
      }

      // Clamp to available rows
      sampleCount = Math.min(sampleCount, dataRows.length);

      // Create RNG
      const rng = opts.seed !== null ? createRNG(opts.seed) : Math.random;

      // Shuffle and take first N
      const shuffled = shuffle(dataRows, rng);
      sampled = shuffled.slice(0, sampleCount);
    }

    // Output
    const output = header ? [header, ...sampled] : sampled;
    console.log(formatCSV(output, opts.delimiter || ','));

    // Show stats to stderr
    console.error(`  ${C.dim}Sampled ${sampled.length} of ${dataRows.length} rows${C.reset}`);
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
