#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';

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
  \x1b[1mcsvsql\x1b[0m - Query CSV files with SQL-like syntax

  \x1b[1mUsage:\x1b[0m
    csvsql <file> "<query>"
    cat data.csv | csvsql "<query>"

  \x1b[1mQuery Syntax:\x1b[0m
    SELECT <columns> FROM <file> [WHERE <cond>] [ORDER BY <col>] [LIMIT <n>]
    SELECT <agg>(<col>) FROM <file> [GROUP BY <col>]

  \x1b[1mColumns:\x1b[0m
    *                     All columns
    col1, col2            Specific columns
    col AS alias          Column alias
    DISTINCT col          Unique values

  \x1b[1mConditions:\x1b[0m
    col = 'value'         Equal (string)
    col = 42              Equal (number)
    col > 10              Greater than
    col < 10              Less than
    col >= 10             Greater or equal
    col <= 10             Less or equal
    col != 'value'        Not equal
    col LIKE '%pattern%'  Pattern match
    col IS NULL           Is null/empty
    col IS NOT NULL       Is not null/empty
    cond AND cond         Logical AND
    cond OR cond          Logical OR

  \x1b[1mAggregations:\x1b[0m
    COUNT(*)              Count rows
    COUNT(DISTINCT col)   Count unique values
    SUM(col)              Sum values
    AVG(col)              Average
    MIN(col)              Minimum
    MAX(col)              Maximum

  \x1b[1mOptions:\x1b[0m
    --delimiter <char>    CSV delimiter (default: auto-detect)
    --header              First row is header (default: true)
    --no-header           No header row (use col1, col2, ...)
    --limit <n>           Limit output rows
    --format <type>       Output format: table, csv, json (default: table)
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    csvsql data.csv "SELECT *"
    csvsql data.csv "SELECT name, age WHERE age > 25"
    csvsql data.csv "SELECT city, COUNT(*) GROUP BY city"
    csvsql data.csv "SELECT * ORDER BY name LIMIT 10"
    cat data.csv | csvsql "SELECT * WHERE status = 'active'"
`);
}

// --- Parse CSV ---
function parseCSV(content, delimiter = null) {
  // Auto-detect delimiter
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

  // Last row
  if (current || row.length > 0) {
    row.push(current.trim());
    if (row.some(c => c !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

// --- Parse SQL query ---
function parseQuery(queryStr) {
  const query = {
    columns: [],
    distinct: false,
    where: null,
    groupBy: null,
    orderBy: null,
    orderDir: 'ASC',
    limit: null,
    aggregations: [],
  };

  // Tokenize
  const tokens = tokenize(queryStr);
  let i = 0;

  // SELECT
  if (tokens[i]?.toUpperCase() !== 'SELECT') {
    throw new Error('Query must start with SELECT');
  }
  i++;

  // Check for DISTINCT
  if (tokens[i]?.toUpperCase() === 'DISTINCT') {
    query.distinct = true;
    i++;
  }

  // Columns
  const stopKeywords = ['FROM', 'WHERE', 'GROUP', 'ORDER', 'LIMIT'];
  while (i < tokens.length && !stopKeywords.includes(tokens[i].toUpperCase())) {
    let col = tokens[i];
    if (col === ',') { i++; continue; }

    // Handle function calls like COUNT(*)
    const funcMatch = col.match(/^(COUNT|SUM|AVG|MIN|MAX)$/i);
    if (funcMatch && tokens[i + 1] === '(') {
      // Reconstruct function call
      let funcStr = col + '(';
      i += 2; // Skip func name and (
      while (i < tokens.length && tokens[i] !== ')') {
        funcStr += tokens[i];
        i++;
      }
      funcStr += ')';
      i++; // Skip )
      col = funcStr;
    } else {
      i++;
    }

    // Check for aggregation
    const aggMatch = col.match(/^(COUNT|SUM|AVG|MIN|MAX)\((.+)\)$/i);
    if (aggMatch) {
      query.aggregations.push({
        func: aggMatch[1].toUpperCase(),
        column: aggMatch[2].replace(/"/g, ''),
      });
      query.columns.push(col);
    } else {
      // Check for alias
      const aliasMatch = col.match(/^(.+)\s+AS\s+(.+)$/i);
      if (aliasMatch) {
        query.columns.push({ name: aliasMatch[1], alias: aliasMatch[2] });
      } else {
        query.columns.push(col);
      }
    }
  }

  // FROM
  if (tokens[i]?.toUpperCase() === 'FROM') {
    i++; // Skip FROM keyword
    if (i < tokens.length && !['WHERE', 'GROUP', 'ORDER', 'LIMIT'].includes(tokens[i].toUpperCase())) {
      i++; // Skip table name
    }
  }

  // WHERE
  if (tokens[i]?.toUpperCase() === 'WHERE') {
    i++;
    const whereResult = parseWhere(tokens, i);
    query.where = whereResult.condition;
    i = whereResult.nextIndex;
  }

  // GROUP BY
  if (tokens[i]?.toUpperCase() === 'GROUP' && tokens[i + 1]?.toUpperCase() === 'BY') {
    i += 2;
    query.groupBy = tokens[i].replace(/"/g, '');
    i++;
  }

  // ORDER BY
  if (tokens[i]?.toUpperCase() === 'ORDER' && tokens[i + 1]?.toUpperCase() === 'BY') {
    i += 2;
    query.orderBy = tokens[i].replace(/"/g, '');
    i++;
    if (tokens[i]?.toUpperCase() === 'ASC' || tokens[i]?.toUpperCase() === 'DESC') {
      query.orderDir = tokens[i].toUpperCase();
      i++;
    }
  }

  // LIMIT
  if (tokens[i]?.toUpperCase() === 'LIMIT') {
    i++;
    query.limit = parseInt(tokens[i]);
    i++;
  }

  return query;
}

function tokenize(str) {
  const tokens = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (inQuote) {
      if (char === quoteChar) {
        current += char;
        inQuote = false;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
      current += char;
    } else if (char === '(' || char === ')') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(char);
      current = '';
    } else if (char === ',' || char === ';') {
      if (current.trim()) tokens.push(current.trim());
      tokens.push(char);
      current = '';
    } else if (char === ' ' || char === '\t') {
      if (current.trim()) tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

function parseWhere(tokens, startIndex) {
  let i = startIndex;
  const conditions = [];

  while (i < tokens.length && !['GROUP', 'ORDER', 'LIMIT'].includes(tokens[i]?.toUpperCase())) {
    if (tokens[i]?.toUpperCase() === 'AND' || tokens[i]?.toUpperCase() === 'OR') {
      conditions.push({ type: 'logical', op: tokens[i].toUpperCase() });
      i++;
      continue;
    }

    const column = tokens[i].replace(/"/g, '');
    i++;

    let op = tokens[i];
    i++;

    let value;
    if (op?.toUpperCase() === 'IS') {
      if (tokens[i]?.toUpperCase() === 'NOT' && tokens[i + 1]?.toUpperCase() === 'NULL') {
        conditions.push({ type: 'condition', column, op: 'IS NOT NULL' });
        i += 2;
        continue;
      } else if (tokens[i]?.toUpperCase() === 'NULL') {
        conditions.push({ type: 'condition', column, op: 'IS NULL' });
        i++;
        continue;
      }
    }

    if (op?.toUpperCase() === 'LIKE') {
      value = tokens[i];
      i++;
      // Strip quotes
      if (value?.startsWith("'") && value?.endsWith("'")) {
        value = value.slice(1, -1);
      } else if (value?.startsWith('"') && value?.endsWith('"')) {
        value = value.slice(1, -1);
      }
      conditions.push({ type: 'condition', column, op: 'LIKE', value });
      continue;
    }

    // Handle NOT LIKE
    if (op?.toUpperCase() === 'NOT' && tokens[i]?.toUpperCase() === 'LIKE') {
      value = tokens[i + 1];
      i += 2;
      // Strip quotes
      if (value?.startsWith("'") && value?.endsWith("'")) {
        value = value.slice(1, -1);
      } else if (value?.startsWith('"') && value?.endsWith('"')) {
        value = value.slice(1, -1);
      }
      conditions.push({ type: 'condition', column, op: 'NOT LIKE', value });
      continue;
    }

    value = tokens[i];
    i++;

    // Parse value
    let parsedValue = value;
    if (value?.startsWith("'") && value?.endsWith("'")) {
      parsedValue = value.slice(1, -1);
    } else if (value?.startsWith('"') && value?.endsWith('"')) {
      parsedValue = value.slice(1, -1);
    } else if (!isNaN(value)) {
      parsedValue = parseFloat(value);
    }

    conditions.push({ type: 'condition', column, op, value: parsedValue });
  }

  return { condition: conditions, nextIndex: i };
}

// --- Evaluate condition ---
function evaluateCondition(condition, row, headers) {
  const parts = [];
  let currentOp = 'AND';

  for (const item of condition) {
    if (item.type === 'logical') {
      currentOp = item.op;
      continue;
    }

    const colIndex = headers.indexOf(item.column);
    if (colIndex === -1) {
      parts.push(currentOp === 'AND' ? false : true);
      continue;
    }

    const cellValue = row[colIndex] ?? '';
    let result = false;

    switch (item.op) {
      case '=':
        result = typeof item.value === 'number'
          ? parseFloat(cellValue) === item.value
          : cellValue === String(item.value);
        break;
      case '!=':
        result = typeof item.value === 'number'
          ? parseFloat(cellValue) !== item.value
          : cellValue !== String(item.value);
        break;
      case '>':
        result = parseFloat(cellValue) > item.value;
        break;
      case '<':
        result = parseFloat(cellValue) < item.value;
        break;
      case '>=':
        result = parseFloat(cellValue) >= item.value;
        break;
      case '<=':
        result = parseFloat(cellValue) <= item.value;
        break;
      case 'LIKE': {
        const pattern = String(item.value)
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        result = new RegExp(`^${pattern}$`, 'i').test(cellValue);
        break;
      }
      case 'NOT LIKE': {
        const pattern = String(item.value)
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        result = !new RegExp(`^${pattern}$`, 'i').test(cellValue);
        break;
      }
      case 'IS NULL':
        result = cellValue === '' || cellValue === null || cellValue === undefined;
        break;
      case 'IS NOT NULL':
        result = cellValue !== '' && cellValue !== null && cellValue !== undefined;
        break;
    }

    parts.push({ op: currentOp, result });
  }

  if (parts.length === 0) return true;
  if (parts.length === 1) return parts[0].result ?? parts[0];

  let finalResult = parts[0].result ?? parts[0];
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.op === 'AND') {
      finalResult = finalResult && (part.result ?? part);
    } else {
      finalResult = finalResult || (part.result ?? part);
    }
  }

  return finalResult;
}

// --- Execute query ---
function executeQuery(query, rows, headers) {
  let result = rows;

  // WHERE
  if (query.where && query.where.length > 0) {
    result = result.filter(row => evaluateCondition(query.where, row, headers));
  }

  // GROUP BY
  if (query.groupBy || query.aggregations.length > 0) {
    const groups = new Map();

    if (query.groupBy) {
      const groupIndex = headers.indexOf(query.groupBy);
      if (groupIndex === -1) {
        throw new Error(`Column not found: ${query.groupBy}`);
      }

      for (const row of result) {
        const key = row[groupIndex] ?? '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }
    } else {
      groups.set('__all__', result);
    }

    // Calculate aggregations
    const aggResults = [];
    for (const [key, groupRows] of groups) {
      const aggRow = {};

      if (query.groupBy) {
        aggRow[query.groupBy] = key;
      }

      for (const agg of query.aggregations) {
        const values = groupRows.map(r => {
          const idx = headers.indexOf(agg.column);
          return idx >= 0 ? r[idx] : null;
        }).filter(v => v !== null && v !== '');

        switch (agg.func) {
          case 'COUNT':
            if (agg.column === '*') {
              aggRow[`${agg.func}(*)`] = groupRows.length;
            } else {
              aggRow[`${agg.func}(${agg.column})`] = values.length;
            }
            break;
          case 'SUM':
            aggRow[`${agg.func}(${agg.column})`] = values.reduce((s, v) => s + parseFloat(v || 0), 0);
            break;
          case 'AVG':
            aggRow[`${agg.func}(${agg.column})`] = values.length > 0
              ? values.reduce((s, v) => s + parseFloat(v || 0), 0) / values.length
              : 0;
            break;
          case 'MIN':
            aggRow[`${agg.func}(${agg.column})`] = Math.min(...values.map(v => parseFloat(v)));
            break;
          case 'MAX':
            aggRow[`${agg.func}(${agg.column})`] = Math.max(...values.map(v => parseFloat(v)));
            break;
        }
      }

      aggResults.push(aggRow);
    }

    return { headers: Object.keys(aggResults[0] || {}), rows: aggResults.map(r => Object.values(r)) };
  }

  // ORDER BY
  if (query.orderBy) {
    const sortIndex = headers.indexOf(query.orderBy);
    if (sortIndex === -1) {
      throw new Error(`Column not found: ${query.orderBy}`);
    }

    result.sort((a, b) => {
      const va = a[sortIndex] ?? '';
      const vb = b[sortIndex] ?? '';

      const na = parseFloat(va);
      const nb = parseFloat(vb);

      let cmp;
      if (!isNaN(na) && !isNaN(nb)) {
        cmp = na - nb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }

      return query.orderDir === 'DESC' ? -cmp : cmp;
    });
  }

  // LIMIT
  if (query.limit !== null) {
    result = result.slice(0, query.limit);
  }

  // SELECT columns
  let selectedHeaders = headers;
  let selectedRows = result;

  if (query.columns.length > 0 && query.columns[0] !== '*') {
    selectedHeaders = query.columns.map(col => {
      if (typeof col === 'object') return col.alias;
      if (col.includes('(')) return col; // Aggregation
      return col;
    });

    selectedRows = result.map(row => {
      return query.columns.map(col => {
        const colName = typeof col === 'object' ? col.name : col;
        const idx = headers.indexOf(colName);
        return idx >= 0 ? row[idx] : null;
      });
    });
  }

  // DISTINCT
  if (query.distinct) {
    const seen = new Set();
    selectedRows = selectedRows.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return { headers: selectedHeaders, rows: selectedRows };
}

// --- Format output ---
function formatTable(headers, rows) {
  if (rows.length === 0) {
    console.log(`\n  ${C.dim}No results${C.reset}\n`);
    return;
  }

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxData = Math.max(...rows.map(r => String(r[i] ?? '').length));
    return Math.max(h.length, maxData);
  });

  // Header
  console.log();
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join(' │ ');
  console.log(`  ${C.bold}${headerLine}${C.reset}`);

  // Separator
  const sepLine = widths.map(w => '─'.repeat(w)).join('─┼─');
  console.log(`  ${C.dim}${sepLine}${C.reset}`);

  // Rows
  for (const row of rows) {
    const line = row.map((cell, i) => String(cell ?? '').padEnd(widths[i])).join(' │ ');
    console.log(`  ${line}`);
  }

  console.log(`\n  ${C.dim}${rows.length} row${rows.length !== 1 ? 's' : ''}${C.reset}\n`);
}

function formatCSV(headers, rows) {
  console.log(headers.join(','));
  for (const row of rows) {
    console.log(row.map(cell => {
      const str = String(cell ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','));
  }
}

function formatJSON(headers, rows) {
  const data = rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
  console.log(JSON.stringify(data, null, 2));
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let file = null;
  let query = null;
  let delimiter = null;
  let hasHeader = true;
  let format = 'table';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--no-header') {
      hasHeader = false;
    } else if (arg === '--format') {
      format = args[++i];
    } else if (!arg.startsWith('-')) {
      if (!file && !query) {
        // First non-flag arg: check if it looks like a file path
        // (contains a dot or path separator, or is an existing file)
        if (arg.includes('.') || arg.includes('/') || arg.includes('\\') || existsSync(arg)) {
          file = arg;
        } else {
          query = arg;
        }
      } else if (!query) {
        query = arg;
      }
    }
  }

  return { file, query, delimiter, hasHeader, format };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.query) {
    showHelp();
    process.exit(1);
  }

  // Read CSV
  let content;
  if (opts.file) {
    try {
      content = readFileSync(opts.file, 'utf-8');
    } catch (err) {
      console.error(`  Error reading file: ${err.message}`);
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

  // Parse CSV
  const rows = parseCSV(content, opts.delimiter);
  if (rows.length === 0) {
    console.log(`  ${C.dim}Empty CSV${C.reset}`);
    process.exit(0);
  }

  let headers;
  let dataRows;

  if (opts.hasHeader) {
    headers = rows[0];
    dataRows = rows.slice(1);
  } else {
    headers = rows[0].map((_, i) => `col${i + 1}`);
    dataRows = rows;
  }

  // Parse and execute query
  try {
    const query = parseQuery(opts.query);
    const result = executeQuery(query, dataRows, headers);

    // Format output
    switch (opts.format) {
      case 'csv':
        formatCSV(result.headers, result.rows);
        break;
      case 'json':
        formatJSON(result.headers, result.rows);
        break;
      default:
        formatTable(result.headers, result.rows);
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
