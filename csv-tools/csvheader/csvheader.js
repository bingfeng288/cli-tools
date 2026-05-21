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
  \x1b[1mcsvheader\x1b[0m - CSV header management tool

  \x1b[1mUsage:\x1b[0m
    csvheader <file>
    csvheader <file> --select <columns>
    csvheader <file> --rename <mapping>

  \x1b[1mCommands:\x1b[0m
    (default)               Show headers
    --select <columns>      Select/reorder columns
    --rename <mapping>      Rename columns (old:new,...)
    --remove <columns>      Remove columns
    --lowercase             Convert headers to lowercase
    --uppercase             Convert headers to uppercase
    --trim                  Trim whitespace from headers

  \x1b[1mOptions:\x1b[0m
    -d, --delimiter <char>  CSV delimiter (default: auto-detect)
    -h, --help              Show this help

  \x1b[1mExamples:\x1b[0m
    csvheader data.csv
    csvheader data.csv --select name,age,email
    csvheader data.csv --rename "first_name:name,addr:address"
    csvheader data.csv --lowercase
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

  return { rows, delimiter };
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
  let select = null;
  let rename = null;
  let remove = null;
  let lowercase = false;
  let uppercase = false;
  let trim = false;
  let delimiter = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--select') {
      select = args[++i].split(',').map(c => c.trim());
    } else if (arg === '--rename') {
      rename = args[++i];
    } else if (arg === '--remove') {
      remove = args[++i].split(',').map(c => c.trim());
    } else if (arg === '--lowercase') {
      lowercase = true;
    } else if (arg === '--uppercase') {
      uppercase = true;
    } else if (arg === '--trim') {
      trim = true;
    } else if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, select, rename, remove, lowercase, uppercase, trim, delimiter };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.file) {
    showHelp();
    process.exit(1);
  }

  try {
    const content = readFileSync(opts.file, 'utf-8');
    const { rows, delimiter } = parseCSV(content, opts.delimiter);

    if (rows.length === 0) {
      console.error(`  ${C.red}Error:${C.reset} File is empty`);
      process.exit(1);
    }

    let headers = rows[0];
    const dataRows = rows.slice(1);

    // Check if any modification is requested
    const hasModification = opts.select || opts.rename || opts.remove ||
      opts.lowercase || opts.uppercase || opts.trim;

    if (!hasModification) {
      // Just show headers
      console.log();
      console.log(`  ${C.bold}Headers${C.reset} (${headers.length} columns)`);
      console.log(`  ${C.dim}${'─'.repeat(30)}${C.reset}`);
      headers.forEach((h, i) => {
        console.log(`  ${C.cyan}${i + 1}.${C.reset} ${h}`);
      });
      console.log();
      return;
    }

    // Apply modifications
    if (trim) {
      headers = headers.map(h => h.trim());
    }

    if (lowercase) {
      headers = headers.map(h => h.toLowerCase());
    }

    if (uppercase) {
      headers = headers.map(h => h.toUpperCase());
    }

    if (rename) {
      const mappings = rename.split(',').map(m => {
        const [old, newName] = m.split(':');
        return { old: old.trim(), new: newName.trim() };
      });

      for (const { old, newName } of mappings) {
        const idx = headers.indexOf(old);
        if (idx !== -1) {
          headers[idx] = newName;
        }
      }
    }

    if (remove) {
      const removeSet = new Set(remove);
      const keepIndices = headers
        .map((h, i) => removeSet.has(h) ? -1 : i)
        .filter(i => i !== -1);

      headers = keepIndices.map(i => headers[i]);
      for (let r = 0; r < dataRows.length; r++) {
        dataRows[r] = keepIndices.map(i => dataRows[r][i] || '');
      }
    }

    if (select) {
      const selectIndices = select.map(col => {
        const idx = headers.indexOf(col);
        if (idx === -1) {
          throw new Error(`Column "${col}" not found`);
        }
        return idx;
      });

      headers = selectIndices.map(i => headers[i]);
      for (let r = 0; r < dataRows.length; r++) {
        dataRows[r] = selectIndices.map(i => dataRows[r][i] || '');
      }
    }

    // Output
    const output = [headers, ...dataRows];
    console.log(formatCSV(output, delimiter));
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
