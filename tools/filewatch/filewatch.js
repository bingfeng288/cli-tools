#!/usr/bin/env node

import { watch, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { exec } from 'node:child_process';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mfilewatch\x1b[0m - File watcher

  \x1b[1mUsage:\x1b[0m
    filewatch <path> [options]

  \x1b[1mOptions:\x1b[0m
    -e, --ext <ext>       Filter by extension (e.g., js, ts)
    -i, --ignore <pattern> Ignore pattern (glob)
    -c, --command <cmd>   Command to execute on change
    -d, --debounce <ms>   Debounce time (default: 300)
    -r, --recursive       Watch recursively
    --verbose             Show all events
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    filewatch .
    filewatch src -e js -c "echo changed"
    filewatch . -r -e ts -c "npm test"
    filewatch . --ignore "node_modules"
`);
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

// --- Get all files recursively ---
function getFiles(dir, ext = null, ignore = []) {
  const files = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Check ignore patterns
      if (ignore.some(p => globMatch(p, entry.name))) continue;

      if (entry.isFile()) {
        if (!ext || extname(entry.name).slice(1) === ext) {
          files.push(fullPath);
        }
      } else if (entry.isDirectory()) {
        files.push(...getFiles(fullPath, ext, ignore));
      }
    }
  } catch (err) {
    // Ignore permission errors
  }
  return files;
}

// --- Watch files ---
function watchFiles(path, options = {}) {
  const {
    ext = null,
    ignore = [],
    command = null,
    debounce = 300,
    recursive = false,
    verbose = false,
  } = options;

  let debounceTimer = null;
  let running = false;

  const executeCommand = (changedFile) => {
    if (!command) return;

    if (running) {
      if (verbose) console.log(`  ${C.yellow}Command still running, skipping...${C.reset}`);
      return;
    }

    running = true;
    const startTime = Date.now();

    console.log(`\n  ${C.cyan}Executing:${C.reset} ${command}`);
    console.log(`  ${C.dim}Triggered by: ${changedFile}${C.reset}\n`);

    const child = exec(command, (error, stdout, stderr) => {
      running = false;
      const duration = Date.now() - startTime;

      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

      if (error) {
        console.log(`  ${C.red}Exit code: ${error.code}${C.reset}`);
      } else {
        console.log(`  ${C.green}Done${C.reset} ${C.dim}(${duration}ms)${C.reset}`);
      }
    });
  };

  const handleChange = (eventType, filename) => {
    if (!filename) return;

    // Filter by extension
    if (ext && extname(filename).slice(1) !== ext) return;

    // Check ignore patterns
    if (ignore.some(p => globMatch(p, filename))) return;

    const timestamp = new Date().toLocaleTimeString();
    console.log(`  ${C.dim}${timestamp}${C.reset} ${C.yellow}${eventType}${C.reset} ${filename}`);

    // Debounce
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      executeCommand(filename);
    }, debounce);
  };

  // Determine if path is file or directory
  try {
    const stat = statSync(path);
    if (stat.isFile()) {
      console.log(`\n  ${C.bold}Watching file:${C.reset} ${path}`);
      watch(path, (eventType) => handleChange(eventType, path));
    } else {
      console.log(`\n  ${C.bold}Watching:${C.reset} ${path}`);
      if (ext) console.log(`  ${C.dim}Filter: .${ext}${C.reset}`);
      if (command) console.log(`  ${C.dim}Command: ${command}${C.reset}`);
      console.log();

      const options = { recursive };
      watch(path, options, (eventType, filename) => {
        handleChange(eventType, filename);
      });
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }

  console.log(`  ${C.dim}Press Ctrl+C to stop${C.reset}\n`);
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let path = '.';
  let ext = null;
  let ignore = [];
  let command = null;
  let debounce = 300;
  let recursive = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-e' || arg === '--ext') {
      ext = args[++i];
    } else if (arg === '-i' || arg === '--ignore') {
      ignore.push(args[++i]);
    } else if (arg === '-c' || arg === '--command') {
      command = args[++i];
    } else if (arg === '-d' || arg === '--debounce') {
      debounce = parseInt(args[++i]) || 300;
    } else if (arg === '-r' || arg === '--recursive') {
      recursive = true;
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (!arg.startsWith('-')) {
      path = arg;
    }
  }

  return { path, ext, ignore, command, debounce, recursive, verbose };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);
  watchFiles(opts.path, opts);
}

main();
