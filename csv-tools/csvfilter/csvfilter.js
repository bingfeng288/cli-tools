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
  \x1b[1mcsvfilter\x1b[0m - CSV row filtering tool

  \x1b[1mUsage:\x1b[0m
    csvfilter <file> <condition>
    cat data.csv | csvfilter <condition>

  \x1b[1mConditions:\x1b[0m
    column=value          Equals
    column!=value         Not equals
    column>value          Greater than
    column<value          Less than
    column>=value         Greater or equal
    column<=value         Less or equal
    column~pattern        Contains (case-insensitive)
    column!~pattern       Not contains
    column~/regex/        Matches regex

  \x1b[1mOptions:\x1b[0m
    -d, --delimiter <char>  CSV delimiter (default: auto-detect)
    --count                 Show only count
    --columns <cols>        Select specific columns (comma-separated)
    -h, --help              Show this help

  \x1b[1mExamples:\x1b[0m
    csvfilter data.csv "age>30"
    csvfilter data.csv "name~John"
    csvfilter data.csv "status=active&role=admin"
    csvfilter data.csv "age>25&age<40"
    cat data.csv | csvfilter "score>=90"
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

// --- Parse condition ---
function parseCondition(condStr) {
  // Split by & (AND) or | (OR)
  const conditions = [];
  let current = '';
  let op = '&';

  for (let i = 0; i < condStr.length; i++) {
    const char = condStr[i];
    if (char === '&' || char === '|') {
      if (current) {
        conditions.push({ op, condition: parseSingleCondition(current.trim()) });
        current = '';
      }
      op = char;
    } else {
      current += char;
    }
  }

  if (current) {
    conditions.push({ op, condition: parseSingleCondition(current.trim()) });
  }

  return conditions;
}

function parseSingleCondition(cond) {
  // Match operator patterns
  const patterns = [
    { regex: /^(!=)(.+)$/, op: '!=' },
    { regex: /^(>=)(.+)$/, op: '>=' },
    { regex: /^(<=)(.+)$/, op: '<=' },
    { regex: /^(!~)(.+)$/, op: '!~' },
    { regex: /^(~)(\/.+\/)$/, op: '~regex' },
    { regex: /^(~)(.+)$/, op: '~' },
    { regex: /^(>)(.+)$/, op: '>' },
    { regex: /^(<)(.+)$/, op: '<' },
    { regex: /^(=)(.+)$/, op: '=' },
  ];

  // Find column name (before operator)
  const opMatch = cond.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(.+)$/);
  if (!opMatch) {
    throw new Error(`Invalid condition: ${cond}`);
  }

  const column = opMatch[1];
  const rest = opMatch[2];

  for (const { regex, op } of patterns) {
    const match = rest.match(regex);
    if (match) {
      let value = match[2];
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return { column, op, value };
    }
  }

  throw new Error(`Invalid condition: ${cond}`);
}

// --- Evaluate condition ---
function evaluateCondition(row, headers, condition) {
  const { column, op, value } = condition;
  const colIdx = headers.indexOf(column);
  if (colIdx === -1) return false;

  const cellValue = row[colIdx] || '';

  switch (op) {
    case '=':
      return cellValue === value;
    case '!=':
      return cellValue !== value;
    case '>': {
      const numA = parseFloat(cellValue);
      const numB = parseFloat(value);
      return !isNaN(numA) && !isNaN(numB) ? numA > numB : cellValue > value;
    }
    case '<': {
      const numA = parseFloat(cellValue);
      const numB = parseFloat(value);
      return !isNaN(numA) && !isNaN(numB) ? numA < numB : cellValue < value;
    }
    case '>=': {
      const numA = parseFloat(cellValue);
      const numB = parseFloat(value);
      return !isNaN(numA) && !isNaN(numB) ? numA >= numB : cellValue >= value;
    }
    case '<=': {
      const numA = parseFloat(cellValue);
      const numB = parseFloat(value);
      return !isNaN(numA) && !isNaN(numB) ? numA <= numB : cellValue <= value;
    }
    case '~':
      return cellValue.toLowerCase().includes(value.toLowerCase());
    case '!~':
      return !cellValue.toLowerCase().includes(value.toLowerCase());
    case '~regex': {
      const regex = new RegExp(value.slice(1, -1), 'i');
      return regex.test(cellValue);
    }
    default:
      return false;
  }
}

// --- Evaluate all conditions ---
function evaluate(row, headers, conditions) {
  if (conditions.length === 0) return true;

  let result = evaluateCondition(row, headers, conditions[0].condition);

  for (let i = 1; i < conditions.length; i++) {
    const { op, condition } = conditions[i];
    const condResult = evaluateCondition(row, headers, condition);

    if (op === '&') {
      result = result && condResult;
    } else if (op === '|') {
      result = result || condResult;
    }
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
  let condition = null;
  let delimiter = null;
  let count = false;
  let columns = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--count') {
      count = true;
    } else if (arg === '--columns') {
      columns = args[++i].split(',').map(c => c.trim());
    } else if (!arg.startsWith('-')) {
      if (!file) {
        file = arg;
      } else if (!condition) {
        condition = arg;
      }
    }
  }

  return { file, condition, delimiter, count, columns };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.condition) {
    showHelp();
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
    // The condition was parsed as file, fix it
    opts.condition = opts.file;
    opts.file = null;
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

    const conditions = parseCondition(opts.condition);
    const filtered = dataRows.filter(row => evaluate(row, headers, conditions));

    if (opts.count) {
      console.log(filtered.length);
      return;
    }

    // Select columns if specified
    let outputRows = filtered;
    if (opts.columns) {
      const colIndices = opts.columns.map(col => {
        const idx = headers.indexOf(col);
        if (idx === -1) throw new Error(`Column "${col}" not found`);
        return idx;
      });
      const selectedHeaders = opts.columns;
      const selectedData = filtered.map(row => colIndices.map(i => row[i] || ''));
      outputRows = [selectedHeaders, ...selectedData];
    } else {
      outputRows = [headers, ...filtered];
    }

    console.log(formatCSV(outputRows, opts.delimiter || ','));
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
