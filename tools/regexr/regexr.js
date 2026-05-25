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
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
};

const GROUP_COLORS = [
  `${C.bgGreen}${C.bold}`,
  `${C.bgBlue}${C.bold}`,
  `${C.bgMagenta}${C.bold}`,
  `${C.bgYellow}${C.bold}`,
  `${C.bgCyan}${C.bold}`,
];

// --- Help ---
function showHelp() {
  console.log(`
  ${C.bold}regexr${C.reset} - Regex testing and exploration CLI

  ${C.bold}Usage:${C.reset}
    regexr <pattern> [test_string...] [options]
    echo "test string" | regexr <pattern>

  ${C.bold}Options:${C.reset}
    -f, --flags <flags>       Regex flags (default: g)
    -r, --replace <str>       Show replacement preview
    -e, --explain             Explain the regex pattern
    -l, --library             Show common regex patterns
    -c, --count               Show match count only
    -n, --no-color            Disable colors
    -h, --help                Show this help

  ${C.bold}Flags:${C.reset}
    g - Global (find all matches)
    i - Case insensitive
    m - Multiline (^ and $ match line boundaries)
    s - Dotall (. matches newlines)
    u - Unicode

  ${C.bold}Examples:${C.reset}
    regexr '\\d+' 'abc 123 def 456'
    regexr '([a-z]+)@([a-z]+)\\.com' 'test@example.com foo@bar.com'
    regexr -f i 'hello' 'Hello World'
    regexr -r 'REDACTED' '\\d{3}-\\d{4}' 'Call 555-1234 or 555-5678'
    regexr -e '(?:https?://)?(?:www\\.)?[\\w.-]+\\.[a-z]{2,}'
    echo 'hello world' | regexr '\\w+'
`);
}

// --- Explain pattern ---
function explainPattern(pattern) {
  console.log(`\n  ${C.bold}Pattern Explanation:${C.reset}\n`);
  console.log(`  ${C.cyan}${pattern}${C.reset}\n`);

  const tokens = [];
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === '\\' && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      const escapes = {
        'd': 'digit [0-9]',
        'D': 'non-digit [^0-9]',
        'w': 'word character [a-zA-Z0-9_]',
        'W': 'non-word character',
        's': 'whitespace [ \\t\\n\\r]',
        'S': 'non-whitespace',
        'b': 'word boundary',
        'B': 'non-word boundary',
        'n': 'newline',
        't': 'tab',
        'r': 'carriage return',
      };
      if (escapes[next]) {
        tokens.push({ token: `\\${next}`, desc: escapes[next] });
      } else {
        tokens.push({ token: `\\${next}`, desc: `literal '${next}'` });
      }
      i += 2;
    } else if (ch === '[') {
      let end = pattern.indexOf(']', i + 1);
      if (end === -1) end = pattern.length;
      const group = pattern.slice(i, end + 1);
      const negated = group[1] === '^';
      tokens.push({ token: group, desc: `character class${negated ? ' (negated)' : ''}` });
      i = end + 1;
    } else if (ch === '(') {
      if (pattern.slice(i, i + 3) === '(?:') {
        tokens.push({ token: '(?:', desc: 'non-capturing group start' });
        i += 3;
      } else if (pattern.slice(i, i + 4) === '(?<=') {
        tokens.push({ token: '(?<=', desc: 'lookbehind assertion' });
        i += 4;
      } else if (pattern.slice(i, i + 4) === '(?=!') {
        tokens.push({ token: '(?=!', desc: 'negative lookahead' });
        i += 4;
      } else if (pattern.slice(i, i + 3) === '(?=') {
        tokens.push({ token: '(?=', desc: 'lookahead assertion' });
        i += 3;
      } else {
        tokens.push({ token: '(', desc: 'capturing group start' });
        i++;
      }
    } else if (ch === ')') {
      tokens.push({ token: ')', desc: 'group end' });
      i++;
    } else if (ch === '{') {
      let end = pattern.indexOf('}', i + 1);
      if (end === -1) { tokens.push({ token: '{', desc: 'literal' }); i++; continue; }
      const quant = pattern.slice(i, end + 1);
      const parts = quant.slice(1, -1).split(',');
      let desc;
      if (parts.length === 1) desc = `exactly ${parts[0]} times`;
      else if (parts[1] === '') desc = `${parts[0]} or more times`;
      else desc = `between ${parts[0]} and ${parts[1]} times`;
      tokens.push({ token: quant, desc });
      i = end + 1;
    } else if (ch === '*') {
      tokens.push({ token: '*', desc: 'zero or more (greedy)' });
      i++;
    } else if (ch === '+') {
      tokens.push({ token: '+', desc: 'one or more (greedy)' });
      i++;
    } else if (ch === '?') {
      if (pattern[i + 1] === '?') {
        tokens.push({ token: '??', desc: 'zero or one (lazy)' });
        i += 2;
      } else if (pattern[i + 1] === '+') {
        tokens.push({ token: '?+', desc: 'one or more (possessive)' });
        i += 2;
      } else if (pattern[i + 1] === '*') {
        tokens.push({ token: '?*', desc: 'zero or more (possessive)' });
        i += 2;
      } else {
        tokens.push({ token: '?', desc: 'zero or one' });
        i++;
      }
    } else if (ch === '.') {
      tokens.push({ token: '.', desc: 'any character (except newline)' });
      i++;
    } else if (ch === '^') {
      tokens.push({ token: '^', desc: 'start of string/line' });
      i++;
    } else if (ch === '$') {
      tokens.push({ token: '$', desc: 'end of string/line' });
      i++;
    } else if (ch === '|') {
      tokens.push({ token: '|', desc: 'alternation (OR)' });
      i++;
    } else {
      tokens.push({ token: ch, desc: `literal '${ch}'` });
      i++;
    }
  }

  // Find max token width
  const maxW = Math.max(...tokens.map(t => t.token.length));
  tokens.forEach(t => {
    console.log(`  ${C.green}${t.token.padEnd(maxW)}${C.reset}  ${C.dim}${t.desc}${C.reset}`);
  });
  console.log();
}

// --- Common patterns ---
function showLibrary() {
  console.log(`\n  ${C.bold}Common Regex Patterns:${C.reset}\n`);
  const patterns = [
    { name: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' },
    { name: 'URL', pattern: 'https?://[\\w.-]+(?:/[\\w./-]*)?' },
    { name: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b' },
    { name: 'Date (YYYY-MM-DD)', pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])' },
    { name: 'Time (HH:MM)', pattern: '(?:[01]\\d|2[0-3]):[0-5]\\d' },
    { name: 'Hex Color', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b' },
    { name: 'Phone (US)', pattern: '(?:\\+1[-.\\s]?)?(?:\\(?\\d{3}\\)?[-.\\s]?)?\\d{3}[-.\\s]?\\d{4}' },
    { name: 'Integer', pattern: '-?\\d+' },
    { name: 'Float', pattern: '-?\\d+\\.\\d+' },
    { name: 'Word', pattern: '\\b\\w+\\b' },
    { name: 'Whitespace', pattern: '\\s+' },
    { name: 'HTML Tag', pattern: '</?[a-zA-Z][a-zA-Z0-9]*(?:\\s[^>]*)?/?>' },
    { name: 'Quoted String', pattern: '"[^"]*"|\'[^\']*\'' },
    { name: 'UUID', pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' },
  ];

  const maxName = Math.max(...patterns.map(p => p.name.length));
  patterns.forEach(p => {
    console.log(`  ${C.green}${p.name.padEnd(maxName)}${C.reset}  ${C.cyan}${p.pattern}${C.reset}`);
  });
  console.log();
}

// --- Match and display ---
function findMatches(pattern, text, flags) {
  const regex = new RegExp(pattern, flags);
  const matches = [];
  let match;

  if (flags.includes('g')) {
    while ((match = regex.exec(text)) !== null) {
      matches.push({ index: match.index, length: match[0].length, groups: [...match] });
      if (match[0].length === 0) regex.lastIndex++;
    }
  } else {
    match = regex.exec(text);
    if (match) matches.push({ index: match.index, length: match[0].length, groups: [...match] });
  }

  return matches;
}

function highlightMatches(text, matches) {
  if (matches.length === 0) return `${C.dim}${text}${C.reset}`;

  let result = '';
  let lastEnd = 0;

  matches.forEach((m, i) => {
    // Text before match
    result += `${C.dim}${text.slice(lastEnd, m.index)}${C.reset}`;
    // The match itself
    const color = GROUP_COLORS[i % GROUP_COLORS.length];
    result += `${color}${text.slice(m.index, m.index + m.length)}${C.reset}`;
    lastEnd = m.index + m.length;
  });

  result += `${C.dim}${text.slice(lastEnd)}${C.reset}`;
  return result;
}

function displayMatches(text, matches, pattern, flags) {
  console.log();
  console.log(`  ${C.dim}╭─ Input ───────────────────────────────────${C.reset}`);
  console.log(`  ${C.dim}│${C.reset} ${highlightMatches(text, matches)}`);
  console.log(`  ${C.dim}╰──────────────────────────────────────────${C.reset}`);

  if (matches.length === 0) {
    console.log(`\n  ${C.yellow}No matches found${C.reset}\n`);
    return;
  }

  console.log(`\n  ${C.green}${C.bold}${matches.length}${C.reset} ${C.green}match${matches.length > 1 ? 'es' : ''}${C.reset}\n`);

  matches.forEach((m, i) => {
    const color = GROUP_COLORS[i % GROUP_COLORS.length];
    console.log(`  ${C.dim}[${i + 1}]${C.reset} ${color}${m.groups[0]}${C.reset} ${C.dim}(index ${m.index}, length ${m.length})${C.reset}`);

    // Show capture groups
    if (m.groups.length > 1) {
      for (let g = 1; g < m.groups.length; g++) {
        const groupColor = GROUP_COLORS[g % GROUP_COLORS.length];
        console.log(`      ${C.dim}Group ${g}:${C.reset} ${groupColor}${m.groups[g] || '(empty)'}${C.reset}`);
      }
    }
  });
  console.log();
}

function displayReplacement(text, matches, replacement, pattern, flags) {
  const regex = new RegExp(pattern, flags);
  const result = text.replace(regex, replacement);

  console.log(`  ${C.dim}╭─ Replacement ─────────────────────────────${C.reset}`);
  console.log(`  ${C.dim}│${C.reset} ${result}`);
  console.log(`  ${C.dim}╰──────────────────────────────────────────${C.reset}`);
  console.log();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  if (args[0] === '-l' || args[0] === '--library') {
    showLibrary();
    process.exit(0);
  }

  let pattern = null;
  let flags = 'g';
  let replacement = null;
  let explain = false;
  let countOnly = false;
  let noColor = false;
  const testStrings = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-f' || arg === '--flags') {
      flags = args[++i] || 'g';
    } else if (arg === '-r' || arg === '--replace') {
      replacement = args[++i];
    } else if (arg === '-e' || arg === '--explain') {
      explain = true;
    } else if (arg === '-c' || arg === '--count') {
      countOnly = true;
    } else if (arg === '-n' || arg === '--no-color') {
      noColor = true;
    } else if (!pattern) {
      pattern = arg;
    } else {
      testStrings.push(arg);
    }
  }

  if (!pattern) {
    console.error('  Error: No pattern provided');
    process.exit(1);
  }

  return { pattern, flags, replacement, explain, countOnly, noColor, testStrings };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Disable colors if requested
  if (opts.noColor) {
    Object.keys(C).forEach(k => C[k] = '');
  }

  // Explain mode
  if (opts.explain) {
    explainPattern(opts.pattern);
    return;
  }

  // Get test strings from stdin or args
  let testStrings = opts.testStrings;
  if (testStrings.length === 0) {
    // Read from stdin
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString('utf-8').trim();
    if (input) {
      testStrings = input.split('\n');
    } else {
      console.error('  Error: No test string provided (pass as argument or via stdin)');
      process.exit(1);
    }
  }

  // Process each test string
  testStrings.forEach((text, idx) => {
    if (testStrings.length > 1) {
      console.log(`\n  ${C.bold}Test ${idx + 1}:${C.reset} "${text}"`);
    }

    const matches = findMatches(opts.pattern, text, opts.flags);

    if (opts.countOnly) {
      console.log(`  ${matches.length} match${matches.length !== 1 ? 'es' : ''}`);
    } else {
      displayMatches(text, matches, opts.pattern, opts.flags);

      if (opts.replacement !== null) {
        displayReplacement(text, matches, opts.replacement, opts.pattern, opts.flags);
      }
    }
  });
}

main();
