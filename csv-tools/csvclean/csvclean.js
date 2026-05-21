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
  \x1b[1mcsvclean\x1b[0m - CSV cleaning and normalization tool

  \x1b[1mUsage:\x1b[0m
    csvclean <file>
    cat data.csv | csvclean

  \x1b[1mOptions:\x1b[0m
    --dedupe              Remove duplicate rows
    --no-empty            Remove empty rows
    --trim                Trim whitespace from cells
    --no-empty-cols       Remove empty columns
    --normalize-newlines  Normalize line endings to LF
    -d, --delimiter <char> CSV delimiter (default: auto-detect)
    --dry-run             Show what would be cleaned without writing
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    csvclean data.csv --dedupe --trim
    csvclean data.csv --no-empty --no-empty-cols
    cat data.csv | csvclean --dedupe
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
        row.push(current);
        current = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
        if (char === '\r') i++;
      } else {
        current += char;
      }
    }
  }

  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return { rows, delimiter };
}

// --- Remove empty rows ---
function removeEmptyRows(rows) {
  return rows.filter(row => row.some(cell => cell.trim() !== ''));
}

// --- Remove duplicate rows ---
function removeDuplicates(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- Trim whitespace ---
function trimCells(rows) {
  return rows.map(row => row.map(cell => cell.trim()));
}

// --- Remove empty columns ---
function removeEmptyColumns(rows) {
  if (rows.length === 0) return rows;

  const maxCols = Math.max(...rows.map(r => r.length));
  const nonEmptyCols = [];

  for (let col = 0; col < maxCols; col++) {
    const hasData = rows.some(row => row[col] && row[col].trim() !== '');
    if (hasData) {
      nonEmptyCols.push(col);
    }
  }

  return rows.map(row => nonEmptyCols.map(col => row[col] || ''));
}

// --- Normalize newlines ---
function normalizeNewlines(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
  let dedupe = false;
  let noEmpty = false;
  let trim = false;
  let noEmptyCols = false;
  let normalize = false;
  let delimiter = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dedupe') {
      dedupe = true;
    } else if (arg === '--no-empty') {
      noEmpty = true;
    } else if (arg === '--trim') {
      trim = true;
    } else if (arg === '--no-empty-cols') {
      noEmptyCols = true;
    } else if (arg === '--normalize-newlines') {
      normalize = true;
    } else if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, dedupe, noEmpty, trim, noEmptyCols, normalize, delimiter, dryRun };
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
    // Normalize newlines if requested
    if (opts.normalize) {
      content = normalizeNewlines(content);
    }

    const { rows, delimiter } = parseCSV(content, opts.delimiter);
    const originalCount = rows.length;

    let cleaned = [...rows];
    const changes = [];

    // Remove empty rows
    if (opts.noEmpty) {
      const before = cleaned.length;
      cleaned = removeEmptyRows(cleaned);
      const removed = before - cleaned.length;
      if (removed > 0) {
        changes.push(`Removed ${removed} empty rows`);
      }
    }

    // Remove duplicates
    if (opts.dedupe) {
      const before = cleaned.length;
      cleaned = removeDuplicates(cleaned);
      const removed = before - cleaned.length;
      if (removed > 0) {
        changes.push(`Removed ${removed} duplicate rows`);
      }
    }

    // Trim whitespace
    if (opts.trim) {
      cleaned = trimCells(cleaned);
      changes.push('Trimmed whitespace');
    }

    // Remove empty columns
    if (opts.noEmptyCols) {
      const beforeCols = cleaned[0]?.length || 0;
      cleaned = removeEmptyColumns(cleaned);
      const afterCols = cleaned[0]?.length || 0;
      const removed = beforeCols - afterCols;
      if (removed > 0) {
        changes.push(`Removed ${removed} empty columns`);
      }
    }

    // Output
    if (opts.dryRun) {
      console.log();
      console.log(`  ${C.bold}Dry Run${C.reset}`);
      console.log(`  ${C.dim}${'─'.repeat(30)}${C.reset}`);
      console.log(`  Original rows: ${originalCount}`);
      console.log(`  Cleaned rows: ${cleaned.length}`);
      if (changes.length > 0) {
        console.log(`  Changes:`);
        for (const change of changes) {
          console.log(`    ${C.green}•${C.reset} ${change}`);
        }
      } else {
        console.log(`  ${C.dim}No changes needed${C.reset}`);
      }
      console.log();
    } else {
      if (changes.length > 0) {
        console.error(`  ${C.green}Cleaned:${C.reset} ${changes.join(', ')}`);
        console.error(`  ${C.dim}Rows: ${originalCount} → ${cleaned.length}${C.reset}`);
      }
      console.log(formatCSV(cleaned, delimiter));
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
