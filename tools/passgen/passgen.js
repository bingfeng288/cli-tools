#!/usr/bin/env node

import { randomBytes, randomInt } from 'node:crypto';

const WORDS = [
  'apple','banana','cherry','delta','eagle','falcon','grape','harbor',
  'island','jungle','karma','lunar','matrix','nebula','orbit','pixel',
  'quantum','river','solar','tiger','ultra','vortex','winter','xenon',
  'yoga','zenith','amber','blaze','coral','drift','ember','frost',
  'glyph','haze','iris','jade','kite','lava','moss','nova',
  'opal','pearl','quest','raven','sage','thorn','unity','vivid',
  'wave','yarn','zinc','arch','bolt','cove','dune','echo',
  'fern','glow','helm','iron','jazz','knot','lens','mist',
  'node','opal','pine','reef','silk','tide','vale','wick',
];

function generatePassword(length = 16, options = {}) {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
    exclude = '',
  } = options;

  let chars = '';
  if (lowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (numbers) chars += '0123456789';
  if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // Remove excluded characters
  if (exclude) {
    chars = chars.split('').filter(c => !exclude.includes(c)).join('');
  }

  if (!chars) {
    console.error('  Error: No character sets selected');
    process.exit(1);
  }

  let password = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }

  // Ensure at least one char from each selected set
  const sets = [];
  if (lowercase) sets.push('abcdefghijklmnopqrstuvwxyz');
  if (uppercase) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  if (numbers) sets.push('0123456789');
  if (symbols) sets.push('!@#$%^&*()_+-=[]{}|;:,.<>?');

  const passwordArr = password.split('');
  sets.forEach((set, i) => {
    const filteredSet = set.split('').filter(c => !exclude.includes(c));
    if (filteredSet.length > 0) {
      passwordArr[i] = filteredSet[randomInt(filteredSet.length)];
    }
  });

  // Shuffle
  for (let i = passwordArr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [passwordArr[i], passwordArr[j]] = [passwordArr[j], passwordArr[i]];
  }

  return passwordArr.join('');
}

function generateMemorable(wordCount = 4, separator = '-') {
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    const word = WORDS[randomInt(WORDS.length)];
    words.push(word);
  }
  // Capitalize first letter of each word
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(separator);
}

function generatePin(length = 6) {
  let pin = '';
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    pin += (bytes[i] % 10).toString();
  }
  return pin;
}

function checkStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong', 'Excellent'];
  const colors = ['\x1b[31m', '\x1b[31m', '\x1b[33m', '\x1b[33m', '\x1b[32m', '\x1b[32m', '\x1b[36m'];
  const idx = Math.min(score, labels.length - 1);

  return { score, label: labels[idx], color: colors[idx] };
}

// --- CLI ---
const args = process.argv.slice(2);

function showHelp() {
  console.log(`
  passgen - Secure Password Generator

  Usage: passgen [options]

  Options:
    -l, --length N      Password length (default: 16)
    -n, --count N       Generate N passwords (default: 1)
    -m, --memorable     Generate memorable password (word-based)
    -w, --words N       Number of words for memorable password (default: 4)
    -p, --pin           Generate PIN code
    --pin-length N      PIN length (default: 6)
    --no-uppercase      Exclude uppercase letters
    --no-lowercase      Exclude lowercase letters
    --no-numbers        Exclude numbers
    --no-symbols        Exclude symbols
    --exclude CHARS     Exclude specific characters
    -s, --separator C   Word separator for memorable passwords (default: -)
    --strength          Show password strength
    -h, --help          Show this help

  Examples:
    passgen                     # 16-char random password
    passgen -l 32               # 32-char password
    passgen -n 5                # 5 passwords
    passgen -m                  # Memorable password
    passgen -m -w 6             # 6-word memorable password
    passgen -p                  # 6-digit PIN
    passgen -p --pin-length 8   # 8-digit PIN
    passgen --no-symbols        # No special characters
    passgen --strength          # Show password strength
`);
}

// Parse args
let length = 16;
let count = 1;
let memorable = false;
let wordCount = 4;
let pin = false;
let pinLength = 6;
let uppercase = true;
let lowercase = true;
let numbers = true;
let symbols = true;
let exclude = '';
let separator = '-';
let showStrength = false;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-l': case '--length': length = parseInt(args[++i]) || 16; break;
    case '-n': case '--count': count = parseInt(args[++i]) || 1; break;
    case '-m': case '--memorable': memorable = true; break;
    case '-w': case '--words': wordCount = parseInt(args[++i]) || 4; break;
    case '-p': case '--pin': pin = true; break;
    case '--pin-length': pinLength = parseInt(args[++i]) || 6; break;
    case '--no-uppercase': uppercase = false; break;
    case '--no-lowercase': lowercase = false; break;
    case '--no-numbers': numbers = false; break;
    case '--no-symbols': symbols = false; break;
    case '--exclude': exclude = args[++i] || ''; break;
    case '-s': case '--separator': separator = args[++i] || '-'; break;
    case '--strength': showStrength = true; break;
    case '-h': case '--help': showHelp(); process.exit(0);
  }
}

console.log();

if (pin) {
  for (let i = 0; i < count; i++) {
    const p = generatePin(pinLength);
    console.log(`  ${p}`);
    if (showStrength) {
      const s = checkStrength(p);
      console.log(`    Strength: ${s.color}${s.label}\x1b[0m`);
    }
  }
} else if (memorable) {
  for (let i = 0; i < count; i++) {
    const p = generateMemorable(wordCount, separator);
    console.log(`  ${p}`);
    if (showStrength) {
      const s = checkStrength(p);
      console.log(`    Strength: ${s.color}${s.label}\x1b[0m`);
    }
  }
} else {
  for (let i = 0; i < count; i++) {
    const p = generatePassword(length, { uppercase, lowercase, numbers, symbols, exclude });
    console.log(`  ${p}`);
    if (showStrength) {
      const s = checkStrength(p);
      console.log(`    Strength: ${s.color}${s.label}\x1b[0m`);
    }
  }
}

console.log();
