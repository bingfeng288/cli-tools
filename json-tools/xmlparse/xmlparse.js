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
  \x1b[1mxmlparse\x1b[0m - XML parser and converter

  \x1b[1mUsage:\x1b[0m
    xmlparse <file>
    cat data.xml | xmlparse

  \x1b[1mOptions:\x1b[0m
    --indent <n>    JSON indentation (default: 2)
    --compact       Compact JSON output
    --attributes    Include XML attributes
    --text          Extract text content only
    -h, --help      Show this help

  \x1b[1mExamples:\x1b[0m
    xmlparse data.xml
    xmlparse data.xml --compact
    xmlparse data.xml --attributes
    cat data.xml | xmlparse
`);
}

// --- XML Parser ---
class XMLParser {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
  }

  parse() {
    this.skipWhitespace();
    if (this.peek() === '<' && this.peek(1) === '?') {
      this.parseDeclaration();
    }
    this.skipWhitespace();
    if (this.peek() === '<' && this.peek(1) === '!') {
      this.parseComment();
    }
    this.skipWhitespace();
    return this.parseElement();
  }

  parseDeclaration() {
    this.expect('<');
    this.expect('?');
    while (this.pos < this.input.length && !(this.peek() === '?' && this.peek(1) === '>')) {
      this.advance();
    }
    this.expect('?');
    this.expect('>');
    this.skipWhitespace();
  }

  parseComment() {
    if (this.peek() === '<' && this.peek(1) === '!' && this.peek(2) === '-' && this.peek(3) === '-') {
      this.advance(); // <
      this.advance(); // !
      this.advance(); // -
      this.advance(); // -
      while (this.pos < this.input.length && !(this.peek() === '-' && this.peek(1) === '-' && this.peek(2) === '>')) {
        this.advance();
      }
      this.advance(); // -
      this.advance(); // -
      this.advance(); // >
    }
    this.skipWhitespace();
  }

  parseElement() {
    this.expect('<');
    const name = this.parseName();
    const attributes = this.parseAttributes();
    this.skipWhitespace();

    if (this.peek() === '/' && this.peek(1) === '>') {
      this.advance();
      this.advance();
      return { name, attributes, children: [] };
    }

    this.expect('>');
    const children = this.parseContent();
    this.expect('<');
    this.expect('/');
    const closeName = this.parseName();
    if (closeName !== name) {
      this.error(`Expected closing tag </${name}>, got </${closeName}>`);
    }
    this.skipWhitespace();
    this.expect('>');

    return { name, attributes, children };
  }

  parseName() {
    let name = '';
    while (this.pos < this.input.length && /[a-zA-Z0-9_:\-.]/.test(this.peek())) {
      name += this.peek();
      this.advance();
    }
    return name;
  }

  parseAttributes() {
    const attributes = {};
    this.skipWhitespace();

    while (this.pos < this.input.length && this.peek() !== '>' && this.peek() !== '/') {
      const name = this.parseName();
      this.skipWhitespace();
      this.expect('=');
      this.skipWhitespace();
      const value = this.parseAttributeValue();
      attributes[name] = value;
      this.skipWhitespace();
    }

    return attributes;
  }

  parseAttributeValue() {
    const quote = this.peek();
    if (quote !== '"' && quote !== "'") {
      this.error('Expected quote');
    }
    this.advance();

    let value = '';
    while (this.pos < this.input.length && this.peek() !== quote) {
      value += this.peek();
      this.advance();
    }
    this.advance(); // closing quote
    return value;
  }

  parseContent() {
    const children = [];

    while (this.pos < this.input.length) {
      this.skipWhitespace();

      if (this.peek() === '<' && this.peek(1) === '/') {
        break;
      }

      if (this.peek() === '<' && this.peek(1) === '!' && this.peek(2) === '[' && this.peek(3) === 'C') {
        children.push(this.parseCDATA());
      } else if (this.peek() === '<' && this.peek(1) === '!' && this.peek(2) === '-' && this.peek(3) === '-') {
        this.parseComment();
      } else if (this.peek() === '<') {
        children.push(this.parseElement());
      } else {
        children.push(this.parseText());
      }
    }

    return children;
  }

  parseText() {
    let text = '';
    while (this.pos < this.input.length && this.peek() !== '<') {
      text += this.peek();
      this.advance();
    }
    return text.trim();
  }

  parseCDATA() {
    this.expect('<');
    this.expect('!');
    this.expect('[');
    this.expect('C');
    this.expect('D');
    this.expect('A');
    this.expect('T');
    this.expect('A');
    this.expect('[');

    let data = '';
    while (this.pos < this.input.length && !(this.peek() === ']' && this.peek(1) === ']' && this.peek(2) === '>')) {
      data += this.peek();
      this.advance();
    }
    this.expect(']');
    this.expect(']');
    this.expect('>');
    return data;
  }

  skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.peek())) {
      this.advance();
    }
  }

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

  error(msg) {
    throw new Error(`XML parse error at line ${this.line}, col ${this.col}: ${msg}`);
  }
}

// --- Convert to JSON ---
function toJson(element, options = {}) {
  const { attributes = true } = options;

  const result = {};

  if (attributes && Object.keys(element.attributes).length > 0) {
    result['@attributes'] = element.attributes;
  }

  const textChildren = element.children.filter(c => typeof c === 'string');
  const elementChildren = element.children.filter(c => typeof c === 'object');

  if (elementChildren.length === 0) {
    if (textChildren.length === 1) {
      if (attributes && Object.keys(element.attributes).length > 0) {
        result['#text'] = textChildren[0];
      } else {
        return textChildren[0];
      }
    } else if (textChildren.length > 1) {
      result['#text'] = textChildren.join('');
    }
  } else {
    // Group children by name
    const groups = {};
    for (const child of elementChildren) {
      if (!groups[child.name]) {
        groups[child.name] = [];
      }
      groups[child.name].push(child);
    }

    for (const [name, children] of Object.entries(groups)) {
      if (children.length === 1) {
        result[name] = toJson(children[0], options);
      } else {
        result[name] = children.map(c => toJson(c, options));
      }
    }

    if (textChildren.length > 0) {
      result['#text'] = textChildren.join('');
    }
  }

  return result;
}

// --- Extract text ---
function extractText(element) {
  const texts = [];

  for (const child of element.children) {
    if (typeof child === 'string') {
      if (child.trim()) texts.push(child.trim());
    } else {
      texts.push(extractText(child));
    }
  }

  return texts.join(' ');
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
  let attributes = true;
  let textOnly = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--indent') {
      indent = parseInt(args[++i]) || 2;
    } else if (arg === '--compact') {
      compact = true;
    } else if (arg === '--no-attributes') {
      attributes = false;
    } else if (arg === '--text') {
      textOnly = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, indent, compact, attributes, textOnly };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read XML
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

  // Parse XML
  try {
    const parser = new XMLParser(content);
    const result = parser.parse();

    if (opts.textOnly) {
      const text = extractText(result);
      console.log(text);
    } else {
      const json = toJson(result, { attributes: opts.attributes });
      const output = opts.compact ? JSON.stringify(json) : JSON.stringify(json, null, opts.indent);
      console.log(output);
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
