#!/usr/bin/env node

import { randomBytes, randomUUID } from 'node:crypto';

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1muuidgen\x1b[0m - UUID generator CLI

  \x1b[1mUsage:\x1b[0m
    uuidgen [options]

  \x1b[1mOptions:\x1b[0m
    -n, --count <n>       Generate n UUIDs (default: 1)
    -v, --version <ver>   UUID version: 4 (default), 1
    -f, --format <fmt>    Format: standard, nodash, upper, braces, urn
    --validate <uuid>     Validate a UUID
    --extract             Extract timestamp from UUID v1
    -h, --help            Show this help

  \x1b[1mFormats:\x1b[0m
    standard   550e8400-e29b-41d4-a716-446655440000
    nodash     550e8400e29b41d4a716446655440000
    upper      550E8400-E29B-41D4-A716-446655440000
    braces     {550e8400-e29b-41d4-a716-446655440000}
    urn        urn:uuid:550e8400-e29b-41d4-a716-446655440000

  \x1b[1mExamples:\x1b[0m
    uuidgen
    uuidgen -n 5
    uuidgen -f upper
    uuidgen -f nodash
    uuidgen --validate "550e8400-e29b-41d4-a716-446655440000"
`);
}

// --- UUID v4 ---
function uuidv4() {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 1
  return formatUuid(bytes);
}

// --- UUID v1 (timestamp-based) ---
function uuidv1() {
  const now = Date.now();
  const gregorianOffset = 122192928000000000n;
  const timestamp = BigInt(now) * 10000n + gregorianOffset;

  const bytes = randomBytes(16);

  // Time low (bytes 0-3)
  bytes[0] = Number((timestamp >> 24n) & 0xffn);
  bytes[1] = Number((timestamp >> 16n) & 0xffn);
  bytes[2] = Number((timestamp >> 8n) & 0xffn);
  bytes[3] = Number(timestamp & 0xffn);

  // Time mid (bytes 4-5)
  bytes[4] = Number((timestamp >> 40n) & 0xffn);
  bytes[5] = Number((timestamp >> 32n) & 0xffn);

  // Time hi and version (bytes 6-7)
  const timeHi = Number((timestamp >> 48n) & 0x0fffn);
  bytes[6] = ((timeHi >> 8) & 0x0f) | 0x10; // Version 1
  bytes[7] = timeHi & 0xff;

  // Clock sequence (bytes 8-9)
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 1

  // Node (bytes 10-15) - use random
  return formatUuid(bytes);
}

// --- Format UUID bytes ---
function formatUuid(bytes) {
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// --- Format UUID string ---
function formatUuidStr(uuid, format) {
  const clean = uuid.replace(/[{}]/g, '').replace('urn:uuid:', '');

  switch (format) {
    case 'nodash':
      return clean.replace(/-/g, '');
    case 'upper':
      return clean.toUpperCase();
    case 'braces':
      return `{${clean}}`;
    case 'urn':
      return `urn:uuid:${clean}`;
    case 'standard':
    default:
      return clean;
  }
}

// --- Validate UUID ---
function validateUuid(uuid) {
  const clean = uuid.replace(/[{}]/g, '').replace('urn:uuid:', '');
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!regex.test(clean)) {
    return { valid: false, error: 'Invalid UUID format' };
  }

  const parts = clean.split('-');
  const version = parseInt(parts[2][0], 16);
  const variant = parseInt(parts[3][0], 16);

  if (version < 1 || version > 5) {
    return { valid: false, error: `Invalid version: ${version}` };
  }

  if (variant < 8 || variant > 11) {
    return { valid: false, error: `Invalid variant: ${variant}` };
  }

  return {
    valid: true,
    version,
    variant: variant >= 10 ? 'RFC 4122' : 'Other',
    format: detectFormat(uuid),
  };
}

// --- Detect format ---
function detectFormat(uuid) {
  if (uuid.startsWith('{')) return 'braces';
  if (uuid.startsWith('urn:')) return 'urn';
  if (uuid === uuid.toUpperCase() && uuid.includes('-')) return 'upper';
  if (!uuid.includes('-')) return 'nodash';
  return 'standard';
}

// --- Extract timestamp from v1 ---
function extractTimestamp(uuid) {
  const clean = uuid.replace(/[{}]/g, '').replace('urn:uuid:', '');
  const parts = clean.split('-');

  if (parts.length !== 5) return null;

  const version = parseInt(parts[2][0], 16);
  if (version !== 1) return null;

  const timeLow = parts[0];
  const timeMid = parts[1];
  const timeHi = parts[2].slice(1);

  const timestamp = BigInt(`0x${timeHi}${timeMid}${timeLow}`);
  const gregorianOffset = 122192928000000000n;
  const unixTime = Number((timestamp - gregorianOffset) / 10000n);

  return new Date(unixTime);
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let count = 1;
  let version = 4;
  let format = 'standard';
  let validate = null;
  let extract = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--count') {
      count = parseInt(args[++i]) || 1;
    } else if (arg === '-v' || arg === '--version') {
      version = parseInt(args[++i]) || 4;
    } else if (arg === '-f' || arg === '--format') {
      format = args[++i]?.toLowerCase() || 'standard';
    } else if (arg === '--validate') {
      validate = args[++i];
    } else if (arg === '--extract') {
      extract = true;
    }
  }

  return { count, version, format, validate, extract };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  // Validate mode
  if (opts.validate) {
    const result = validateUuid(opts.validate);
    if (result.valid) {
      console.log(`\n  ✓ Valid UUID`);
      console.log(`  Version: ${result.version}`);
      console.log(`  Variant: ${result.variant}`);
      console.log(`  Format:  ${result.format}\n`);

      if (result.version === 1 && opts.extract) {
        const timestamp = extractTimestamp(opts.validate);
        if (timestamp) {
          console.log(`  Timestamp: ${timestamp.toISOString()}\n`);
        }
      }
    } else {
      console.log(`\n  ✗ ${result.error}\n`);
      process.exit(1);
    }
    return;
  }

  // Generate UUIDs
  const generator = opts.version === 1 ? uuidv1 : uuidv4;
  const uuids = [];

  for (let i = 0; i < opts.count; i++) {
    const uuid = generator();
    uuids.push(formatUuidStr(uuid, opts.format));
  }

  console.log();
  uuids.forEach(uuid => console.log(`  ${uuid}`));
  console.log();
}

main();
