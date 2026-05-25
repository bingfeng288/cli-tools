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
  \x1b[1menvdiff\x1b[0m - Environment variable diff tool

  \x1b[1mUsage:\x1b[0m
    envdiff <file1> <file2>
    envdiff merge <file1> <file2> [output]
    envdiff filter <file> <pattern>

  \x1b[1mCommands:\x1b[0m
    diff <file1> <file2>      Compare two .env files
    merge <file1> <file2>     Merge two .env files
    filter <file> <pattern>   Filter variables by pattern
    list <file>               List all variables
    export <file>             Output as export statements

  \x1b[1mOptions:\x1b[0m
    -i, --ignore <pattern>    Ignore variable pattern
    -v, --verbose             Show detailed output
    -q, --quiet               Only show changed variables
    -h, --help                Show this help

  \x1b[1mExamples:\x1b[0m
    envdiff .env .env.production
    envdiff merge .env .env.local
    envdiff filter .env "DATABASE_*"
    envdiff list .env
    envdiff export .env
`);
}

// --- Parse .env file ---
function parseEnv(content) {
  const vars = {};
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Parse key=value
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      // Remove quotes if present
      let cleanValue = value.trim();
      if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
          (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
        cleanValue = cleanValue.slice(1, -1);
      }
      vars[key] = cleanValue;
    }
  }

  return vars;
}

// --- Diff environments ---
function diffEnv(env1, env2, options = {}) {
  const { ignore = [], verbose = false, quiet = false } = options;

  const allKeys = new Set([...Object.keys(env1), ...Object.keys(env2)]);
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const key of allKeys) {
    // Check ignore patterns
    if (ignore.some(pat => key.includes(pat))) continue;

    if (!(key in env1)) {
      added.push({ key, value: env2[key] });
    } else if (!(key in env2)) {
      removed.push({ key, value: env1[key] });
    } else if (env1[key] !== env2[key]) {
      changed.push({ key, oldValue: env1[key], newValue: env2[key] });
    } else {
      unchanged.push({ key, value: env1[key] });
    }
  }

  return { added, removed, changed, unchanged };
}

// --- Display diff ---
function displayDiff(diff, options = {}) {
  const { verbose = false, quiet = false } = options;
  const { added, removed, changed, unchanged } = diff;

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    console.log(`  ${C.green}Files are identical${C.reset}`);
    return;
  }

  console.log();

  if (added.length > 0) {
    console.log(`  ${C.green}Added:${C.reset}`);
    for (const { key, value } of added) {
      console.log(`    ${C.green}+${C.reset} ${key}=${value}`);
    }
  }

  if (removed.length > 0) {
    console.log(`  ${C.red}Removed:${C.reset}`);
    for (const { key, value } of removed) {
      console.log(`    ${C.red}-${C.reset} ${key}=${value}`);
    }
  }

  if (changed.length > 0) {
    console.log(`  ${C.yellow}Changed:${C.reset}`);
    for (const { key, oldValue, newValue } of changed) {
      console.log(`    ${C.yellow}~${C.reset} ${key}`);
      if (verbose) {
        console.log(`      ${C.red}- ${oldValue}${C.reset}`);
        console.log(`      ${C.green}+ ${newValue}${C.reset}`);
      }
    }
  }

  if (verbose && unchanged.length > 0) {
    console.log(`  ${C.dim}Unchanged:${C.reset} ${unchanged.length}`);
  }

  // Summary
  console.log(`\n  ${C.bold}Summary${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(30)}${C.reset}`);
  if (added.length > 0) console.log(`  ${C.green}Added:${C.reset}    ${added.length}`);
  if (removed.length > 0) console.log(`  ${C.red}Removed:${C.reset}  ${removed.length}`);
  if (changed.length > 0) console.log(`  ${C.yellow}Changed:${C.reset}  ${changed.length}`);
  if (!quiet && unchanged.length > 0) console.log(`  ${C.dim}Unchanged:${C.reset} ${unchanged.length}`);
  console.log();
}

// --- Merge environments ---
function mergeEnv(env1, env2) {
  return { ...env1, ...env2 };
}

// --- Filter variables ---
function filterEnv(env, pattern) {
  const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
  const result = {};

  for (const [key, value] of Object.entries(env)) {
    if (regex.test(key)) {
      result[key] = value;
    }
  }

  return result;
}

// --- Format as export statements ---
function formatExport(env) {
  return Object.entries(env)
    .map(([key, value]) => `export ${key}="${value}"`)
    .join('\n');
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let command = null;
  let ignore = [];
  let verbose = false;
  let quiet = false;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-i' || arg === '--ignore') {
      ignore.push(args[++i]);
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (arg === '-q' || arg === '--quiet') {
      quiet = true;
    } else if (!arg.startsWith('-')) {
      if (!command) {
        command = arg;
      } else {
        positional.push(arg);
      }
    }
  }

  return { command, ignore, verbose, quiet, positional };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (!opts.command) {
    showHelp();
    process.exit(1);
  }

  try {
    switch (opts.command) {
      case 'diff':
        if (opts.positional.length < 2) {
          console.error(`  ${C.red}Error:${C.reset} Usage: envdiff diff <file1> <file2>`);
          process.exit(1);
        }
        const env1 = parseEnv(readFileSync(opts.positional[0], 'utf-8'));
        const env2 = parseEnv(readFileSync(opts.positional[1], 'utf-8'));
        const diff = diffEnv(env1, env2, { ignore: opts.ignore, verbose: opts.verbose, quiet: opts.quiet });
        displayDiff(diff, { verbose: opts.verbose, quiet: opts.quiet });
        break;

      case 'merge':
        if (opts.positional.length < 2) {
          console.error(`  ${C.red}Error:${C.reset} Usage: envdiff merge <file1> <file2> [output]`);
          process.exit(1);
        }
        const mergeEnv1 = parseEnv(readFileSync(opts.positional[0], 'utf-8'));
        const mergeEnv2 = parseEnv(readFileSync(opts.positional[1], 'utf-8'));
        const merged = mergeEnv(mergeEnv1, mergeEnv2);
        const output = Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n');
        console.log(output);
        break;

      case 'filter':
        if (opts.positional.length < 2) {
          console.error(`  ${C.red}Error:${C.reset} Usage: envdiff filter <file> <pattern>`);
          process.exit(1);
        }
        const filterFileEnv = parseEnv(readFileSync(opts.positional[0], 'utf-8'));
        const filtered = filterEnv(filterFileEnv, opts.positional[1]);
        for (const [key, value] of Object.entries(filtered)) {
          console.log(`${key}=${value}`);
        }
        break;

      case 'list':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: envdiff list <file>`);
          process.exit(1);
        }
        const listEnv = parseEnv(readFileSync(opts.positional[0], 'utf-8'));
        for (const [key, value] of Object.entries(listEnv)) {
          console.log(`${key}=${value}`);
        }
        break;

      case 'export':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: envdiff export <file>`);
          process.exit(1);
        }
        const exportEnv = parseEnv(readFileSync(opts.positional[0], 'utf-8'));
        console.log(formatExport(exportEnv));
        break;

      default:
        console.error(`  ${C.red}Error:${C.reset} Unknown command: ${opts.command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
