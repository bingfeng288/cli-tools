#!/usr/bin/env node

import { readFileSync } from 'node:fs';

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1myamljson\x1b[0m - YAML to JSON converter

  \x1b[1mUsage:\x1b[0m
    yamljson [file] [options]
    cat config.yaml | yamljson

  \x1b[1mOptions:\x1b[0m
    -i, --indent <n>    JSON indentation (default: 2)
    -c, --compact       Compact JSON output
    --validate          Validate YAML only
    -h, --help          Show this help

  \x1b[1mSupported YAML Features:\x1b[0m
    - Mappings (objects)
    - Sequences (arrays)
    - Scalars (strings, numbers, booleans, null)
    - Nested structures
    - Comments
    - Multi-line strings (basic)
    - Flow style (inline)

  \x1b[1mExamples:\x1b[0m
    yamljson config.yaml
    yamljson config.yaml -c
    yamljson config.yaml --validate
    echo 'name: test\nvalue: 42' | yamljson
`);
}

// --- Simple YAML parser ---
function parseYaml(text) {
  const lines = text.split('\n');
  const result = parseBlock(lines, 0, 0);
  return result.value;
}

function parseBlock(lines, startLine, indent) {
  // Determine if this is a mapping or sequence
  let isSequence = false;
  let isMapping = false;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const currentIndent = line.length - trimmed.length;

    if (trimmed === '' || trimmed.startsWith('#')) continue;

    if (currentIndent < indent) break;
    if (currentIndent > indent) continue;

    if (trimmed.startsWith('- ')) {
      isSequence = true;
      break;
    } else if (trimmed.includes(':')) {
      isMapping = true;
      break;
    }
  }

  if (isSequence) {
    return parseSequence(lines, startLine, indent);
  } else if (isMapping) {
    return parseMapping(lines, startLine, indent);
  }

  return { value: null, nextLine: startLine };
}

function parseMapping(lines, startLine, indent) {
  const result = {};
  let i = startLine;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const currentIndent = line.length - trimmed.length;

    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    if (currentIndent < indent) break;
    if (currentIndent > indent) {
      // This is a child of the previous key
      i++;
      continue;
    }

    // Parse key: value
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) {
      i++;
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    const valuePart = trimmed.slice(colonIndex + 1).trim();

    if (valuePart === '' || valuePart === '|' || valuePart === '>') {
      // Block value - parse child block
      const childIndent = indent + 2;
      const child = parseBlock(lines, i + 1, childIndent);
      result[key] = child.value;
      i = child.nextLine;
    } else if (valuePart.startsWith('[')) {
      // Flow sequence
      result[key] = parseFlowSequence(valuePart);
      i++;
    } else if (valuePart.startsWith('{')) {
      // Flow mapping
      result[key] = parseFlowMapping(valuePart);
      i++;
    } else {
      result[key] = parseScalar(valuePart);
      i++;
    }
  }

  return { value: result, nextLine: i };
}

function parseSequence(lines, startLine, indent) {
  const result = [];
  let i = startLine;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const currentIndent = line.length - trimmed.length;

    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    if (currentIndent < indent) break;

    if (trimmed.startsWith('- ')) {
      const valuePart = trimmed.slice(2).trim();

      if (valuePart === '' || valuePart === '|' || valuePart === '>') {
        // Block value
        const childIndent = indent + 2;
        const child = parseBlock(lines, i + 1, childIndent);
        result.push(child.value);
        i = child.nextLine;
      } else if (valuePart.includes(':')) {
        // Inline mapping
        const childIndent = indent + 2;
        const mapping = parseMapping(lines, i, childIndent);
        result.push(mapping.value);
        i = mapping.nextLine;
      } else {
        result.push(parseScalar(valuePart));
        i++;
      }
    } else if (currentIndent === indent) {
      // Same indent but not a sequence item - might be continuation
      break;
    } else {
      i++;
    }
  }

  return { value: result, nextLine: i };
}

function parseFlowSequence(str) {
  // Remove brackets
  const inner = str.slice(1, -1).trim();
  if (!inner) return [];

  return inner.split(',').map(item => parseScalar(item.trim()));
}

function parseFlowMapping(str) {
  // Remove braces
  const inner = str.slice(1, -1).trim();
  if (!inner) return {};

  const result = {};
  const pairs = inner.split(',');

  for (const pair of pairs) {
    const colonIndex = pair.indexOf(':');
    if (colonIndex === -1) continue;

    const key = pair.slice(0, colonIndex).trim();
    const value = pair.slice(colonIndex + 1).trim();
    result[key] = parseScalar(value);
  }

  return result;
}

function parseScalar(str) {
  // Remove quotes
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }

  // Boolean
  if (str === 'true' || str === 'True' || str === 'TRUE') return true;
  if (str === 'false' || str === 'False' || str === 'FALSE') return false;

  // Null
  if (str === 'null' || str === 'Null' || str === 'NULL' || str === '~') return null;

  // Number
  if (/^-?\d+$/.test(str)) return parseInt(str);
  if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);

  // String
  return str;
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
  let validate = false;
  let file = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-i' || arg === '--indent') {
      indent = parseInt(args[++i]) || 2;
    } else if (arg === '-c' || arg === '--compact') {
      compact = true;
    } else if (arg === '--validate') {
      validate = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { indent, compact, validate, file };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read input
  let input;
  if (opts.file) {
    try {
      input = readFileSync(opts.file, 'utf-8');
    } catch (err) {
      console.error(`  Error reading file: ${err.message}`);
      process.exit(1);
    }
  } else {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    input = Buffer.concat(chunks).toString('utf-8');
  }

  if (!input.trim()) {
    console.error('  Error: No YAML input');
    process.exit(1);
  }

  // Parse YAML
  try {
    const result = parseYaml(input);

    if (opts.validate) {
      console.log('\n  ✓ Valid YAML\n');
      return;
    }

    const jsonOpts = opts.compact ? 0 : opts.indent;
    console.log(JSON.stringify(result, null, jsonOpts));
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }
}

main();
