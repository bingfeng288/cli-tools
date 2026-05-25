#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// --- CSV Parser ---
function parseCsv(text, delimiter = ',') {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseLine(lines[0], delimiter);
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line, delimiter);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });

  return { headers, rows };
}

function parseLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.trim());
}

function toCsv(rows, headers, delimiter = ',') {
  const lines = [headers.map(h => escapeCsv(h, delimiter)).join(delimiter)];
  rows.forEach(row => {
    const values = headers.map(h => escapeCsv(String(row[h] ?? ''), delimiter));
    lines.push(values.join(delimiter));
  });
  return lines.join('\n');
}

function escapeCsv(value, delimiter) {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// --- Commands ---
const commands = {
  head(args) {
    const { data, opts } = loadCsv(args);
    const n = parseInt(opts.n || opts.lines || '10');
    const rows = data.rows.slice(0, n);
    printTable(data.headers, rows);
  },

  tail(args) {
    const { data, opts } = loadCsv(args);
    const n = parseInt(opts.n || opts.lines || '10');
    const rows = data.rows.slice(-n);
    printTable(data.headers, rows);
  },

  select(args) {
    const { data, opts, extra } = loadCsv(args);
    const columns = (extra[0] || '').split(',').filter(Boolean);
    if (columns.length === 0) {
      console.error('  Usage: csvtool select <file> col1,col2,...');
      return;
    }
    const rows = data.rows.map(row => {
      const newRow = {};
      columns.forEach(c => { newRow[c] = row[c]; });
      return newRow;
    });
    printTable(columns, rows);
  },

  filter(args) {
    const { data, opts, extra } = loadCsv(args);
    const filterExpr = extra[0];
    if (!filterExpr) {
      console.error('  Usage: csvtool filter <file> "column>value"');
      return;
    }
    const [col, op, value] = parseFilter(filterExpr);
    const rows = data.rows.filter(row => {
      const val = row[col];
      if (val === undefined) return false;
      switch (op) {
        case '=': return val === value;
        case '>': return Number(val) > Number(value);
        case '<': return Number(val) < Number(value);
        case '>=': return Number(val) >= Number(value);
        case '<=': return Number(val) <= Number(value);
        case '!=': return val !== value;
        case 'contains': return val.includes(value);
        default: return false;
      }
    });
    printTable(data.headers, rows);
  },

  sort(args) {
    const { data, opts, extra } = loadCsv(args);
    const sortCol = extra[0];
    if (!sortCol) {
      console.error('  Usage: csvtool sort <file> <column> [--desc]');
      return;
    }
    const desc = opts.desc || false;
    const rows = [...data.rows].sort((a, b) => {
      const va = a[sortCol] ?? '';
      const vb = b[sortCol] ?? '';
      const na = Number(va);
      const nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return desc ? nb - na : na - nb;
      return desc ? vb.localeCompare(va) : va.localeCompare(vb);
    });
    printTable(data.headers, rows);
  },

  group(args) {
    const { data, opts, extra } = loadCsv(args);
    const groupCol = extra[0];
    if (!groupCol) {
      console.error('  Usage: csvtool group <file> <column>');
      return;
    }
    const groups = {};
    data.rows.forEach(row => {
      const key = row[groupCol] || '(empty)';
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });

    console.log(`\n  Grouped by: ${groupCol}\n`);
    Object.entries(groups).sort((a, b) => b[1].length - a[1].length).forEach(([key, rows]) => {
      console.log(`  ${key}: ${rows.length} rows`);
    });
    console.log(`\n  Total groups: ${Object.keys(groups).length}\n`);
  },

  stats(args) {
    const { data } = loadCsv(args);
    console.log(`\n  CSV Statistics:\n`);
    console.log(`    Rows:    ${data.rows.length}`);
    console.log(`    Columns: ${data.headers.length}`);
    console.log(`    Headers: ${data.headers.join(', ')}\n`);

    // Per-column stats
    data.headers.forEach(col => {
      const values = data.rows.map(r => r[col]).filter(v => v !== '');
      const numbers = values.map(Number).filter(n => !isNaN(n));
      const unique = new Set(values).size;

      console.log(`  ${col}:`);
      console.log(`    Non-empty: ${values.length}`);
      console.log(`    Unique:    ${unique}`);

      if (numbers.length > 0) {
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        const sum = numbers.reduce((a, b) => a + b, 0);
        const avg = sum / numbers.length;
        console.log(`    Min:       ${min}`);
        console.log(`    Max:       ${max}`);
        console.log(`    Sum:       ${sum.toFixed(2)}`);
        console.log(`    Avg:       ${avg.toFixed(2)}`);
      }
      console.log();
    });
  },

  toJson(args) {
    const { data, opts } = loadCsv(args);
    const output = JSON.stringify(data.rows, null, parseInt(opts.indent || '2'));
    console.log('\n' + output + '\n');
  },

  toMd(args) {
    const { data } = loadCsv(args);
    console.log('\n' + toMarkdown(data.headers, data.rows) + '\n');
  },

  count(args) {
    const { data } = loadCsv(args);
    console.log(`\n  ${data.rows.length} rows\n`);
  },

  headers(args) {
    const { data } = loadCsv(args);
    console.log('\n  Headers:\n');
    data.headers.forEach((h, i) => console.log(`    ${i + 1}. ${h}`));
    console.log();
  },

  sample(args) {
    const { data, opts } = loadCsv(args);
    const n = parseInt(opts.n || '5');
    const rows = [];
    const indices = new Set();
    while (rows.length < n && rows.length < data.rows.length) {
      const idx = Math.floor(Math.random() * data.rows.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        rows.push(data.rows[idx]);
      }
    }
    printTable(data.headers, rows);
  },

  help() {
    console.log(`
  csvtool - CSV Data Processor

  Usage: csvtool <command> <file> [options]

  Commands:
    head [file] [n]          Show first n rows (default: 10)
    tail [file] [n]          Show last n rows (default: 10)
    select [file] cols       Select columns (comma-separated)
    filter [file] "expr"     Filter rows (e.g., "age>25")
    sort [file] <col>        Sort by column (--desc for descending)
    group [file] <col>       Group by column and count
    stats [file]             Show statistics
    toJson [file]            Convert to JSON
    toMd [file]              Convert to Markdown table
    count [file]             Count rows
    headers [file]           List column headers
    sample [file] [n]        Random sample of n rows (default: 5)

  Options:
    -d, --delimiter C        CSV delimiter (default: ,)
    -n, --lines N            Number of lines for head/tail
    --desc                   Sort descending

  Examples:
    csvtool head data.csv 20
    csvtool select data.csv name,age
    csvtool filter data.csv "age>25"
    csvtool sort data.csv name --desc
    csvtool stats data.csv
    csvtool toJson data.csv
`);
  },
};

// --- Helpers ---
function loadCsv(args) {
  const { input, opts, extra } = parseArgs(args);
  const delimiter = opts.delimiter || opts.d || ',';
  let raw;
  if (!input || input === '-') {
    raw = readFileSync('/dev/stdin', 'utf-8');
  } else if (existsSync(input)) {
    raw = readFileSync(input, 'utf-8');
  } else {
    raw = input;
  }
  const data = parseCsv(raw, delimiter);
  return { data, opts, extra };
}

function parseArgs(args) {
  let input = '';
  const opts = {};
  const extra = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const [key, val] = args[i].slice(2).split('=');
      opts[key] = val || args[++i] || true;
    } else if (args[i].startsWith('-')) {
      const key = args[i].slice(1);
      opts[key] = args[++i] || true;
    } else if (!input) {
      input = args[i];
    } else {
      extra.push(args[i]);
    }
  }

  return { input, opts, extra };
}

function parseFilter(expr) {
  const match = expr.match(/^([^><=!]+)(>=|<=|!=|>|<|=|contains)(.+)$/);
  if (!match) return [expr, '=', ''];
  return [match[1].trim(), match[2], match[3].trim()];
}

function printTable(headers, rows) {
  if (rows.length === 0) {
    console.log('\n  (no data)\n');
    return;
  }

  // Calculate column widths
  const widths = {};
  headers.forEach(h => {
    widths[h] = Math.max(h.length, ...rows.map(r => String(r[h] ?? '').length));
  });

  // Print header
  console.log();
  const headerLine = headers.map(h => h.padEnd(widths[h])).join(' │ ');
  console.log(`  ${headerLine}`);
  console.log('  ' + headers.map(h => '─'.repeat(widths[h])).join('─┼─'));

  // Print rows
  rows.forEach(row => {
    const line = headers.map(h => String(row[h] ?? '').padEnd(widths[h])).join(' │ ');
    console.log(`  ${line}`);
  });
  console.log(`\n  ${rows.length} rows\n`);
}

function toMarkdown(headers, rows) {
  const widths = {};
  headers.forEach(h => {
    widths[h] = Math.max(h.length, ...rows.map(r => String(r[h] ?? '').length));
  });

  let md = '| ' + headers.map(h => h.padEnd(widths[h])).join(' | ') + ' |\n';
  md += '| ' + headers.map(h => '-'.repeat(widths[h])).join(' | ') + ' |\n';
  rows.forEach(row => {
    md += '| ' + headers.map(h => String(row[h] ?? '').padEnd(widths[h])).join(' | ') + ' |\n';
  });
  return md;
}

// --- Main ---
const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === '-h' || cmd === '--help') {
  commands.help();
} else if (commands[cmd]) {
  commands[cmd](args.slice(1));
} else {
  console.error(`  Unknown command: ${cmd}`);
  console.error(`  Run 'csvtool --help' for usage.`);
  process.exit(1);
}
