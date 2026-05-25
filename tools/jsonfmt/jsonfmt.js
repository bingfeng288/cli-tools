#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// --- Commands ---
const commands = {
  format(args) {
    const { input, indent } = parseArgs(args);
    const data = parseInput(input);
    const formatted = JSON.stringify(data, null, indent || 2);
    output(formatted);
  },

  minify(args) {
    const { input } = parseArgs(args);
    const data = parseInput(input);
    output(JSON.stringify(data));
  },

  validate(args) {
    const { input } = parseArgs(args);
    try {
      const data = parseInput(input);
      const type = Array.isArray(data) ? 'array' : typeof data;
      const keys = type === 'object' ? Object.keys(data).length : 0;
      console.log(`\n  Valid JSON (${type}${keys > 0 ? `, ${keys} keys` : ''})\n`);
    } catch (err) {
      console.error(`\n  Invalid JSON: ${err.message}\n`);
      process.exit(1);
    }
  },

  path(args) {
    const { input, extra } = parseArgs(args);
    const jsonPath = extra[0];
    if (!jsonPath) {
      console.error('  Usage: jsonfmt path <file> <path>');
      console.error('  Example: jsonfmt path data.json "users.0.name"');
      return;
    }
    const data = parseInput(input);
    const result = getNestedValue(data, jsonPath);
    if (result === undefined) {
      console.log('\n  (undefined)\n');
    } else {
      output(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
    }
  },

  keys(args) {
    const { input, extra } = parseArgs(args);
    const data = parseInput(input);
    const maxDepth = parseInt(extra[0]) || 3;
    const keys = extractKeys(data, '', maxDepth);
    console.log('\n  Keys:\n');
    keys.forEach(k => console.log(`    ${k}`));
    console.log(`\n  Total: ${keys.length} keys\n`);
  },

  diff(args) {
    const { input, extra } = parseArgs(args);
    const file2 = extra[0];
    if (!file2) {
      console.error('  Usage: jsonfmt diff <file1> <file2>');
      return;
    }
    const data1 = parseInput(input);
    const data2 = JSON.parse(readFileSync(file2, 'utf-8'));
    const diffs = findDiffs(data1, data2, '');
    if (diffs.length === 0) {
      console.log('\n  No differences found\n');
    } else {
      console.log('\n  Differences:\n');
      diffs.forEach(d => {
        const icon = d.type === 'added' ? '+' : d.type === 'removed' ? '-' : '~';
        const color = d.type === 'added' ? '\x1b[32m' : d.type === 'removed' ? '\x1b[31m' : '\x1b[33m';
        console.log(`    ${color}${icon}\x1b[0m ${d.path}: ${JSON.stringify(d.value)}`);
      });
      console.log(`\n  ${diffs.length} differences\n`);
    }
  },

  merge(args) {
    const { input, extra } = parseArgs(args);
    const file2 = extra[0];
    if (!file2) {
      console.error('  Usage: jsonfmt merge <file1> <file2>');
      return;
    }
    const data1 = parseInput(input);
    const data2 = JSON.parse(readFileSync(file2, 'utf-8'));
    const merged = deepMerge(data1, data2);
    output(JSON.stringify(merged, null, 2));
  },

  query(args) {
    const { input, extra } = parseArgs(args);
    const filter = extra[0];
    if (!filter) {
      console.error('  Usage: jsonfmt query <file> <filter>');
      console.error('  Example: jsonfmt query data.json "age>25"');
      return;
    }
    const data = parseInput(input);
    const arr = Array.isArray(data) ? data : [data];
    const [key, op, value] = parseFilter(filter);
    const results = arr.filter(item => {
      const itemVal = getNestedValue(item, key);
      if (itemVal === undefined) return false;
      switch (op) {
        case '=': return String(itemVal) === value;
        case '>': return Number(itemVal) > Number(value);
        case '<': return Number(itemVal) < Number(value);
        case '>=': return Number(itemVal) >= Number(value);
        case '<=': return Number(itemVal) <= Number(value);
        case '!=': return String(itemVal) !== value;
        case 'contains': return String(itemVal).includes(value);
        default: return false;
      }
    });
    output(JSON.stringify(results, null, 2));
  },

  stats(args) {
    const { input } = parseArgs(args);
    const data = parseInput(input);
    const stats = getStats(data);
    console.log('\n  JSON Statistics:\n');
    console.log(`    Type:       ${stats.type}`);
    console.log(`    Size:       ${stats.size} bytes`);
    console.log(`    Keys:       ${stats.keys}`);
    console.log(`    Depth:      ${stats.depth}`);
    console.log(`    Arrays:     ${stats.arrays}`);
    console.log(`    Objects:    ${stats.objects}`);
    console.log(`    Strings:    ${stats.strings}`);
    console.log(`    Numbers:    ${stats.numbers}`);
    console.log(`    Booleans:   ${stats.booleans}`);
    console.log(`    Nulls:      ${stats.nulls}`);
    console.log();
  },

  help() {
    console.log(`
  jsonfmt - JSON Formatter & Validator

  Usage: jsonfmt <command> <file> [options]

  Commands:
    format [file]           Format JSON (default: 2 spaces)
    minify [file]           Minify JSON
    validate [file]         Validate JSON
    path [file] <path>      Extract value at path (e.g., "users.0.name")
    keys [file] [depth]     List all keys
    diff <file1> <file2>    Compare two JSON files
    merge <file1> <file2>   Deep merge two JSON files
    query <file> <filter>   Filter array by condition
    stats [file]            Show JSON statistics

  Options:
    -i, --indent N          Indentation spaces (default: 2)
    -o, --output FILE       Write to file instead of stdout

  Examples:
    jsonfmt format data.json
    jsonfmt minify data.json
    jsonfmt validate data.json
    jsonfmt path data.json "users.0.name"
    jsonfmt keys data.json 5
    jsonfmt diff a.json b.json
    jsonfmt query data.json "age>25"
    jsonfmt stats data.json
`);
  },
};

// --- Helpers ---
function parseArgs(args) {
  let input = '';
  let indent = 2;
  let outputFile = '';
  const extra = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-i' || args[i] === '--indent') {
      indent = parseInt(args[++i]) || 2;
    } else if (args[i] === '-o' || args[i] === '--output') {
      outputFile = args[++i];
    } else if (!input) {
      input = args[i];
    } else {
      extra.push(args[i]);
    }
  }

  return { input, indent, outputFile, extra };
}

function parseInput(input) {
  let raw;
  if (!input || input === '-') {
    raw = readFileSync('/dev/stdin', 'utf-8');
  } else if (existsSync(input)) {
    raw = readFileSync(input, 'utf-8');
  } else {
    raw = input;
  }
  return JSON.parse(raw);
}

function output(text) {
  console.log('\n' + text + '\n');
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, key) => {
    if (o === null || o === undefined) return undefined;
    return o[key];
  }, obj);
}

function extractKeys(obj, prefix, maxDepth, depth = 0) {
  if (depth >= maxDepth) return [prefix || '(root)'];
  const keys = [];
  if (typeof obj === 'object' && obj !== null) {
    for (const key of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys.push(...extractKeys(obj[key], fullKey, maxDepth, depth + 1));
      }
    }
  }
  return keys;
}

function findDiffs(a, b, path) {
  const diffs = [];
  if (typeof a !== typeof b) {
    diffs.push({ type: 'changed', path: path || '(root)', value: b });
    return diffs;
  }
  if (typeof a !== 'object' || a === null) {
    if (a !== b) diffs.push({ type: 'changed', path: path || '(root)', value: b });
    return diffs;
  }
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const fullPath = path ? `${path}.${key}` : key;
    if (!(key in a)) {
      diffs.push({ type: 'added', path: fullPath, value: b[key] });
    } else if (!(key in b)) {
      diffs.push({ type: 'removed', path: fullPath, value: a[key] });
    } else {
      diffs.push(...findDiffs(a[key], b[key], fullPath));
    }
  }
  return diffs;
}

function deepMerge(a, b) {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return b;
  const result = { ...a };
  for (const key of Object.keys(b)) {
    if (key in result && typeof result[key] === 'object' && typeof b[key] === 'object') {
      result[key] = deepMerge(result[key], b[key]);
    } else {
      result[key] = b[key];
    }
  }
  return result;
}

function parseFilter(filter) {
  const match = filter.match(/^([^><=!]+)(>=|<=|!=|>|<|=|contains)(.+)$/);
  if (!match) return [filter, '=', ''];
  return [match[1].trim(), match[2], match[3].trim()];
}

function getStats(obj, depth = 0) {
  const stats = { type: Array.isArray(obj) ? 'array' : typeof obj, size: 0, keys: 0, depth, arrays: 0, objects: 0, strings: 0, numbers: 0, booleans: 0, nulls: 0 };

  if (typeof obj === 'string') { stats.strings++; stats.size = obj.length; }
  else if (typeof obj === 'number') { stats.numbers++; stats.size = 8; }
  else if (typeof obj === 'boolean') { stats.booleans++; stats.size = 1; }
  else if (obj === null) { stats.nulls++; stats.size = 4; }
  else if (Array.isArray(obj)) {
    stats.arrays++;
    obj.forEach(item => {
      const child = getStats(item, depth + 1);
      stats.keys += child.keys;
      stats.arrays += child.arrays;
      stats.objects += child.objects;
      stats.strings += child.strings;
      stats.numbers += child.numbers;
      stats.booleans += child.booleans;
      stats.nulls += child.nulls;
      stats.depth = Math.max(stats.depth, child.depth);
    });
  } else if (typeof obj === 'object') {
    stats.objects++;
    const keys = Object.keys(obj);
    stats.keys += keys.length;
    keys.forEach(key => {
      const child = getStats(obj[key], depth + 1);
      stats.keys += child.keys;
      stats.arrays += child.arrays;
      stats.objects += child.objects;
      stats.strings += child.strings;
      stats.numbers += child.numbers;
      stats.booleans += child.booleans;
      stats.nulls += child.nulls;
      stats.depth = Math.max(stats.depth, child.depth);
    });
  }

  return stats;
}

// --- Main ---
const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === '-h' || cmd === '--help') {
  commands.help();
} else if (commands[cmd]) {
  commands[cmd](args.slice(1));
} else {
  // Default to format if first arg is a file
  if (existsSync(cmd)) {
    commands.format(args);
  } else {
    console.error(`  Unknown command: ${cmd}`);
    console.error(`  Run 'jsonfmt --help' for usage.`);
    process.exit(1);
  }
}
