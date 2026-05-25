#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1menvview\x1b[0m - Environment variable viewer

  \x1b[1mUsage:\x1b[0m
    envview [options]
    envview <name>
    envview --env <file>

  \x1b[1mOptions:\x1b[0m
    -f, --filter <pattern>    Filter by name pattern (glob)
    -s, --search <text>       Search in names and values
    --sort <by>               Sort by: name, value (default: name)
    --env <file>              Parse .env file
    --export                  Output as export statements
    --json                    Output as JSON
    --show-hidden             Show variables starting with _
    --values-only             Show values only
    -h, --help                Show this help

  \x1b[1mExamples:\x1b[0m
    envview
    envview PATH
    envview -f "NODE*"
    envview -s "usr/local"
    envview --env .env
    envview --export
    envview --json
`);
}

// --- Parse .env file ---
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const vars = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    vars[key] = value;
  }

  return vars;
}

// --- Glob match ---
function globMatch(pattern, str) {
  const regex = new RegExp(
    '^' +
    pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.') +
    '$',
    'i'
  );
  return regex.test(str);
}

// --- Display ---
function displayVars(vars, options = {}) {
  const {
    filter = null,
    search = null,
    sortBy = 'name',
    showHidden = false,
    valuesOnly = false,
    exportFormat = false,
    jsonFormat = false,
  } = options;

  let entries = Object.entries(vars);

  // Filter hidden
  if (!showHidden) {
    entries = entries.filter(([key]) => !key.startsWith('_'));
  }

  // Filter by pattern
  if (filter) {
    entries = entries.filter(([key]) => globMatch(filter, key));
  }

  // Search
  if (search) {
    const searchLower = search.toLowerCase();
    entries = entries.filter(([key, value]) =>
      key.toLowerCase().includes(searchLower) ||
      value.toLowerCase().includes(searchLower)
    );
  }

  // Sort
  if (sortBy === 'value') {
    entries.sort((a, b) => a[1].localeCompare(b[1]));
  } else {
    entries.sort((a, b) => a[0].localeCompare(b[0]));
  }

  // Output
  if (jsonFormat) {
    console.log(JSON.stringify(Object.fromEntries(entries), null, 2));
    return;
  }

  if (exportFormat) {
    entries.forEach(([key, value]) => {
      console.log(`export ${key}="${value}"`);
    });
    return;
  }

  if (entries.length === 0) {
    console.log(`\n  ${C.dim}No variables found${C.reset}\n`);
    return;
  }

  // Calculate max key length
  const maxKey = Math.max(...entries.map(([k]) => k.length));

  console.log();
  entries.forEach(([key, value]) => {
    if (valuesOnly) {
      console.log(`  ${value}`);
    } else {
      // Color based on value type
      let valueColor = C.green;
      if (value.includes('/') || value.includes('\\')) valueColor = C.cyan;
      else if (value === 'true' || value === 'false') valueColor = C.yellow;
      else if (/^\d+$/.test(value)) valueColor = C.yellow;

      // Truncate long values
      const maxLen = 80;
      const displayValue = value.length > maxLen ? value.slice(0, maxLen) + '...' : value;

      console.log(`  ${C.bold}${key.padEnd(maxKey)}${C.reset} = ${valueColor}${displayValue}${C.reset}`);
    }
  });

  console.log(`\n  ${C.dim}${entries.length} variable${entries.length !== 1 ? 's' : ''}${C.reset}\n`);
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let filter = null;
  let search = null;
  let sortBy = 'name';
  let envFile = null;
  let exportFormat = false;
  let jsonFormat = false;
  let showHidden = false;
  let valuesOnly = false;
  let name = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-f' || arg === '--filter') {
      filter = args[++i];
    } else if (arg === '-s' || arg === '--search') {
      search = args[++i];
    } else if (arg === '--sort') {
      sortBy = args[++i]?.toLowerCase() || 'name';
    } else if (arg === '--env') {
      envFile = args[++i];
    } else if (arg === '--export') {
      exportFormat = true;
    } else if (arg === '--json') {
      jsonFormat = true;
    } else if (arg === '--show-hidden') {
      showHidden = true;
    } else if (arg === '--values-only') {
      valuesOnly = true;
    } else if (!arg.startsWith('-')) {
      name = arg;
    }
  }

  return { filter, search, sortBy, envFile, exportFormat, jsonFormat, showHidden, valuesOnly, name };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  // Get variables
  let vars;
  if (opts.envFile) {
    try {
      vars = parseEnvFile(opts.envFile);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      process.exit(1);
    }
  } else {
    vars = process.env;
  }

  // Quick lookup by name
  if (opts.name) {
    const value = vars[opts.name];
    if (value !== undefined) {
      console.log(`\n  ${C.bold}${opts.name}${C.reset} = ${C.green}${value}${C.reset}\n`);
    } else {
      console.log(`\n  ${C.dim}${opts.name} is not set${C.reset}\n`);
      process.exit(1);
    }
    return;
  }

  displayVars(vars, opts);
}

main();
