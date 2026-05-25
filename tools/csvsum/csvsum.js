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
  \x1b[1mcsvsum\x1b[0m - CSV statistics and summary tool

  \x1b[1mUsage:\x1b[0m
    csvsum <file> -c <columns> -a <aggregates>
    cat data.csv | csvsum -c <columns> -a <aggregates>

  \x1b[1mOptions:\x1b[0m
    -c, --columns <cols>    Columns to aggregate (comma-separated)
    -a, --agg <funcs>       Aggregation functions: sum, avg, min, max, count (comma-separated)
    -g, --group <column>    Group by column
    -d, --delimiter <char>  CSV delimiter (default: auto-detect)
    --json                  Output as JSON
    -h, --help              Show this help

  \x1b[1mAggregation Functions:\x1b[0m
    sum     Sum of values
    avg     Average of values
    min     Minimum value
    max     Maximum value
    count   Count of values

  \x1b[1mExamples:\x1b[0m
    csvsum data.csv -c salary -a sum,avg
    csvsum data.csv -c salary -a sum,avg -g department
    csvsum data.csv -c age -a min,max,avg
    cat data.csv | csvsum -c amount -a sum
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
  count: (values) => values.filter(v => v !== '' && v !== null && v !== undefined).length,
};

// --- Format number ---
function formatNumber(n) {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

// --- Compute aggregates ---
function computeAggregates(rows, colIndices, aggFuncs) {
  const results = {};

  for (const colIdx of colIndices) {
    const values = rows.map(row => row[colIdx] || '');
    results[colIdx] = {};

    for (const func of aggFuncs) {
      results[colIdx][func] = AGG_FUNCS[func](values);
    }
  }

  return results;
}

// --- Compute grouped aggregates ---
function computeGroupedAggregates(rows, headers, colIndices, aggFuncs, groupIdx) {
  const groups = new Map();

  for (const row of rows) {
    const groupKey = row[groupIdx] || '';
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push(row);
  }

  const results = {};
  for (const [groupKey, groupRows] of groups) {
    results[groupKey] = computeAggregates(groupRows, colIndices, aggFuncs);
  }

  return results;
}

// --- Display results ---
function displayResults(headers, colIndices, aggFuncs, results, groupIdx = null) {
  if (groupIdx !== null) {
    // Grouped results
    console.log();
    console.log(`  ${C.bold}Grouped by: ${headers[groupIdx]}${C.reset}`);
    console.log(`  ${C.dim}${'─'.repeat(50)}${C.reset}`);

    for (const [groupKey, groupResults] of Object.entries(results)) {
      console.log();
      console.log(`  ${C.cyan}${groupKey}${C.reset}`);

      for (const colIdx of colIndices) {
        const colName = headers[colIdx];
        const colResults = groupResults[colIdx];
        const parts = aggFuncs.map(func => `${func}: ${formatNumber(colResults[func])}`);
        console.log(`    ${colName}: ${parts.join(' | ')}`);
      }
    }
  } else {
    // Overall results
    console.log();
    console.log(`  ${C.bold}Summary${C.reset}`);
    console.log(`  ${C.dim}${'─'.repeat(50)}${C.reset}`);

    for (const colIdx of colIndices) {
      const colName = headers[colIdx];
      const colResults = results[colIdx];
      const parts = aggFuncs.map(func => `${func}: ${formatNumber(colResults[func])}`);
      console.log(`  ${colName}: ${parts.join(' | ')}`);
    }
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
  let columns = [];
  let aggs = [];
  let group = null;
  let delimiter = null;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-c' || arg === '--columns') {
      columns = args[++i].split(',').map(c => c.trim());
    } else if (arg === '-a' || arg === '--agg') {
      aggs = args[++i].split(',').map(a => a.trim());
    } else if (arg === '-g' || arg === '--group') {
      group = args[++i];
    } else if (arg === '-d' || arg === '--delimiter') {
      delimiter = args[++i];
    } else if (arg === '--json') {
      json = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, columns, aggs, group, delimiter, json };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (opts.columns.length === 0) {
    console.error(`  ${C.red}Error:${C.reset} Please specify columns with -c`);
    process.exit(1);
  }

  if (opts.aggs.length === 0) {
    opts.aggs = ['sum'];
  }

  // Validate aggregation functions
  for (const agg of opts.aggs) {
    if (!AGG_FUNCS[agg]) {
      console.error(`  ${C.red}Error:${C.reset} Unknown aggregation function: ${agg}`);
      console.error(`  Available: ${Object.keys(AGG_FUNCS).join(', ')}`);
      process.exit(1);
    }
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
    const dataRows = rows.slice(1);

    // Find column indices
    const colIndices = opts.columns.map(col => {
      const idx = headers.indexOf(col);
      if (idx === -1) throw new Error(`Column "${col}" not found`);
      return idx;
    });

    // Find group column index
    let groupIdx = null;
    if (opts.group) {
      groupIdx = headers.indexOf(opts.group);
      if (groupIdx === -1) throw new Error(`Group column "${opts.group}" not found`);
    }

    // Compute
    if (groupIdx !== null) {
      const results = computeGroupedAggregates(dataRows, headers, colIndices, opts.aggs, groupIdx);

      if (opts.json) {
        const jsonResult = {};
        for (const [groupKey, groupResults] of Object.entries(results)) {
          jsonResult[groupKey] = {};
          for (const colIdx of colIndices) {
            jsonResult[groupKey][headers[colIdx]] = groupResults[colIdx];
          }
        }
        console.log(JSON.stringify(jsonResult, null, 2));
      } else {
        displayResults(headers, colIndices, opts.aggs, results, groupIdx);
      }
    } else {
      const results = computeAggregates(dataRows, colIndices, opts.aggs);

      if (opts.json) {
        const jsonResult = {};
        for (const colIdx of colIndices) {
          jsonResult[headers[colIdx]] = results[colIdx];
        }
        console.log(JSON.stringify(jsonResult, null, 2));
      } else {
        displayResults(headers, colIndices, opts.aggs, results);
      }
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
