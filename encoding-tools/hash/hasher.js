#!/usr/bin/env node

import { createHash, createHmac } from 'node:crypto';
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
  \x1b[1mhash\x1b[0m - Hash generator utility

  \x1b[1mUsage:\x1b[0m
    hash <algorithm> <string>
    hash <algorithm> --file <path>
    hash hmac <algorithm> <key> <string>
    hash verify <algorithm> <hash> <string>
    echo "text" | hash <algorithm>

  \x1b[1mAlgorithms:\x1b[0m
    md5, sha1, sha224, sha256, sha384, sha512

  \x1b[1mCommands:\x1b[0m
    <algorithm> <string>     Generate hash
    hmac <algo> <key> <str>  Generate HMAC
    verify <algo> <hash> <str>  Verify hash
    file <algo> <path>       Hash file contents

  \x1b[1mOptions:\x1b[0m
    -f, --file <path>   Hash file contents
    -u, --upper         Output uppercase hex
    -b, --binary        Output binary
    -h, --help          Show this help

  \x1b[1mExamples:\x1b[0m
    hash sha256 "Hello World"
    hash md5 --file document.txt
    hash hmac sha256 "secret" "message"
    hash verify sha256 "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e" "Hello World"
    echo "Hello" | hash sha256
`);
}

// --- Generate hash ---
function generateHash(algorithm, data, options = {}) {
  const { upper = false, binary = false } = options;

  try {
    const hash = createHash(algorithm);

    if (typeof data === 'string') {
      hash.update(data, 'utf-8');
    } else {
      hash.update(data);
    }

    if (binary) {
      return hash.digest();
    }

    const hex = hash.digest('hex');
    return upper ? hex.toUpperCase() : hex;
  } catch (err) {
    throw new Error(`Invalid algorithm: ${algorithm}`);
  }
}

// --- Generate HMAC ---
function generateHmac(algorithm, key, data, options = {}) {
  const { upper = false } = options;

  try {
    const hmac = createHmac(algorithm, key);
    hmac.update(data, 'utf-8');
    const hex = hmac.digest('hex');
    return upper ? hex.toUpperCase() : hex;
  } catch (err) {
    throw new Error(`Invalid algorithm or key: ${err.message}`);
  }
}

// --- Verify hash ---
function verifyHash(algorithm, expectedHash, data) {
  const actualHash = generateHash(algorithm, data);
  return actualHash.toLowerCase() === expectedHash.toLowerCase();
}

// --- Hash file ---
function hashFile(algorithm, filePath, options = {}) {
  try {
    const data = readFileSync(filePath);
    return generateHash(algorithm, data, options);
  } catch (err) {
    throw new Error(`Error reading file: ${err.message}`);
  }
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let command = null;
  let algorithm = null;
  let upper = false;
  let binary = false;
  let file = null;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-u' || arg === '--upper') {
      upper = true;
    } else if (arg === '-b' || arg === '--binary') {
      binary = true;
    } else if (arg === '-f' || arg === '--file') {
      file = args[++i];
    } else if (!arg.startsWith('-')) {
      if (!command) {
        command = arg;
      } else if (!algorithm) {
        algorithm = arg;
      } else {
        positional.push(arg);
      }
    }
  }

  return { command, algorithm, upper, binary, file, positional };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.command) {
    showHelp();
    process.exit(1);
  }

  const algorithms = ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512'];

  try {
    // Check if command is an algorithm
    if (algorithms.includes(opts.command)) {
      const algo = opts.command;

      if (opts.file) {
        // Hash file
        const result = hashFile(algo, opts.file, { upper: opts.upper, binary: opts.binary });
        console.log(result);
      } else if (opts.algorithm) {
        // Hash string
        const result = generateHash(algo, opts.algorithm, { upper: opts.upper, binary: opts.binary });
        console.log(result);
      } else if (!process.stdin.isTTY) {
        // Read from stdin
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        const input = Buffer.concat(chunks).toString('utf-8').trim();
        const result = generateHash(algo, input, { upper: opts.upper, binary: opts.binary });
        console.log(result);
      } else {
        console.error(`  ${C.red}Error:${C.reset} No input provided`);
        process.exit(1);
      }
      return;
    }

    // Handle named commands
    switch (opts.command) {
      case 'hmac':
        if (!opts.algorithm || opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: hash hmac <algorithm> <key> <string>`);
          process.exit(1);
        }
        const hmacResult = generateHmac(opts.algorithm, opts.positional[0], opts.positional.slice(1).join(' '), { upper: opts.upper });
        console.log(hmacResult);
        break;

      case 'verify':
        if (!opts.algorithm || opts.positional.length < 2) {
          console.error(`  ${C.red}Error:${C.reset} Usage: hash verify <algorithm> <hash> <string>`);
          process.exit(1);
        }
        const isValid = verifyHash(opts.algorithm, opts.positional[0], opts.positional.slice(1).join(' '));
        if (isValid) {
          console.log(`  ${C.green}✓${C.reset} Hash matches`);
        } else {
          console.log(`  ${C.red}✗${C.reset} Hash does not match`);
          process.exit(1);
        }
        break;

      case 'file':
        if (!opts.algorithm || opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: hash file <algorithm> <path>`);
          process.exit(1);
        }
        const fileResult = hashFile(opts.algorithm, opts.positional[0], { upper: opts.upper, binary: opts.binary });
        console.log(fileResult);
        break;

      case 'list':
        console.log(`  ${C.bold}Available algorithms:${C.reset}`);
        for (const algo of algorithms) {
          console.log(`  ${C.cyan}•${C.reset} ${algo}`);
        }
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
