#!/usr/bin/env node

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mbaseconv\x1b[0m - Number base converter

  \x1b[1mUsage:\x1b[0m
    baseconv <number> [options]
    baseconv <number> --to <base>

  \x1b[1mOptions:\x1b[0m
    --from, -f <base>     Input base (2-36, default: auto-detect)
    --to, -t <base>       Output base (2-36, default: all common)
    --all                 Show all bases (default)
    --signed              Treat as signed integer
    --bits <n>            Bit width for signed (8, 16, 32, 64)
    --pad <n>             Pad binary to n bits
    --group <n>           Group binary digits
    -h, --help            Show this help

  \x1b[1mCommon Bases:\x1b[0m
    2   Binary
    8   Octal
    10  Decimal
    16  Hexadecimal
    36  Base36

  \x1b[1mInput Formats:\x1b[0m
    0b1010    Binary (prefix)
    0o12      Octal (prefix)
    0x0a      Hex (prefix)
    10        Decimal (default)

  \x1b[1mExamples:\x1b[0m
    baseconv 255
    baseconv 0xff
    baseconv 0b11111111
    baseconv 255 --to 2
    baseconv 255 --to 16
    baseconv --from 2 1010 --to 10
    baseconv 0xff --pad 8 --group 4
`);
}

// --- Parse number from string ---
function parseNumber(str, fromBase = null) {
  str = str.trim().toLowerCase();

  // Auto-detect base from prefix
  let detectedBase = fromBase;
  let numStr = str;

  if (str.startsWith('0b')) {
    detectedBase = detectedBase || 2;
    numStr = str.slice(2);
  } else if (str.startsWith('0o')) {
    detectedBase = detectedBase || 8;
    numStr = str.slice(2);
  } else if (str.startsWith('0x')) {
    detectedBase = detectedBase || 16;
    numStr = str.slice(2);
  } else if (!detectedBase) {
    detectedBase = 10;
  }

  // Validate
  const validChars = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, detectedBase);
  for (const ch of numStr) {
    if (!validChars.includes(ch) && ch !== '-') {
      throw new Error(`Invalid character '${ch}' for base ${detectedBase}`);
    }
  }

  const value = parseInt(numStr, detectedBase);
  if (isNaN(value)) {
    throw new Error(`Invalid number: ${str}`);
  }

  return { value, base: detectedBase };
}

// --- Convert to base ---
function toBase(value, base) {
  if (value < 0) return '-' + toBase(-value, base);
  return value.toString(base).toUpperCase();
}

// --- Format binary with grouping ---
function formatBinary(binStr, pad = 0, group = 0) {
  // Pad
  if (pad > 0) {
    binStr = binStr.padStart(pad, '0');
  }

  // Group
  if (group > 0) {
    const groups = [];
    for (let i = binStr.length; i > 0; i -= group) {
      groups.unshift(binStr.slice(Math.max(0, i - group), i));
    }
    return groups.join(' ');
  }

  return binStr;
}

// --- Convert signed ---
function toSigned(value, bits) {
  const max = Math.pow(2, bits) - 1;
  if (value > max) {
    throw new Error(`Value ${value} exceeds ${bits}-bit range`);
  }

  // Two's complement
  if (value >= Math.pow(2, bits - 1)) {
    return value - Math.pow(2, bits);
  }
  return value;
}

// --- Display all bases ---
function displayAll(value, pad, group) {
  console.log();
  console.log(`  ${C.bold}Value:${C.reset} ${C.cyan}${value}${C.reset}`);
  console.log(`  ${'─'.repeat(40)}`);

  const bases = [
    { name: 'Binary', base: 2, prefix: '0b' },
    { name: 'Octal', base: 8, prefix: '0o' },
    { name: 'Decimal', base: 10, prefix: '' },
    { name: 'Hex', base: 16, prefix: '0x' },
    { name: 'Base36', base: 36, prefix: '' },
  ];

  bases.forEach(({ name, base, prefix }) => {
    let converted = toBase(Math.abs(value), base);
    if (base === 2 && (pad || group)) {
      converted = formatBinary(converted, pad, group);
    }
    const sign = value < 0 ? '-' : '';
    console.log(`  ${C.dim}${name.padEnd(10)}${C.reset} ${C.green}${prefix}${sign}${converted}${C.reset}`);
  });

  console.log();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let fromBase = null;
  let toBase = null;
  let showAll = true;
  let signed = false;
  let bits = 32;
  let pad = 0;
  let group = 0;
  let number = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--from' || arg === '-f') {
      fromBase = parseInt(args[++i]);
    } else if (arg === '--to' || arg === '-t') {
      toBase = parseInt(args[++i]);
      showAll = false;
    } else if (arg === '--all') {
      showAll = true;
    } else if (arg === '--signed') {
      signed = true;
    } else if (arg === '--bits') {
      bits = parseInt(args[++i]) || 32;
    } else if (arg === '--pad') {
      pad = parseInt(args[++i]) || 0;
    } else if (arg === '--group') {
      group = parseInt(args[++i]) || 4;
    } else if (!arg.startsWith('-')) {
      number = arg;
    }
  }

  return { fromBase, toBase, showAll, signed, bits, pad, group, number };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (!opts.number) {
    showHelp();
    return;
  }

  try {
    const { value, base } = parseNumber(opts.number, opts.fromBase);
    let finalValue = value;

    // Handle signed
    if (opts.signed) {
      finalValue = toSigned(value, opts.bits);
    }

    if (opts.showAll) {
      displayAll(finalValue, opts.pad, opts.group);
    } else {
      // Convert to specific base
      let converted = toBase(Math.abs(finalValue), opts.toBase);
      if (opts.toBase === 2 && (opts.pad || opts.group)) {
        converted = formatBinary(converted, opts.pad, opts.group);
      }

      const sign = finalValue < 0 ? '-' : '';
      const prefix = opts.toBase === 2 ? '0b' : opts.toBase === 8 ? '0o' : opts.toBase === 16 ? '0x' : '';

      console.log(`\n  ${C.green}${prefix}${sign}${converted}${C.reset}\n`);
    }
  } catch (err) {
    console.error(`\n  ${C.red}Error:${C.reset} ${err.message}\n`);
    process.exit(1);
  }
}

main();
