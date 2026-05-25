#!/usr/bin/env node

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

// --- Common passwords (top 100) ---
const COMMON_PASSWORDS = new Set([
  '123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111',
  '1234567', 'dragon', '123123', 'baseball', 'abc123', 'football', 'monkey', 'letmein',
  'shadow', 'master', '666666', 'qwertyuiop', '123321', 'mustang', '1234567890', 'michael',
  '654321', 'superman', '1qaz2wsx', '7777777', '121212', '000000', 'qazwsx', '123qwe',
  'killer', 'trustno1', 'jordan', 'jennifer', 'zxcvbnm', 'asdfgh', 'hunter', 'buster',
  'soccer', 'harley', 'batman', 'andrew', 'tigger', 'sunshine', 'iloveyou', '2000',
  'charlie', 'robert', 'thomas', 'hockey', 'ranger', 'daniel', 'starwars', 'klaster',
  '112233', 'george', 'computer', 'michelle', 'jessica', 'pepper', '1111', 'zxcvbn',
  '555555', '11111111', '131313', 'freedom', '777777', 'pass', 'maggie', '159753',
  'aaaaaa', 'ginger', 'princess', 'joshua', 'cheese', 'amanda', 'summer', 'love',
  'ashley', 'nicole', 'chelsea', 'biteme', 'matthew', 'access', 'yankees', '987654321',
  'dallas', 'austin', 'thunder', 'taylor', 'matrix', 'mobilemail', 'admin', 'passwd',
]);

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mpasscheck\x1b[0m - Password strength checker

  \x1b[1mUsage:\x1b[0m
    passcheck <password>
    echo "password" | passcheck

  \x1b[1mOptions:\x1b[0m
    --json        Output as JSON
    --silent      Only show score (0-100)
    -h, --help    Show this help

  \x1b[1mExamples:\x1b[0m
    passcheck "MyP@ssw0rd!"
    passcheck "123456"
    echo "test" | passcheck
`);
}

// --- Patterns to detect ---
const PATTERNS = {
  sequential: /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|890)/i,
  repeated: /(.)\1{2,}/,
  keyboard: /(qwerty|asdf|zxcv|qazwsx|1qaz2wsx)/i,
  dates: /(19|20)\d{2}/,
};

// --- Calculate entropy ---
function calculateEntropy(password) {
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 33;

  return Math.log2(Math.pow(charsetSize, password.length));
}

// --- Analyze password ---
function analyze(password) {
  const result = {
    password: password,
    length: password.length,
    score: 0,
    maxScore: 100,
    level: '',
    color: '',
    entropy: 0,
    checks: [],
    suggestions: [],
  };

  // Length check
  if (password.length >= 16) {
    result.score += 25;
    result.checks.push({ pass: true, message: 'Long password (16+ chars)' });
  } else if (password.length >= 12) {
    result.score += 20;
    result.checks.push({ pass: true, message: 'Good length (12+ chars)' });
  } else if (password.length >= 8) {
    result.score += 10;
    result.checks.push({ pass: true, message: 'Minimum length (8+ chars)' });
  } else {
    result.checks.push({ pass: false, message: 'Too short (less than 8 chars)' });
    result.suggestions.push('Use at least 8 characters');
  }

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const charTypes = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  result.score += charTypes * 10;

  if (charTypes >= 4) {
    result.checks.push({ pass: true, message: 'Uses all character types' });
  } else if (charTypes >= 3) {
    result.checks.push({ pass: true, message: 'Uses 3 character types' });
  } else {
    result.checks.push({ pass: false, message: `Only uses ${charTypes} character type(s)` });
    if (!hasUpper) result.suggestions.push('Add uppercase letters');
    if (!hasLower) result.suggestions.push('Add lowercase letters');
    if (!hasDigit) result.suggestions.push('Add numbers');
    if (!hasSpecial) result.suggestions.push('Add special characters');
  }

  // Common password check
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    result.score = Math.max(0, result.score - 40);
    result.checks.push({ pass: false, message: 'Common password detected' });
    result.suggestions.push('Avoid common passwords');
  } else {
    result.score += 10;
    result.checks.push({ pass: true, message: 'Not a common password' });
  }

  // Pattern checks
  if (PATTERNS.sequential.test(password)) {
    result.score -= 10;
    result.checks.push({ pass: false, message: 'Contains sequential characters' });
    result.suggestions.push('Avoid sequential characters (abc, 123)');
  }

  if (PATTERNS.repeated.test(password)) {
    result.score -= 10;
    result.checks.push({ pass: false, message: 'Contains repeated characters' });
    result.suggestions.push('Avoid repeated characters (aaa, 111)');
  }

  if (PATTERNS.keyboard.test(password)) {
    result.score -= 15;
    result.checks.push({ pass: false, message: 'Contains keyboard pattern' });
    result.suggestions.push('Avoid keyboard patterns (qwerty)');
  }

  // Entropy
  result.entropy = calculateEntropy(password);
  if (result.entropy >= 60) {
    result.score += 10;
    result.checks.push({ pass: true, message: `High entropy (${result.entropy.toFixed(0)} bits)` });
  } else if (result.entropy >= 40) {
    result.checks.push({ pass: true, message: `Medium entropy (${result.entropy.toFixed(0)} bits)` });
  } else {
    result.checks.push({ pass: false, message: `Low entropy (${result.entropy.toFixed(0)} bits)` });
    result.suggestions.push('Increase password complexity');
  }

  // Unique characters ratio
  const uniqueChars = new Set(password).size;
  const uniqueRatio = uniqueChars / password.length;
  if (uniqueRatio >= 0.7) {
    result.score += 5;
    result.checks.push({ pass: true, message: 'Good character variety' });
  } else if (uniqueRatio < 0.5) {
    result.checks.push({ pass: false, message: 'Low character variety' });
    result.suggestions.push('Use more unique characters');
  }

  // Clamp score
  result.score = Math.max(0, Math.min(100, result.score));

  // Set level
  if (result.score >= 80) {
    result.level = 'Strong';
    result.color = C.green;
  } else if (result.score >= 60) {
    result.level = 'Good';
    result.color = C.blue;
  } else if (result.score >= 40) {
    result.level = 'Fair';
    result.color = C.yellow;
  } else if (result.score >= 20) {
    result.level = 'Weak';
    result.color = C.red;
  } else {
    result.level = 'Very Weak';
    result.color = C.red;
  }

  return result;
}

// --- Display ---
function display(result) {
  console.log();
  console.log(`  ${C.bold}Password Analysis${C.reset}`);
  console.log(`  ${'─'.repeat(40)}`);

  // Score bar
  const barWidth = 30;
  const filled = Math.round(result.score / 100 * barWidth);
  const bar = result.color + '█'.repeat(filled) + C.dim + '░'.repeat(barWidth - filled) + C.reset;
  console.log(`\n  ${bar} ${result.color}${result.score}/100${C.reset}`);
  console.log(`  ${C.bold}${result.color}${result.level}${C.reset}`);

  // Details
  console.log(`\n  ${C.dim}Length:${C.reset}   ${result.length} characters`);
  console.log(`  ${C.dim}Entropy:${C.reset}  ${result.entropy.toFixed(0)} bits`);

  // Checks
  console.log(`\n  ${C.bold}Checks:${C.reset}`);
  result.checks.forEach(check => {
    const icon = check.pass ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    console.log(`  ${icon} ${check.message}`);
  });

  // Suggestions
  if (result.suggestions.length > 0) {
    console.log(`\n  ${C.bold}Suggestions:${C.reset}`);
    result.suggestions.forEach(s => {
      console.log(`  ${C.yellow}→${C.reset} ${s}`);
    });
  }

  console.log();
}

// --- Read from stdin ---
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    return;
  }

  let password = args.find(a => !a.startsWith('-'));
  const jsonOutput = args.includes('--json');
  const silent = args.includes('--silent');

  if (!password) {
    password = await readStdin();
  }

  if (!password) {
    console.error('  Error: No password provided');
    process.exit(1);
  }

  const result = analyze(password);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else if (silent) {
    console.log(result.score);
  } else {
    display(result);
  }
}

main();
