#!/usr/bin/env node

import { readFileSync } from 'node:fs';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// --- Help ---
function showHelp() {
  console.log(`
  ${C.bold}jsonq${C.reset} - JSON query and exploration CLI

  ${C.bold}Usage:${C.reset}
    jsonq <query> [file]
    cat data.json | jsonq <query>

  ${C.bold}Query Syntax:${C.reset}
    .key              Access object field
    .key1.key2        Nested field access
    [0]               Array index
    [0:3]             Array slice
    [-1]              Last element
    .[]               Iterate all array elements
    .key[]            Iterate array field
    .[].key           Field from each element
    length            Array/object length
    keys              Object keys
    values            Object values
    type              Value type
    first             First element
    last              Last element
    unique            Unique values
    sort              Sort values
    reverse           Reverse order
    flatten           Flatten nested arrays
    min               Minimum value
    max               Maximum value
    sum               Sum of numbers
    avg               Average of numbers
    count             Count elements
    map(.key)         Map field extraction
    select(.key > 5)  Filter by condition
    group_by(.key)    Group by field
    sort_by(.key)     Sort by field

  ${C.bold}Comparison Operators:${C.reset}
    ==  !=  <  >  <=  >=  contains

  ${C.bold}Options:${C.reset}
    -c, --compact         Compact output (single line)
    -r, --raw             Raw string output (no quotes)
    -e, --exists          Check if path exists (exit code)
    --tab                 Use tabs for indentation
    -h, --help            Show this help

  ${C.bold}Examples:${C.reset}
    jsonq '.name' data.json
    jsonq '.users[0].email' data.json
    jsonq '.items[] | .name' data.json
    jsonq '.[] | select(.age > 25)' data.json
    jsonq '.items | length' data.json
    jsonq '.users | map(.name)' data.json
    jsonq '.items | group_by(.type)' data.json
    echo '{"a":1}' | jsonq '.a'
`);
}

// --- Parse query into tokens ---
function tokenize(query) {
  const tokens = [];
  let i = 0;

  while (i < query.length) {
    const ch = query[i];

    if (ch === '.') {
      if (query[i + 1] === '[') {
        tokens.push({ type: 'dot' });
        i++;
      } else {
        let j = i + 1;
        while (j < query.length && /[\w]/.test(query[j])) j++;
        if (j > i + 1) {
          tokens.push({ type: 'field', value: query.slice(i + 1, j) });
          i = j;
        } else {
          tokens.push({ type: 'dot' });
          i++;
        }
      }
    } else if (ch === '[') {
      let j = i + 1;
      while (j < query.length && query[j] !== ']') j++;
      const inner = query.slice(i + 1, j).trim();
      if (inner === '') {
        tokens.push({ type: 'iterate' });
      } else if (inner === ':') {
        tokens.push({ type: 'slice', start: 0, end: undefined });
      } else if (inner.startsWith(':')) {
        tokens.push({ type: 'slice', start: 0, end: parseInt(inner.slice(1)) });
      } else if (inner.endsWith(':')) {
        tokens.push({ type: 'slice', start: parseInt(inner), end: undefined });
      } else if (inner.includes(':')) {
        const [s, e] = inner.split(':');
        tokens.push({ type: 'slice', start: parseInt(s), end: parseInt(e) });
      } else {
        tokens.push({ type: 'index', value: parseInt(inner) });
      }
      i = j + 1;
    } else if (query.slice(i, i + 2) === '| ') {
      tokens.push({ type: 'pipe' });
      i += 2;
    } else if (query.slice(i, i + 8) === 'length') {
      tokens.push({ type: 'func', value: 'length' });
      i += 6;
    } else if (query.slice(i, i + 4) === 'keys') {
      tokens.push({ type: 'func', value: 'keys' });
      i += 4;
    } else if (query.slice(i, i + 6) === 'values') {
      tokens.push({ type: 'func', value: 'values' });
      i += 6;
    } else if (query.slice(i, i + 4) === 'type') {
      tokens.push({ type: 'func', value: 'type' });
      i += 4;
    } else if (query.slice(i, i + 5) === 'first') {
      tokens.push({ type: 'func', value: 'first' });
      i += 5;
    } else if (query.slice(i, i + 4) === 'last') {
      tokens.push({ type: 'func', value: 'last' });
      i += 4;
    } else if (query.slice(i, i + 6) === 'unique') {
      tokens.push({ type: 'func', value: 'unique' });
      i += 6;
    } else if (query.slice(i, i + 4) === 'sort') {
      tokens.push({ type: 'func', value: 'sort' });
      i += 4;
    } else if (query.slice(i, i + 7) === 'reverse') {
      tokens.push({ type: 'func', value: 'reverse' });
      i += 7;
    } else if (query.slice(i, i + 7) === 'flatten') {
      tokens.push({ type: 'func', value: 'flatten' });
      i += 7;
    } else if (query.slice(i, i + 3) === 'min') {
      tokens.push({ type: 'func', value: 'min' });
      i += 3;
    } else if (query.slice(i, i + 3) === 'max') {
      tokens.push({ type: 'func', value: 'max' });
      i += 3;
    } else if (query.slice(i, i + 3) === 'sum') {
      tokens.push({ type: 'func', value: 'sum' });
      i += 3;
    } else if (query.slice(i, i + 3) === 'avg') {
      tokens.push({ type: 'func', value: 'avg' });
      i += 3;
    } else if (query.slice(i, i + 5) === 'count') {
      tokens.push({ type: 'func', value: 'count' });
      i += 5;
    } else if (query.slice(i, i + 3) === 'map') {
      let j = i + 3;
      while (j < query.length && query[j] !== '(') j++;
      let depth = 0;
      let start = j + 1;
      j++;
      while (j < query.length) {
        if (query[j] === '(') depth++;
        if (query[j] === ')') {
          if (depth === 0) break;
          depth--;
        }
        j++;
      }
      const innerQuery = query.slice(start, j).trim();
      tokens.push({ type: 'func', value: 'map', query: innerQuery });
      i = j + 1;
    } else if (query.slice(i, i + 6) === 'select') {
      let j = i + 6;
      while (j < query.length && query[j] !== '(') j++;
      let depth = 0;
      let start = j + 1;
      j++;
      while (j < query.length) {
        if (query[j] === '(') depth++;
        if (query[j] === ')') {
          if (depth === 0) break;
          depth--;
        }
        j++;
      }
      const cond = query.slice(start, j).trim();
      tokens.push({ type: 'func', value: 'select', condition: cond });
      i = j + 1;
    } else if (query.slice(i, i + 8) === 'group_by') {
      let j = i + 8;
      while (j < query.length && query[j] !== '(') j++;
      let depth = 0;
      let start = j + 1;
      j++;
      while (j < query.length) {
        if (query[j] === '(') depth++;
        if (query[j] === ')') {
          if (depth === 0) break;
          depth--;
        }
        j++;
      }
      const field = query.slice(start, j).trim().replace(/^\./, '');
      tokens.push({ type: 'func', value: 'group_by', field });
      i = j + 1;
    } else if (query.slice(i, i + 7) === 'sort_by') {
      let j = i + 7;
      while (j < query.length && query[j] !== '(') j++;
      let depth = 0;
      let start = j + 1;
      j++;
      while (j < query.length) {
        if (query[j] === '(') depth++;
        if (query[j] === ')') {
          if (depth === 0) break;
          depth--;
        }
        j++;
      }
      const field = query.slice(start, j).trim().replace(/^\./, '');
      tokens.push({ type: 'func', value: 'sort_by', field });
      i = j + 1;
    } else if (ch === ' ') {
      i++;
    } else {
      i++;
    }
  }

  return tokens;
}

// --- Evaluate query ---
function evaluate(data, query) {
  const tokens = tokenize(query);
  return applyTokens(data, tokens);
}

function applyTokens(data, tokens) {
  let current = data;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'field') {
      if (current === null || current === undefined) return undefined;
      current = current[token.value];
    } else if (token.type === 'index') {
      if (!Array.isArray(current)) return undefined;
      const idx = token.value < 0 ? current.length + token.value : token.value;
      current = current[idx];
    } else if (token.type === 'slice') {
      if (!Array.isArray(current)) return undefined;
      current = current.slice(token.start, token.end);
    } else if (token.type === 'iterate') {
      if (Array.isArray(current)) {
        // Will be handled by pipe
        return current;
      } else if (typeof current === 'object' && current !== null) {
        return Object.values(current);
      }
      return [];
    } else if (token.type === 'func') {
      if (token.value === 'length') {
        if (Array.isArray(current)) return current.length;
        if (typeof current === 'object' && current !== null) return Object.keys(current).length;
        if (typeof current === 'string') return current.length;
        return undefined;
      } else if (token.value === 'keys') {
        if (typeof current === 'object' && current !== null) return Object.keys(current);
        return undefined;
      } else if (token.value === 'values') {
        if (typeof current === 'object' && current !== null) return Object.values(current);
        return undefined;
      } else if (token.value === 'type') {
        if (current === null) return 'null';
        if (Array.isArray(current)) return 'array';
        return typeof current;
      } else if (token.value === 'first') {
        if (Array.isArray(current) && current.length > 0) return current[0];
        return undefined;
      } else if (token.value === 'last') {
        if (Array.isArray(current) && current.length > 0) return current[current.length - 1];
        return undefined;
      } else if (token.value === 'unique') {
        if (Array.isArray(current)) return [...new Set(current)];
        return undefined;
      } else if (token.value === 'sort') {
        if (Array.isArray(current)) return [...current].sort();
        return undefined;
      } else if (token.value === 'reverse') {
        if (Array.isArray(current)) return [...current].reverse();
        return undefined;
      } else if (token.value === 'flatten') {
        if (Array.isArray(current)) return current.flat(Infinity);
        return undefined;
      } else if (token.value === 'min') {
        if (Array.isArray(current) && current.every(v => typeof v === 'number')) return Math.min(...current);
        return undefined;
      } else if (token.value === 'max') {
        if (Array.isArray(current) && current.every(v => typeof v === 'number')) return Math.max(...current);
        return undefined;
      } else if (token.value === 'sum') {
        if (Array.isArray(current) && current.every(v => typeof v === 'number')) return current.reduce((a, b) => a + b, 0);
        return undefined;
      } else if (token.value === 'avg') {
        if (Array.isArray(current) && current.every(v => typeof v === 'number')) return current.reduce((a, b) => a + b, 0) / current.length;
        return undefined;
      } else if (token.value === 'count') {
        if (Array.isArray(current)) return current.length;
        return undefined;
      } else if (token.value === 'map') {
        if (!Array.isArray(current)) return undefined;
        return current.map(item => evaluate(item, token.query));
      } else if (token.value === 'select') {
        if (!Array.isArray(current)) return undefined;
        return current.filter(item => evaluateCondition(item, token.condition));
      } else if (token.value === 'group_by') {
        if (!Array.isArray(current)) return undefined;
        const groups = {};
        current.forEach(item => {
          const key = item[token.field];
          const groupKey = JSON.stringify(key);
          if (!groups[groupKey]) groups[groupKey] = [];
          groups[groupKey].push(item);
        });
        return Object.values(groups);
      } else if (token.value === 'sort_by') {
        if (!Array.isArray(current)) return undefined;
        return [...current].sort((a, b) => {
          const va = a[token.field];
          const vb = b[token.field];
          if (va < vb) return -1;
          if (va > vb) return 1;
          return 0;
        });
      }
    } else if (token.type === 'pipe') {
      // Get remaining tokens after pipe
      const remaining = tokens.slice(i + 1);
      return applyTokens(current, remaining);
    } else if (token.type === 'dot') {
      // Just pass through
    }

    i++;
  }

  return current;
}

// --- Evaluate condition ---
function evaluateCondition(item, condition) {
  // Parse condition like .age > 25, .name == "test", .tags contains "a"
  const match = condition.match(/^\.(\w+)\s*(==|!=|<|>|<=|>=|contains)\s*(.+)$/);
  if (!match) return false;

  const [, field, op, valueStr] = match;
  const value = item[field];
  let expected;

  // Parse expected value
  const trimmed = valueStr.trim();
  if (trimmed === 'null') expected = null;
  else if (trimmed === 'true') expected = true;
  else if (trimmed === 'false') expected = false;
  else if (trimmed.startsWith('"') && trimmed.endsWith('"')) expected = trimmed.slice(1, -1);
  else if (trimmed.startsWith("'") && trimmed.endsWith("'")) expected = trimmed.slice(1, -1);
  else if (!isNaN(trimmed)) expected = Number(trimmed);
  else expected = trimmed;

  switch (op) {
    case '==': return value === expected;
    case '!=': return value !== expected;
    case '<': return value < expected;
    case '>': return value > expected;
    case '<=': return value <= expected;
    case '>=': return value >= expected;
    case 'contains':
      if (Array.isArray(value)) return value.includes(expected);
      if (typeof value === 'string') return value.includes(expected);
      return false;
    default: return false;
  }
}

// --- Format output ---
function formatOutput(data, compact, raw, useTab) {
  if (data === undefined) return `${C.dim}undefined${C.reset}`;
  if (data === null) return `${C.dim}null${C.reset}`;

  if (raw && typeof data === 'string') return data;

  if (compact) {
    return colorize(JSON.stringify(data));
  }

  const indent = useTab ? '\t' : 2;
  return colorize(JSON.stringify(data, null, indent));
}

function colorize(json) {
  return json
    .replace(/"([^"\\]*(\\.[^"\\]*)*)"\s*:/g, `${C.cyan}"$1"${C.reset}:`)
    .replace(/:\s*"([^"\\]*(\\.[^"\\]*)*)"/g, `: ${C.green}"$1"${C.reset}`)
    .replace(/:\s*(true|false)/g, `: ${C.yellow}$1${C.reset}`)
    .replace(/:\s*(null)/g, `: ${C.dim}$1${C.reset}`)
    .replace(/:\s*(-?\d+\.?\d*)/g, `: ${C.magenta}$1${C.reset}`);
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let query = null;
  let file = null;
  let compact = false;
  let raw = false;
  let existsCheck = false;
  let useTab = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-c' || arg === '--compact') {
      compact = true;
    } else if (arg === '-r' || arg === '--raw') {
      raw = true;
    } else if (arg === '-e' || arg === '--exists') {
      existsCheck = true;
    } else if (arg === '--tab') {
      useTab = true;
    } else if (!query) {
      query = arg;
    } else if (!file) {
      file = arg;
    }
  }

  return { query, file, compact, raw, existsCheck, useTab };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.query) {
    console.error('  Error: No query provided');
    process.exit(1);
  }

  // Read JSON input
  let input;
  if (opts.file) {
    try {
      input = readFileSync(opts.file, 'utf-8');
    } catch (err) {
      console.error(`  Error reading file: ${err.message}`);
      process.exit(1);
    }
  } else {
    // Read from stdin
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    input = Buffer.concat(chunks).toString('utf-8');
  }

  if (!input.trim()) {
    console.error('  Error: No JSON input');
    process.exit(1);
  }

  // Parse JSON
  let data;
  try {
    data = JSON.parse(input);
  } catch (err) {
    console.error(`  Error: Invalid JSON - ${err.message}`);
    process.exit(1);
  }

  // Evaluate query
  const result = evaluate(data, opts.query);

  // Exists check
  if (opts.existsCheck) {
    process.exit(result !== undefined && result !== null ? 0 : 1);
  }

  // Output
  console.log(formatOutput(result, opts.compact, opts.raw, opts.useTab));
}

main();
