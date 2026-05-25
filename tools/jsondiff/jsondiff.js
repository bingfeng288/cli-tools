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
  \x1b[1mjsondiff\x1b[0m - JSON diff and comparison tool

  \x1b[1mUsage:\x1b[0m
    jsondiff <file1> <file2> [options]
    cat a.json | jsondiff <file2> [options]

  \x1b[1mOptions:\x1b[0m
    --ignore <path>     Ignore JSON Pointer path (repeatable)
    --types             Show type changes
    --values            Show value details (old/new)
    --paths             Show full JSON Pointer paths
    --compact           Compact output
    --json              Output as JSON patch array
    -h, --help          Show this help

  \x1b[1mOutput:\x1b[0m
    +  Added path (green)
    -  Removed path (red)
    ~  Changed value (yellow)
    !  Type changed (cyan)

  \x1b[1mExamples:\x1b[0m
    jsondiff a.json b.json
    jsondiff a.json b.json --values
    jsondiff a.json b.json --ignore /metadata/timestamp
    jsondiff a.json b.json --json
`);
}

// --- JSON Pointer helpers ---
function parsePointer(ptr) {
  if (ptr === '') return [];
  if (!ptr.startsWith('/')) throw new Error(`Invalid JSON pointer: ${ptr}`);
  return ptr.slice(1).split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function pointerToString(parts) {
  if (parts.length === 0) return '/';
  return '/' + parts.map(p => p.replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
}

function getType(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

// --- Deep diff ---
function deepDiff(a, b, path = [], ignorePaths = [], changes = []) {
  const currentPath = pointerToString(path);

  // Check if path should be ignored
  if (ignorePaths.includes(currentPath)) return changes;

  // Same reference
  if (a === b) return changes;

  const typeA = getType(a);
  const typeB = getType(b);

  // Different types
  if (typeA !== typeB) {
    changes.push({
      type: 'changed',
      path: currentPath,
      oldType: typeA,
      newType: typeB,
      oldValue: a,
      newValue: b,
    });
    return changes;
  }

  // Primitives
  if (typeA !== 'object' && typeA !== 'array') {
    if (a !== b) {
      changes.push({
        type: 'changed',
        path: currentPath,
        oldType: typeA,
        newType: typeB,
        oldValue: a,
        newValue: b,
      });
    }
    return changes;
  }

  // Both arrays
  if (typeA === 'array') {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const childPath = [...path, String(i)];
      const childPtr = pointerToString(childPath);
      if (ignorePaths.includes(childPtr)) continue;

      if (i >= a.length) {
        changes.push({ type: 'added', path: childPtr, value: b[i] });
      } else if (i >= b.length) {
        changes.push({ type: 'removed', path: childPtr, value: a[i] });
      } else {
        deepDiff(a[i], b[i], childPath, ignorePaths, changes);
      }
    }
    return changes;
  }

  // Both objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  const allKeys = new Set([...keysA, ...keysB]);

  for (const key of allKeys) {
    const childPath = [...path, key];
    const childPtr = pointerToString(childPath);
    if (ignorePaths.includes(childPtr)) continue;

    if (!(key in a)) {
      changes.push({ type: 'added', path: childPtr, value: b[key] });
    } else if (!(key in b)) {
      changes.push({ type: 'removed', path: childPtr, value: a[key] });
    } else {
      deepDiff(a[key], b[key], childPath, ignorePaths, changes);
    }
  }

  return changes;
}

// --- Format value for display ---
function formatValue(val, maxLen = 60) {
  const str = JSON.stringify(val);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// --- Display changes ---
function displayChanges(changes, opts) {
  const added = changes.filter(c => c.type === 'added');
  const removed = changes.filter(c => c.type === 'removed');
  const changed = changes.filter(c => c.type === 'changed');

  if (changes.length === 0) {
    console.log(`\n  ${C.green}Files are identical${C.reset}\n`);
    return;
  }

  console.log(`\n  ${C.bold}Changes:${C.reset} ${changes.length} difference${changes.length !== 1 ? 's' : ''}\n`);

  // Group by top-level path
  const groups = new Map();
  for (const change of changes) {
    const parts = parsePointer(change.path);
    const group = parts.length > 0 ? parts[0] : '(root)';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(change);
  }

  for (const [group, groupChanges] of groups) {
    console.log(`  ${C.bold}${group}${C.reset}`);

    for (const change of groupChanges) {
      const pathDisplay = opts.paths ? ` ${C.dim}${change.path}${C.reset}` : '';

      if (change.type === 'added') {
        console.log(`    ${C.green}+${C.reset}${pathDisplay}`);
        if (opts.values) {
          console.log(`      ${C.dim}${formatValue(change.value)}${C.reset}`);
        }
      } else if (change.type === 'removed') {
        console.log(`    ${C.red}-${C.reset}${pathDisplay}`);
        if (opts.values) {
          console.log(`      ${C.dim}${formatValue(change.value)}${C.reset}`);
        }
      } else if (change.type === 'changed') {
        const typeChanged = change.oldType !== change.newType;
        if (typeChanged && opts.types) {
          console.log(`    ${C.cyan}!${C.reset}${pathDisplay} ${C.dim}(${change.oldType} -> ${change.newType})${C.reset}`);
        } else {
          console.log(`    ${C.yellow}~${C.reset}${pathDisplay}`);
        }
        if (opts.values) {
          console.log(`      ${C.red}- ${formatValue(change.oldValue)}${C.reset}`);
          console.log(`      ${C.green}+ ${formatValue(change.newValue)}${C.reset}`);
        }
      }
    }
  }

  // Summary
  console.log(`\n  ${C.bold}Summary${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(30)}${C.reset}`);
  if (added.length > 0) console.log(`  ${C.green}Added:${C.reset}    ${added.length}`);
  if (removed.length > 0) console.log(`  ${C.red}Removed:${C.reset}  ${removed.length}`);
  if (changed.length > 0) console.log(`  ${C.yellow}Changed:${C.reset}  ${changed.length}`);
  console.log();
}

// --- JSON output ---
function jsonOutput(changes) {
  const patch = [];
  for (const change of changes) {
    if (change.type === 'added') {
      patch.push({ op: 'add', path: change.path, value: change.value });
    } else if (change.type === 'removed') {
      patch.push({ op: 'remove', path: change.path });
    } else if (change.type === 'changed') {
      patch.push({ op: 'replace', path: change.path, value: change.newValue });
    }
  }
  console.log(JSON.stringify(patch, null, 2));
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let file1 = null;
  let file2 = null;
  let ignorePaths = [];
  let types = false;
  let values = false;
  let paths = false;
  let compact = false;
  let jsonMode = false;

  const hasStdin = !process.stdin.isTTY;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--ignore') {
      ignorePaths.push(args[++i]);
    } else if (arg === '--types') {
      types = true;
    } else if (arg === '--values') {
      values = true;
    } else if (arg === '--paths') {
      paths = true;
    } else if (arg === '--compact') {
      compact = true;
    } else if (arg === '--json') {
      jsonMode = true;
    } else if (!arg.startsWith('-')) {
      if (!file1 && !hasStdin) {
        file1 = arg;
      } else if (!file2) {
        if (!file1 && hasStdin) {
          file1 = arg; // First non-flag arg when stdin is file2
        } else {
          file2 = arg;
        }
      }
    }
  }

  return { file1, file2, ignorePaths, types, values, paths, compact, jsonMode };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read JSON from file or stdin
  let doc1, doc2;

  if (opts.file1 && opts.file2) {
    try {
      doc1 = JSON.parse(readFileSync(opts.file1, 'utf-8'));
      doc2 = JSON.parse(readFileSync(opts.file2, 'utf-8'));
    } catch (err) {
      console.error(`  Error reading file: ${err.message}`);
      process.exit(1);
    }
  } else if (opts.file1 && !process.stdin.isTTY) {
    // stdin + file
    try {
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const input = Buffer.concat(chunks).toString('utf-8');
      if (!input.trim()) {
        console.error('  Error: No JSON input from stdin');
        process.exit(1);
      }
      doc1 = JSON.parse(input);
      doc2 = JSON.parse(readFileSync(opts.file1, 'utf-8'));
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      process.exit(1);
    }
  } else {
    showHelp();
    process.exit(1);
  }

  // Compare
  const changes = deepDiff(doc1, doc2, [], opts.ignorePaths);

  // Output
  if (opts.jsonMode) {
    jsonOutput(changes);
  } else {
    displayChanges(changes, opts);
  }
}

main();
