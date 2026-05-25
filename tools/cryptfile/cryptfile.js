#!/usr/bin/env node

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';

// --- Constants ---
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// --- Help ---
function showHelp() {
  console.log(`
  ${C.bold}cryptfile${C.reset} - File encryption/decryption using AES-256-GCM

  ${C.bold}Usage:${C.reset}
    cryptfile encrypt <file> [options]
    cryptfile decrypt <file> [options]
    cryptfile encrypt-text <text> [options]
    cryptfile decrypt-text <encoded> [options]
    cryptfile generate-key

  ${C.bold}Options:${C.reset}
    -p, --password <pass>     Password for key derivation
    -o, --output <file>       Output file path
    -k, --key <hex>           Raw encryption key (64 hex chars)
    -f, --force               Overwrite existing output file
    -h, --help                Show this help

  ${C.bold}Examples:${C.reset}
    cryptfile encrypt secret.txt -p mypassword
    cryptfile decrypt secret.txt.enc -p mypassword
    cryptfile encrypt-text "hello world" -p mypassword
    cryptfile decrypt-text "base64data" -p mypassword
    cryptfile generate-key

  ${C.bold}File Format:${C.reset}
    [32B salt][16B IV][16B auth tag][...encrypted data]
`);
}

// --- Key derivation ---
function deriveKey(password, salt) {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

// --- Encrypt ---
function encryptData(data, password, key = null) {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const derivedKey = key ? Buffer.from(key, 'hex') : deriveKey(password, salt);

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]);
}

// --- Decrypt ---
function decryptData(encryptedData, password, key = null) {
  if (encryptedData.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted data: too short');
  }

  const salt = encryptedData.subarray(0, SALT_LENGTH);
  const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = encryptedData.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const data = encryptedData.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const derivedKey = key ? Buffer.from(key, 'hex') : deriveKey(password, salt);

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(data), decipher.final()]);
  } catch (err) {
    throw new Error('Decryption failed: wrong password or corrupted data');
  }
}

// --- File operations ---
function encryptFile(inputPath, outputPath, password, key, force) {
  if (!existsSync(inputPath)) {
    console.error(`  ${C.red}Error:${C.reset} File not found: ${inputPath}`);
    process.exit(1);
  }

  if (!outputPath) {
    outputPath = inputPath + '.enc';
  }

  if (existsSync(outputPath) && !force) {
    console.error(`  ${C.red}Error:${C.reset} Output file exists: ${outputPath} (use -f to overwrite)`);
    process.exit(1);
  }

  const data = readFileSync(inputPath);
  const encrypted = encryptData(data, password, key);
  writeFileSync(outputPath, encrypted);

  const inputSize = data.length;
  const outputSize = encrypted.length;

  console.log(`\n  ${C.green}✓${C.reset} Encrypted successfully`);
  console.log(`  ${C.dim}Input:${C.reset}  ${inputPath} (${formatSize(inputSize)})`);
  console.log(`  ${C.dim}Output:${C.reset} ${outputPath} (${formatSize(outputSize)})`);
  console.log(`  ${C.dim}Method:${C.reset} AES-256-GCM with PBKDF2 key derivation`);
  console.log();
}

function decryptFile(inputPath, outputPath, password, key, force) {
  if (!existsSync(inputPath)) {
    console.error(`  ${C.red}Error:${C.reset} File not found: ${inputPath}`);
    process.exit(1);
  }

  if (!outputPath) {
    if (inputPath.endsWith('.enc')) {
      outputPath = inputPath.slice(0, -4);
    } else {
      outputPath = inputPath + '.dec';
    }
  }

  if (existsSync(outputPath) && !force) {
    console.error(`  ${C.red}Error:${C.reset} Output file exists: ${outputPath} (use -f to overwrite)`);
    process.exit(1);
  }

  const encrypted = readFileSync(inputPath);

  try {
    const decrypted = decryptData(encrypted, password, key);
    writeFileSync(outputPath, decrypted);

    console.log(`\n  ${C.green}✓${C.reset} Decrypted successfully`);
    console.log(`  ${C.dim}Input:${C.reset}  ${inputPath} (${formatSize(encrypted.length)})`);
    console.log(`  ${C.dim}Output:${C.reset} ${outputPath} (${formatSize(decrypted.length)})`);
    console.log();
  } catch (err) {
    console.error(`\n  ${C.red}Error:${C.reset} ${err.message}\n`);
    process.exit(1);
  }
}

function encryptText(text, password, key) {
  const data = Buffer.from(text, 'utf-8');
  const encrypted = encryptData(data, password, key);
  const encoded = encrypted.toString('base64');

  console.log(`\n  ${C.green}✓${C.reset} Encrypted text`);
  console.log(`  ${C.dim}Output:${C.reset} ${encoded}`);
  console.log();
  return encoded;
}

function decryptText(encoded, password, key) {
  const encrypted = Buffer.from(encoded, 'base64');

  try {
    const decrypted = decryptData(encrypted, password, key);
    const text = decrypted.toString('utf-8');

    console.log(`\n  ${C.green}✓${C.reset} Decrypted text`);
    console.log(`  ${C.dim}Output:${C.reset} ${text}`);
    console.log();
    return text;
  } catch (err) {
    console.error(`\n  ${C.red}Error:${C.reset} ${err.message}\n`);
    process.exit(1);
  }
}

function generateKey() {
  const key = randomBytes(KEY_LENGTH).toString('hex');
  console.log(`\n  ${C.green}✓${C.reset} Generated encryption key`);
  console.log(`  ${C.dim}Key:${C.reset} ${key}`);
  console.log(`\n  ${C.yellow}Warning:${C.reset} Store this key securely. It cannot be recovered.`);
  console.log();
  return key;
}

// --- Utility ---
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// --- Password input ---
function promptPassword(message) {
  return new Promise((resolve) => {
    process.stdout.write(message);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');

    let password = '';
    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        process.exit(130);
      } else if (char === '\u007F' || char === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += char;
        process.stdout.write('*');
      }
    };
    process.stdin.on('data', onData);
  });
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  const command = args[0];
  let input = null;
  let password = null;
  let output = null;
  let key = null;
  let force = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-p' || arg === '--password') {
      password = args[++i];
    } else if (arg === '-o' || arg === '--output') {
      output = args[++i];
    } else if (arg === '-k' || arg === '--key') {
      key = args[++i];
    } else if (arg === '-f' || arg === '--force') {
      force = true;
    } else if (!input) {
      input = arg;
    }
  }

  return { command, input, password, output, key, force };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (opts.command === 'generate-key') {
    generateKey();
    return;
  }

  if (!opts.input) {
    console.error(`  ${C.red}Error:${C.reset} No input provided`);
    process.exit(1);
  }

  // Get password if needed
  if (!opts.password && !opts.key) {
    if (opts.command === 'encrypt' || opts.command === 'encrypt-text') {
      opts.password = await promptPassword('  Enter password: ');
      const confirm = await promptPassword('  Confirm password: ');
      if (opts.password !== confirm) {
        console.error(`\n  ${C.red}Error:${C.reset} Passwords do not match\n`);
        process.exit(1);
      }
    } else {
      opts.password = await promptPassword('  Enter password: ');
    }
  }

  switch (opts.command) {
    case 'encrypt':
      encryptFile(opts.input, opts.output, opts.password, opts.key, opts.force);
      break;
    case 'decrypt':
      decryptFile(opts.input, opts.output, opts.password, opts.key, opts.force);
      break;
    case 'encrypt-text':
      encryptText(opts.input, opts.password, opts.key);
      break;
    case 'decrypt-text':
      decryptText(opts.input, opts.password, opts.key);
      break;
    default:
      console.error(`  ${C.red}Error:${C.reset} Unknown command: ${opts.command}`);
      process.exit(1);
  }
}

main();
