#!/usr/bin/env node

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mstrutil\x1b[0m - String utilities CLI

  \x1b[1mUsage:\x1b[0m
    strutil <command> <input>
    echo "text" | strutil <command>

  \x1b[1mCase Conversion:\x1b[0m
    camel <text>           camelCase
    snake <text>           snake_case
    kebab <text>           kebab-case
    pascal <text>          PascalCase
    upper <text>           UPPER_CASE
    lower <text>           lowercase
    title <text>           Title Case
    sentence <text>        Sentence case

  \x1b[1mString Operations:\x1b[0m
    reverse <text>         Reverse string
    repeat <n> <text>      Repeat string n times
    truncate <len> <text>  Truncate with ellipsis
    pad <len> <text>       Pad to length
    trim <text>            Trim whitespace
    strip <chars> <text>   Strip specific characters
    replace <old> <new> <text>  Replace substring
    count <text>           Count words/chars/lines

  \x1b[1mEncoding:\x1b[0m
    base64 <text>          Encode to base64
    unbase64 <text>        Decode from base64
    url <text>             URL encode
    unurl <text>           URL decode
    html <text>            HTML escape
    unhtml <text>          HTML unescape
    hex <text>             Convert to hex
    unhex <text>           Convert from hex
    rot13 <text>           ROT13 encoding

  \x1b[1mOptions:\x1b[0m
    -h, --help             Show this help

  \x1b[1mExamples:\x1b[0m
    strutil camel "hello world"
    strutil snake "helloWorld"
    strutil kebab "Hello World"
    strutil reverse "hello"
    strutil base64 "hello world"
    strutil count "hello world"
    echo "test" | strutil upper
`);
}

// --- Case conversion ---
function toWords(text) {
  return text
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function toCamel(text) {
  const words = toWords(text);
  return words.map((w, i) => i === 0 ? w : w[0].toUpperCase() + w.slice(1)).join('');
}

function toSnake(text) {
  return toWords(text).join('_');
}

function toKebab(text) {
  return toWords(text).join('-');
}

function toPascal(text) {
  return toWords(text).map(w => w[0].toUpperCase() + w.slice(1)).join('');
}

function toUpper(text) {
  return toWords(text).join('_').toUpperCase();
}

function toTitle(text) {
  return toWords(text).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function toSentence(text) {
  const words = toWords(text);
  if (words.length === 0) return '';
  return words[0][0].toUpperCase() + words[0].slice(1) + ' ' + words.slice(1).join(' ');
}

// --- String operations ---
function reverse(text) {
  return [...text].reverse().join('');
}

function repeat(n, text) {
  return text.repeat(n);
}

function truncate(len, text) {
  if (text.length <= len) return text;
  return text.slice(0, len - 3) + '...';
}

function pad(len, text) {
  return text.padEnd(len);
}

function trim(text) {
  return text.trim();
}

function strip(chars, text) {
  const regex = new RegExp(`[${chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g');
  return text.replace(regex, '');
}

function replace(old, newText, text) {
  return text.split(old).join(newText);
}

function count(text) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text.split('\n').length;
  return { chars, words, lines };
}

// --- Encoding ---
function base64Encode(text) {
  return Buffer.from(text, 'utf-8').toString('base64');
}

function base64Decode(text) {
  return Buffer.from(text, 'base64').toString('utf-8');
}

function urlEncode(text) {
  return encodeURIComponent(text);
}

function urlDecode(text) {
  return decodeURIComponent(text);
}

function htmlEscape(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlUnescape(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function toHex(text) {
  return Buffer.from(text, 'utf-8').toString('hex');
}

function fromHex(text) {
  return Buffer.from(text, 'hex').toString('utf-8');
}

function rot13(text) {
  return text.replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
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

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    return;
  }

  const command = args[0].toLowerCase();
  let input = args.slice(1).join(' ');

  // Read from stdin if no input
  if (!input) {
    input = await readStdin();
  }

  if (!input && !['help'].includes(command)) {
    console.error('  Error: No input provided');
    process.exit(1);
  }

  let result;

  switch (command) {
    // Case conversion
    case 'camel': result = toCamel(input); break;
    case 'snake': result = toSnake(input); break;
    case 'kebab': result = toKebab(input); break;
    case 'pascal': result = toPascal(input); break;
    case 'upper': result = toUpper(input); break;
    case 'lower': result = input.toLowerCase(); break;
    case 'title': result = toTitle(input); break;
    case 'sentence': result = toSentence(input); break;

    // String operations
    case 'reverse': result = reverse(input); break;
    case 'repeat':
      if (args.length < 3) { console.error('  Usage: strutil repeat <n> <text>'); process.exit(1); }
      result = repeat(parseInt(args[1]), args.slice(2).join(' '));
      break;
    case 'truncate':
      if (args.length < 3) { console.error('  Usage: strutil truncate <len> <text>'); process.exit(1); }
      result = truncate(parseInt(args[1]), args.slice(2).join(' '));
      break;
    case 'pad':
      if (args.length < 3) { console.error('  Usage: strutil pad <len> <text>'); process.exit(1); }
      result = pad(parseInt(args[1]), args.slice(2).join(' '));
      break;
    case 'trim': result = trim(input); break;
    case 'strip':
      if (args.length < 3) { console.error('  Usage: strutil strip <chars> <text>'); process.exit(1); }
      result = strip(args[1], args.slice(2).join(' '));
      break;
    case 'replace':
      if (args.length < 4) { console.error('  Usage: strutil replace <old> <new> <text>'); process.exit(1); }
      result = replace(args[1], args[2], args.slice(3).join(' '));
      break;
    case 'count': {
      const c = count(input);
      console.log(`\n  Words:   ${c.words}`);
      console.log(`  Chars:   ${c.chars}`);
      console.log(`  Lines:   ${c.lines}\n`);
      return;
    }

    // Encoding
    case 'base64': result = base64Encode(input); break;
    case 'unbase64': result = base64Decode(input); break;
    case 'url': result = urlEncode(input); break;
    case 'unurl': result = urlDecode(input); break;
    case 'html': result = htmlEscape(input); break;
    case 'unhtml': result = htmlUnescape(input); break;
    case 'hex': result = toHex(input); break;
    case 'unhex': result = fromHex(input); break;
    case 'rot13': result = rot13(input); break;

    default:
      console.error(`  Error: Unknown command: ${command}`);
      process.exit(1);
  }

  console.log(`\n  ${result}\n`);
}

main();
