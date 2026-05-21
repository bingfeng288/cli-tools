#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';

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
  \x1b[1mbase64\x1b[0m - Base64 encode/decode utility

  \x1b[1mUsage:\x1b[0m
    base64 encode <string>
    base64 decode <string>
    base64 encode-file <file> [output]
    base64 decode-file <file> [output]
    echo "text" | base64 encode

  \x1b[1mCommands:\x1b[0m
    encode <string>         Encode string to base64
    decode <string>         Decode base64 to string
    encode-file <file>      Encode file to base64
    decode-file <file>      Decode base64 file to binary
    url-encode <string>     Encode to URL-safe base64
    url-decode <string>     Decode URL-safe base64

  \x1b[1mOptions:\x1b[0m
    -u, --url-safe    Use URL-safe base64
    -w, --wrap <n>    Wrap output at n characters
    -o, --output <f>  Output to file
    -h, --help        Show this help

  \x1b[1mExamples:\x1b[0m
    base64 encode "Hello World"
    base64 decode "SGVsbG8gV29ybGQ="
    base64 encode-file image.png
    base64 decode-file encoded.txt output.png
    echo "Hello" | base64 encode
`);
}

// --- Encode string ---
function encodeString(str, urlSafe = false) {
  const encoded = Buffer.from(str, 'utf-8').toString('base64');
  if (urlSafe) {
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return encoded;
}

// --- Decode string ---
function decodeString(str, urlSafe = false) {
  let base64 = str;
  if (urlSafe) {
    base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
  }
  try {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch (err) {
    throw new Error(`Invalid base64 string: ${err.message}`);
  }
}

// --- Encode file ---
function encodeFile(inputPath, outputPath = null) {
  try {
    const data = readFileSync(inputPath);
    const encoded = data.toString('base64');

    if (outputPath) {
      writeFileSync(outputPath, encoded);
      console.log(`  ${C.green}Encoded:${C.reset} ${inputPath} -> ${outputPath}`);
    } else {
      console.log(encoded);
    }
  } catch (err) {
    throw new Error(`Error encoding file: ${err.message}`);
  }
}

// --- Decode file ---
function decodeFile(inputPath, outputPath = null) {
  try {
    const encoded = readFileSync(inputPath, 'utf-8').trim();
    const data = Buffer.from(encoded, 'base64');

    if (outputPath) {
      writeFileSync(outputPath, data);
      console.log(`  ${C.green}Decoded:${C.reset} ${inputPath} -> ${outputPath}`);
    } else {
      process.stdout.write(data);
    }
  } catch (err) {
    throw new Error(`Error decoding file: ${err.message}`);
  }
}

// --- Wrap text ---
function wrapText(text, width) {
  if (!width || width <= 0) return text;

  const lines = [];
  for (let i = 0; i < text.length; i += width) {
    lines.push(text.slice(i, i + width));
  }
  return lines.join('\n');
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let command = null;
  let urlSafe = false;
  let wrap = 0;
  let output = null;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-u' || arg === '--url-safe') {
      urlSafe = true;
    } else if (arg === '-w' || arg === '--wrap') {
      wrap = parseInt(args[++i]) || 0;
    } else if (arg === '-o' || arg === '--output') {
      output = args[++i];
    } else if (!arg.startsWith('-')) {
      if (!command) {
        command = arg;
      } else {
        positional.push(arg);
      }
    }
  }

  return { command, urlSafe, wrap, output, positional };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.command) {
    showHelp();
    process.exit(1);
  }

  try {
    switch (opts.command) {
      case 'encode':
      case 'enc':
        if (opts.positional.length < 1 && process.stdin.isTTY) {
          console.error(`  ${C.red}Error:${C.reset} Usage: base64 encode <string>`);
          process.exit(1);
        }

        let input;
        if (opts.positional.length > 0) {
          input = opts.positional.join(' ');
        } else {
          // Read from stdin
          const chunks = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          input = Buffer.concat(chunks).toString('utf-8').trim();
        }

        const encoded = encodeString(input, opts.urlSafe);
        console.log(wrapText(encoded, opts.wrap));
        break;

      case 'decode':
      case 'dec':
        if (opts.positional.length < 1 && process.stdin.isTTY) {
          console.error(`  ${C.red}Error:${C.reset} Usage: base64 decode <string>`);
          process.exit(1);
        }

        let encodedInput;
        if (opts.positional.length > 0) {
          encodedInput = opts.positional.join(' ');
        } else {
          // Read from stdin
          const chunks = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          encodedInput = Buffer.concat(chunks).toString('utf-8').trim();
        }

        const decoded = decodeString(encodedInput, opts.urlSafe);
        console.log(decoded);
        break;

      case 'encode-file':
      case 'enc-file':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: base64 encode-file <file> [output]`);
          process.exit(1);
        }
        encodeFile(opts.positional[0], opts.output || opts.positional[1]);
        break;

      case 'decode-file':
      case 'dec-file':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: base64 decode-file <file> [output]`);
          process.exit(1);
        }
        decodeFile(opts.positional[0], opts.output || opts.positional[1]);
        break;

      case 'url-encode':
      case 'url-enc':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: base64 url-encode <string>`);
          process.exit(1);
        }
        console.log(encodeString(opts.positional.join(' '), true));
        break;

      case 'url-decode':
      case 'url-dec':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: base64 url-decode <string>`);
          process.exit(1);
        }
        console.log(decodeString(opts.positional.join(' '), true));
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
