#!/usr/bin/env node

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
  \x1b[1mtomlparse\x1b[0m - TOML parser and converter

  \x1b[1mUsage:\x1b[0m
    tomlparse <file>
    cat config.toml | tomlparse

  \x1b[1mOptions:\x1b[0m
    --indent <n>    JSON indentation (default: 2)
    --compact       Compact JSON output
    --validate      Validate only (no output)
    -h, --help      Show this help

  \x1b[1mSupported TOML Features:\x1b[0m
    Key-value pairs       key = "value"
    Strings               "basic", 'literal', """multiline""", '''multiline'''
    Numbers               integers, floats, hex, octal, binary
    Booleans              true, false
    Dates/Times           2024-01-15, 12:30:00
    Arrays                [1, 2, 3]
    Tables                [table]
    Inline tables         {key = "value"}
    Arrays of tables      [[array.of.tables]]
    Dotted keys           a.b.c = "value"
    Comments              # comment

  \x1b[1mExamples:\x1b[0m
    tomlparse config.toml
    tomlparse config.toml --compact
    cat config.toml | tomlparse --indent 4
`);
}

// --- TOML Parser ---
class TOMLParser {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.result = {};
    this.currentTable = this.result;
    this.currentPath = [];
  }

  parse() {
    this.skipWhitespaceAndComments();

    while (this.pos < this.input.length) {
      if (this.peek() === '[') {
        this.parseTableHeader();
      } else if (this.isKeyStart()) {
        this.parseKeyValue();
      } else {
        this.error('Expected table header or key-value pair');
      }
      this.skipWhitespaceAndComments();
    }

    return this.result;
  }

  parseTableHeader() {
    this.expect('[');
    const isArray = this.peek() === '[';

    if (isArray) {
      this.expect('[');
    }

    const path = this.parseKeyPath();

    if (isArray) {
      this.expect(']');
    }
    this.expect(']');

    this.skipWhitespaceAndComments();

    // Navigate to the table
    this.currentPath = path;
    let target = this.result;

    for (let i = 0; i < path.length - 1; i++) {
      if (target[path[i]] === undefined) {
        target[path[i]] = {};
      } else if (Array.isArray(target[path[i]])) {
        // Navigate to the last element of the array
        target = target[path[i]][target[path[i]].length - 1];
        continue;
      } else if (typeof target[path[i]] !== 'object') {
        this.error(`Cannot create table at ${path.join('.')} - value already exists`);
      }
      target = target[path[i]];
    }

    const lastKey = path[path.length - 1];

    if (isArray) {
      // Array of tables
      if (target[lastKey] === undefined) {
        target[lastKey] = [];
      }
      if (!Array.isArray(target[lastKey])) {
        this.error(`Expected array at ${path.join('.')}`);
      }
      const newTable = {};
      target[lastKey].push(newTable);
      this.currentTable = newTable;
    } else {
      // Regular table
      if (target[lastKey] === undefined) {
        target[lastKey] = {};
      } else if (typeof target[lastKey] !== 'object' || Array.isArray(target[lastKey])) {
        this.error(`Cannot create table at ${path.join('.')} - value already exists`);
      }
      this.currentTable = target[lastKey];
    }
  }

  parseKeyValue() {
    const { key, target } = this.parseKey();
    this.skipWhitespace();
    this.expect('=');
    this.skipWhitespace();
    const value = this.parseValue();
    this.skipWhitespaceAndComments();

    // Set the value
    this.setValue(target, key, value);
  }

  parseKey() {
    const parts = this.parseKeyPath();
    if (parts.length === 1) return { key: parts[0], target: this.currentTable };

    // Dotted key - navigate to the correct table
    let target = this.currentTable;
    for (let i = 0; i < parts.length - 1; i++) {
      if (target[parts[i]] === undefined) {
        target[parts[i]] = {};
      } else if (typeof target[parts[i]] !== 'object' || Array.isArray(target[parts[i]])) {
        this.error(`Cannot set dotted key - ${parts[i]} is not a table`);
      }
      target = target[parts[i]];
    }

    return { key: parts[parts.length - 1], target };
  }

  parseKeyPath() {
    const parts = [];

    while (true) {
      let key;
      if (this.peek() === '"' || this.peek() === "'") {
        key = this.parseString();
      } else {
        key = this.parseBareKey();
      }
      parts.push(key);

      this.skipWhitespace();
      if (this.peek() === '.') {
        this.advance();
        this.skipWhitespace();
      } else {
        break;
      }
    }

    return parts;
  }

  parseBareKey() {
    const start = this.pos;
    while (this.pos < this.input.length && /[A-Za-z0-9_-]/.test(this.input[this.pos])) {
      this.advance();
    }
    if (this.pos === start) {
      this.error('Expected bare key');
    }
    return this.input.slice(start, this.pos);
  }

  parseValue() {
    const ch = this.peek();

    if (ch === '"' || ch === "'") {
      return this.parseString();
    } else if (ch === '[') {
      return this.parseArray();
    } else if (ch === '{') {
      return this.parseInlineTable();
    } else if (ch === 't' || ch === 'f') {
      return this.parseBoolean();
    } else if (ch === '-' || ch === '+' || /[0-9]/.test(ch)) {
      return this.parseNumber();
    } else {
      this.error('Expected value');
    }
  }

  parseString() {
    const quote = this.peek();

    if (quote === '"') {
      return this.parseBasicString();
    } else {
      return this.parseLiteralString();
    }
  }

  parseBasicString() {
    this.expect('"');

    // Check for multiline
    if (this.peek() === '"' && this.peek(1) === '"') {
      this.advance();
      this.advance();
      return this.parseMultilineBasicString();
    }

    let result = '';
    while (this.pos < this.input.length && this.peek() !== '"') {
      if (this.peek() === '\\') {
        result += this.parseEscape();
      } else {
        result += this.peek();
        this.advance();
      }
    }
    this.expect('"');
    return result;
  }

  parseLiteralString() {
    this.expect("'");

    // Check for multiline
    if (this.peek() === "'" && this.peek(1) === "'") {
      this.advance();
      this.advance();
      return this.parseMultilineLiteralString();
    }

    let result = '';
    while (this.pos < this.input.length) {
      // Handle escaped single quote ('')
      if (this.peek() === "'" && this.peek(1) === "'") {
        result += "'";
        this.advance();
        this.advance();
      } else if (this.peek() === "'") {
        // End of string
        break;
      } else {
        result += this.peek();
        this.advance();
      }
    }
    this.expect("'");
    return result;
  }

  parseMultilineBasicString() {
    let result = '';

    // Skip initial newline
    if (this.peek() === '\n') {
      this.advance();
    } else if (this.peek() === '\r' && this.peek(1) === '\n') {
      this.advance();
      this.advance();
    }

    while (this.pos < this.input.length) {
      if (this.peek() === '"' && this.peek(1) === '"' && this.peek(2) === '"') {
        this.advance();
        this.advance();
        this.advance();
        return result;
      }
      if (this.peek() === '\\') {
        result += this.parseEscape();
      } else {
        result += this.peek();
        this.advance();
      }
    }
    this.error('Unterminated multiline string');
  }

  parseMultilineLiteralString() {
    let result = '';

    // Skip initial newline
    if (this.peek() === '\n') {
      this.advance();
    } else if (this.peek() === '\r' && this.peek(1) === '\n') {
      this.advance();
      this.advance();
    }

    while (this.pos < this.input.length) {
      if (this.peek() === "'" && this.peek(1) === "'" && this.peek(2) === "'") {
        this.advance();
        this.advance();
        this.advance();
        return result;
      }
      result += this.peek();
      this.advance();
    }
    this.error('Unterminated multiline string');
  }

  parseEscape() {
    this.expect('\\');
    const ch = this.peek();
    this.advance();

    switch (ch) {
      case 'b': return '\b';
      case 'f': return '\f';
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case '"': return '"';
      case '\\': return '\\';
      case 'u': return this.parseUnicodeEscape(4);
      case 'U': return this.parseUnicodeEscape(8);
      default: this.error(`Invalid escape sequence: \\${ch}`);
    }
  }

  parseUnicodeEscape(length) {
    let hex = '';
    for (let i = 0; i < length; i++) {
      if (!/[0-9a-fA-F]/.test(this.peek())) {
        this.error('Invalid unicode escape');
      }
      hex += this.peek();
      this.advance();
    }
    return String.fromCodePoint(parseInt(hex, 16));
  }

  parseArray() {
    this.expect('[');
    const arr = [];
    this.skipWhitespaceAndComments();

    while (this.peek() !== ']') {
      arr.push(this.parseValue());
      this.skipWhitespaceAndComments();
      if (this.peek() === ',') {
        this.advance();
        this.skipWhitespaceAndComments();
      }
    }

    this.expect(']');
    return arr;
  }

  parseInlineTable() {
    this.expect('{');
    const obj = {};
    this.skipWhitespace();

    while (this.peek() !== '}') {
      const key = this.parseKeyPath().join('.');
      this.skipWhitespace();
      this.expect('=');
      this.skipWhitespace();
      const value = this.parseValue();
      obj[key] = value;
      this.skipWhitespace();
      if (this.peek() === ',') {
        this.advance();
        this.skipWhitespace();
      }
    }

    this.expect('}');
    return obj;
  }

  parseBoolean() {
    if (this.input.slice(this.pos, this.pos + 4) === 'true') {
      this.pos += 4;
      this.col += 4;
      return true;
    } else if (this.input.slice(this.pos, this.pos + 5) === 'false') {
      this.pos += 5;
      this.col += 5;
      return false;
    } else {
      this.error('Expected boolean');
    }
  }

  parseNumber() {
    const start = this.pos;
    let hasDecimal = false;
    let hasExponent = false;

    // Sign
    if (this.peek() === '-' || this.peek() === '+') {
      this.advance();
    }

    // Check for special formats
    if (this.peek() === '0') {
      const next = this.peek(1);
      if (next === 'x' || next === 'X') {
        return this.parseHexNumber();
      } else if (next === 'o' || next === 'O') {
        return this.parseOctalNumber();
      } else if (next === 'b' || next === 'B') {
        return this.parseBinaryNumber();
      }
    }

    // Check for date-time (YYYY-MM-DD)
    const dateStart = this.pos;
    if (this.parseDateIfPossible()) {
      return this.input.slice(start, this.pos);
    }
    this.pos = dateStart;

    // Integer or float
    while (this.pos < this.input.length && /[0-9_]/.test(this.peek())) {
      this.advance();
    }

    // Decimal
    if (this.peek() === '.' && /[0-9]/.test(this.peek(1))) {
      hasDecimal = true;
      this.advance();
      while (this.pos < this.input.length && /[0-9_]/.test(this.peek())) {
        this.advance();
      }
    }

    // Exponent
    if (this.peek() === 'e' || this.peek() === 'E') {
      hasExponent = true;
      this.advance();
      if (this.peek() === '+' || this.peek() === '-') {
        this.advance();
      }
      while (this.pos < this.input.length && /[0-9_]/.test(this.peek())) {
        this.advance();
      }
    }

    // Special float values
    if (this.input.slice(this.pos, this.pos + 3) === 'inf') {
      this.pos += 3;
      this.col += 3;
      return this.input[start] === '-' ? -Infinity : Infinity;
    }
    if (this.input.slice(this.pos, this.pos + 3) === 'nan') {
      this.pos += 3;
      this.col += 3;
      return NaN;
    }

    const str = this.input.slice(start, this.pos).replace(/_/g, '');
    return hasDecimal || hasExponent ? parseFloat(str) : parseInt(str, 10);
  }

  parseHexNumber() {
    this.advance(); // 0
    this.advance(); // x
    const start = this.pos;
    while (this.pos < this.input.length && /[0-9a-fA-F_]/.test(this.peek())) {
      this.advance();
    }
    return parseInt(this.input.slice(start, this.pos).replace(/_/g, ''), 16);
  }

  parseOctalNumber() {
    this.advance(); // 0
    this.advance(); // o
    const start = this.pos;
    while (this.pos < this.input.length && /[0-7_]/.test(this.peek())) {
      this.advance();
    }
    return parseInt(this.input.slice(start, this.pos).replace(/_/g, ''), 8);
  }

  parseBinaryNumber() {
    this.advance(); // 0
    this.advance(); // b
    const start = this.pos;
    while (this.pos < this.input.length && /[01_]/.test(this.peek())) {
      this.advance();
    }
    return parseInt(this.input.slice(start, this.pos).replace(/_/g, ''), 2);
  }

  parseDateIfPossible() {
    const savedPos = this.pos;
    const savedLine = this.line;
    const savedCol = this.col;

    // Try to parse YYYY-MM-DD
    if (!this.parseDigits(4)) return false;
    if (this.peek() !== '-') { this.resetTo(savedPos, savedLine, savedCol); return false; }
    this.advance();
    if (!this.parseDigits(2)) { this.resetTo(savedPos, savedLine, savedCol); return false; }
    if (this.peek() !== '-') { this.resetTo(savedPos, savedLine, savedCol); return false; }
    this.advance();
    if (!this.parseDigits(2)) { this.resetTo(savedPos, savedLine, savedCol); return false; }

    // Check for time (T or space)
    if (this.peek() === 'T' || this.peek() === ' ') {
      if (this.peek() === 'T') {
        this.advance();
      } else if (this.peek() === ' ') {
        // Only allow space if followed by time pattern
        if (!/[0-9]/.test(this.peek(1))) {
          this.resetTo(savedPos, savedLine, savedCol);
          return false;
        }
        this.advance();
      }

      // Parse HH:MM:SS
      if (!this.parseDigits(2)) { this.resetTo(savedPos, savedLine, savedCol); return false; }
      if (this.peek() !== ':') { this.resetTo(savedPos, savedLine, savedCol); return false; }
      this.advance();
      if (!this.parseDigits(2)) { this.resetTo(savedPos, savedLine, savedCol); return false; }
      if (this.peek() !== ':') { this.resetTo(savedPos, savedLine, savedCol); return false; }
      this.advance();
      if (!this.parseDigits(2)) { this.resetTo(savedPos, savedLine, savedCol); return false; }

      // Optional fractional seconds
      if (this.peek() === '.') {
        this.advance();
        if (!this.parseDigits(1)) { this.resetTo(savedPos, savedLine, savedCol); return false; }
        while (/[0-9]/.test(this.peek())) {
          this.advance();
        }
      }

      // Optional timezone
      if (this.peek() === 'Z') {
        this.advance();
      } else if (this.peek() === '+' || this.peek() === '-') {
        this.advance();
        if (!this.parseDigits(2)) { this.resetTo(savedPos, savedLine, savedCol); return false; }
        if (this.peek() === ':') {
          this.advance();
          if (!this.parseDigits(2)) { this.resetTo(savedPos, savedLine, savedCol); return false; }
        }
      }
    }

    return true;
  }

  parseDigits(count) {
    for (let i = 0; i < count; i++) {
      if (!/[0-9]/.test(this.peek())) return false;
      this.advance();
    }
    return true;
  }

  resetTo(pos, line, col) {
    this.pos = pos;
    this.line = line;
    this.col = col;
  }

  // Helper methods
  peek(offset = 0) {
    return this.input[this.pos + offset];
  }

  advance() {
    if (this.input[this.pos] === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    this.pos++;
  }

  expect(ch) {
    if (this.peek() !== ch) {
      this.error(`Expected '${ch}'`);
    }
    this.advance();
  }

  skipWhitespace() {
    while (this.pos < this.input.length && (this.peek() === ' ' || this.peek() === '\t')) {
      this.advance();
    }
  }

  skipWhitespaceAndComments() {
    while (this.pos < this.input.length) {
      if (this.peek() === ' ' || this.peek() === '\t' || this.peek() === '\r') {
        this.advance();
      } else if (this.peek() === '\n') {
        this.advance();
      } else if (this.peek() === '#') {
        // Comment
        while (this.pos < this.input.length && this.peek() !== '\n') {
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  isKeyStart() {
    const ch = this.peek();
    return ch && (/[A-Za-z0-9_-]/.test(ch) || ch === '"' || ch === "'");
  }

  setValue(obj, key, value) {
    if (key in obj && typeof obj[key] === 'object' && !Array.isArray(obj[key]) && typeof value === 'object' && !Array.isArray(value)) {
      this.error(`Duplicate key: ${key}`);
    }
    obj[key] = value;
  }

  error(msg) {
    throw new Error(`TOML parse error at line ${this.line}, col ${this.col}: ${msg}`);
  }
}

// --- Format JSON ---
function formatJSON(obj, indent) {
  return JSON.stringify(obj, null, indent);
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let file = null;
  let indent = 2;
  let compact = false;
  let validate = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--indent') {
      indent = parseInt(args[++i]) || 2;
    } else if (arg === '--compact') {
      compact = true;
    } else if (arg === '--validate') {
      validate = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, indent, compact, validate };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read TOML
  let content;
  if (opts.file) {
    try {
      content = readFileSync(opts.file, 'utf-8');
    } catch (err) {
      console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
      process.exit(1);
    }
  } else if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    content = Buffer.concat(chunks).toString('utf-8');
  } else {
    showHelp();
    process.exit(1);
  }

  // Parse TOML
  try {
    const parser = new TOMLParser(content);
    const result = parser.parse();

    if (opts.validate) {
      console.log(`  ${C.green}Valid TOML${C.reset}`);
      process.exit(0);
    }

    const json = opts.compact ? JSON.stringify(result) : formatJSON(result, opts.indent);
    console.log(json);
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
