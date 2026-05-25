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
  \x1b[1mjsonpatch\x1b[0m - JSON Patch tool (RFC 6902)

  \x1b[1mUsage:\x1b[0m
    jsonpatch <file> <patch-file>
    jsonpatch <file> <operations...>
    cat doc.json | jsonpatch <operations...>

  \x1b[1mOperations:\x1b[0m
    add <path> <value>        Add value at path
    remove <path>             Remove value at path
    replace <path> <value>    Replace value at path
    move <from> <path>        Move value from path to path
    copy <from> <path>        Copy value from path to path
    test <path> <value>       Test value at path

  \x1b[1mPath Syntax:\x1b[0m
    /foo/bar                  Nested path
    /foo/0                    Array index
    /foo/-                    Array append
    /foo/bar~0baz            Escaped ~ (tilde)
    /foo/bar~1baz            Escaped / (slash)

  \x1b[1mOptions:\x1b[0m
    --indent <n>    JSON indentation (default: 2)
    --compact       Compact output
    --diff          Show diff of changes
    -h, --help      Show this help

  \x1b[1mExamples:\x1b[0m
    jsonpatch doc.json patch.json
    jsonpatch doc.json add /name "John"
    jsonpatch doc.json remove /age
    jsonpatch doc.json replace /status "active"
    jsonpatch doc.json move /old/path /new/path
    echo '{"a":1}' | jsonpatch add /b 2
`);
}

// --- JSON Pointer (RFC 6901) ---
function parsePointer(ptr) {
  if (ptr === '') return [];
  if (!ptr.startsWith('/')) throw new Error(`Invalid JSON pointer: ${ptr}`);

  return ptr.slice(1).split('/').map(part =>
    part.replace(/~1/g, '/').replace(/~0/g, '~')
  );
}

function getValue(obj, pointer) {
  const parts = parsePointer(pointer);
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const idx = part === '-' ? current.length : parseInt(part);
      if (isNaN(idx) || idx < 0 || idx > current.length) {
        return undefined;
      }
      current = current[idx];
    } else if (typeof current === 'object') {
      current = current[part];
    } else {
      return undefined;
    }
  }

  return current;
}

function setValue(obj, pointer, value) {
  const parts = parsePointer(pointer);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (Array.isArray(current)) {
      const idx = part === '-' ? current.length : parseInt(part);
      current = current[idx];
    } else {
      current = current[part];
    }
  }

  const lastPart = parts[parts.length - 1];
  if (Array.isArray(current)) {
    const idx = lastPart === '-' ? current.length : parseInt(lastPart);
    current[idx] = value;
  } else {
    current[lastPart] = value;
  }

  return obj;
}

function removeValue(obj, pointer) {
  const parts = parsePointer(pointer);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (Array.isArray(current)) {
      current = current[parseInt(part)];
    } else {
      current = current[part];
    }
  }

  const lastPart = parts[parts.length - 1];
  if (Array.isArray(current)) {
    const idx = parseInt(lastPart);
    current.splice(idx, 1);
  } else {
    delete current[lastPart];
  }

  return obj;
}

// --- Apply patch operations ---
function applyPatch(doc, operations) {
  const result = JSON.parse(JSON.stringify(doc)); // Deep clone
  const applied = [];

  for (const op of operations) {
    try {
      switch (op.op) {
        case 'add':
          if (op.path === '') {
            // Replace entire document
            return { result: op.value, applied: [...applied, { ...op, status: 'ok' }] };
          }
          setValue(result, op.path, op.value);
          applied.push({ ...op, status: 'ok' });
          break;

        case 'remove':
          removeValue(result, op.path);
          applied.push({ ...op, status: 'ok' });
          break;

        case 'replace':
          if (op.path === '') {
            return { result: op.value, applied: [...applied, { ...op, status: 'ok' }] };
          }
          removeValue(result, op.path);
          setValue(result, op.path, op.value);
          applied.push({ ...op, status: 'ok' });
          break;

        case 'move':
          const moveValue = getValue(result, op.from);
          if (moveValue === undefined) {
            throw new Error(`Path not found: ${op.from}`);
          }
          removeValue(result, op.from);
          setValue(result, op.path, moveValue);
          applied.push({ ...op, status: 'ok' });
          break;

        case 'copy':
          const copyValue = getValue(result, op.from);
          if (copyValue === undefined) {
            throw new Error(`Path not found: ${op.from}`);
          }
          setValue(result, op.path, JSON.parse(JSON.stringify(copyValue)));
          applied.push({ ...op, status: 'ok' });
          break;

        case 'test':
          const testValue = getValue(result, op.path);
          if (JSON.stringify(testValue) !== JSON.stringify(op.value)) {
            throw new Error(`Test failed at ${op.path}: expected ${JSON.stringify(op.value)}, got ${JSON.stringify(testValue)}`);
          }
          applied.push({ ...op, status: 'ok' });
          break;

        default:
          throw new Error(`Unknown operation: ${op.op}`);
      }
    } catch (err) {
      applied.push({ ...op, status: 'error', error: err.message });
      return { result, applied, error: err.message };
    }
  }

  return { result, applied };
}

// --- Parse operations from CLI args ---
function parseOperations(args) {
  const operations = [];
  let i = 0;

  while (i < args.length) {
    const op = args[i];

    switch (op) {
      case 'add':
      case 'replace':
        operations.push({
          op,
          path: args[++i],
          value: parseValue(args[++i]),
        });
        break;

      case 'remove':
        operations.push({
          op,
          path: args[++i],
        });
        break;

      case 'move':
      case 'copy':
        operations.push({
          op,
          from: args[++i],
          path: args[++i],
        });
        break;

      case 'test':
        operations.push({
          op,
          path: args[++i],
          value: parseValue(args[++i]),
        });
        break;

      default:
        // Try to parse as JSON patch file
        try {
          const content = readFileSync(op, 'utf-8');
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            operations.push(...parsed);
          }
        } catch (err) {
          console.error(`  Error: Unknown operation or file: ${op}`);
          process.exit(1);
        }
    }

    i++;
  }

  return operations;
}

function parseValue(str) {
  if (str === undefined) return undefined;

  // Try JSON parse
  try {
    return JSON.parse(str);
  } catch {
    // Return as string
    return str;
  }
}

// --- Display diff ---
function showDiff(original, patched) {
  const origStr = JSON.stringify(original, null, 2).split('\n');
  const patchedStr = JSON.stringify(patched, null, 2).split('\n');

  console.log(`\n  ${C.bold}Diff:${C.reset}\n`);

  const maxLen = Math.max(origStr.length, patchedStr.length);
  for (let i = 0; i < maxLen; i++) {
    const orig = origStr[i] || '';
    const patched = patchedStr[i] || '';

    if (orig !== patched) {
      if (orig) console.log(`  ${C.red}-${C.reset} ${orig}`);
      if (patched) console.log(`  ${C.green}+${C.reset} ${patched}`);
    } else {
      console.log(`  ${C.dim} ${orig}${C.reset}`);
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

  let indent = 2;
  let compact = false;
  let showDiff = false;
  let file = null;
  let opArgs = [];

  // Check if stdin has data
  const hasStdin = !process.stdin.isTTY;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--indent') {
      indent = parseInt(args[++i]) || 2;
    } else if (arg === '--compact') {
      compact = true;
    } else if (arg === '--diff') {
      showDiff = true;
    } else if (!arg.startsWith('-')) {
      if (!file && !hasStdin) {
        file = arg;
      } else {
        opArgs.push(arg);
      }
    }
  }

  return { indent, compact, showDiff, file, opArgs };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.file && opts.opArgs.length === 0) {
    showHelp();
    return;
  }

  // Read document
  let doc;
  if (opts.file) {
    try {
      doc = JSON.parse(readFileSync(opts.file, 'utf-8'));
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
    const input = Buffer.concat(chunks).toString('utf-8');
    if (!input.trim()) {
      console.error('  Error: No JSON input');
      process.exit(1);
    }
    doc = JSON.parse(input);
  }

  // Parse operations
  const operations = parseOperations(opts.opArgs);

  if (operations.length === 0) {
    console.error('  Error: No patch operations');
    process.exit(1);
  }

  // Apply patch
  const { result, applied, error } = applyPatch(doc, operations);

  // Display
  if (opts.showDiff) {
    showDiff(doc, result);
  }

  const jsonOpts = opts.compact ? 0 : opts.indent;
  console.log(JSON.stringify(result, null, jsonOpts));
}

main();
