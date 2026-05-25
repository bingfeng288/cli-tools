#!/usr/bin/env node

import { readFileSync } from 'node:fs';

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
  \x1b[1mmdanchor\x1b[0m - Markdown anchor link generator

  \x1b[1mUsage:\x1b[0m
    mdanchor <file> [options]

  \x1b[1mOptions:\x1b[0m
    --toc             Generate table of contents
    --check           Check for broken anchor links
    --anchors         List all anchors
    --link <heading>  Generate link for specific heading
    --format <fmt>    Output format: markdown, html (default: markdown)
    -h, --help        Show this help

  \x1b[1mExamples:\x1b[0m
    mdanchor README.md
    mdanchor README.md --toc
    mdanchor README.md --check
    mdanchor README.md --anchors
    mdanchor README.md --link "Getting Started"
`);
}

// --- Generate anchor from heading ---
function generateAnchor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// --- Extract headings ---
function extractHeadings(content) {
  const lines = content.split('\n');
  const headings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ATX headings
    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (atxMatch) {
      headings.push({
        level: atxMatch[1].length,
        text: atxMatch[2].trim(),
        anchor: generateAnchor(atxMatch[2].trim()),
        line: i + 1,
      });
      continue;
    }

    // Setext headings
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (/^[=-]+$/.test(nextLine.trim()) && line.trim()) {
        headings.push({
          level: nextLine.startsWith('=') ? 1 : 2,
          text: line.trim(),
          anchor: generateAnchor(line.trim()),
          line: i + 1,
        });
      }
    }
  }

  return headings;
}

// --- Generate TOC ---
function generateToc(headings, format = 'markdown') {
  const lines = [];

  if (format === 'html') {
    lines.push('<nav class="toc">');
    lines.push('<h2>Table of Contents</h2>');
    lines.push('<ul>');

    headings.forEach(h => {
      const indent = '  '.repeat(h.level);
      lines.push(`${indent}<li><a href="#${h.anchor}">${h.text}</a></li>`);
    });

    lines.push('</ul>');
    lines.push('</nav>');
  } else {
    headings.forEach(h => {
      const indent = '  '.repeat(h.level - 1);
      lines.push(`${indent}- [${h.text}](#${h.anchor})`);
    });
  }

  return lines.join('\n');
}

// --- Check for broken links ---
function checkLinks(content, headings) {
  const anchors = new Set(headings.map(h => h.anchor));
  const lines = content.split('\n');
  const broken = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const linkRegex = /\[([^\]]*)\]\(#([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(line)) !== null) {
      const anchor = match[2];
      if (!anchors.has(anchor)) {
        broken.push({
          line: i + 1,
          text: match[1],
          anchor: anchor,
        });
      }
    }
  }

  return broken;
}

// --- Display ---
function displayHeadings(headings) {
  console.log(`\n  ${C.bold}Headings${C.reset}\n`);

  headings.forEach(h => {
    const indent = '  '.repeat(h.level - 1);
    const level = `${C.dim}H${h.level}${C.reset}`;
    const anchor = `${C.cyan}#${h.anchor}${C.reset}`;
    console.log(`  ${indent}${level} ${h.text} ${anchor}`);
  });

  console.log();
}

function displayToc(toc) {
  console.log(`\n  ${C.bold}Table of Contents${C.reset}\n`);
  console.log(toc);
  console.log();
}

function displayBrokenLinks(broken) {
  if (broken.length === 0) {
    console.log(`\n  ${C.green}✓${C.reset} No broken anchor links found\n`);
    return;
  }

  console.log(`\n  ${C.yellow}Broken Links${C.reset} (${broken.length})\n`);

  broken.forEach(b => {
    console.log(`  ${C.dim}Line ${b.line}:${C.reset} [${b.text}](#${b.anchor})`);
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

  let file = null;
  let mode = 'headings';
  let format = 'markdown';
  let linkHeading = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--toc') mode = 'toc';
    else if (arg === '--check') mode = 'check';
    else if (arg === '--anchors') mode = 'anchors';
    else if (arg === '--link') { mode = 'link'; linkHeading = args[++i]; }
    else if (arg === '--format') format = args[++i] || 'markdown';
    else if (!arg.startsWith('-')) file = arg;
  }

  return { file, mode, format, linkHeading };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (!opts.file) {
    console.error('  Error: No file specified');
    process.exit(1);
  }

  let content;
  try {
    content = readFileSync(opts.file, 'utf-8');
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }

  const headings = extractHeadings(content);

  switch (opts.mode) {
    case 'headings':
      displayHeadings(headings);
      break;
    case 'toc':
      const toc = generateToc(headings, opts.format);
      displayToc(toc);
      break;
    case 'check':
      const broken = checkLinks(content, headings);
      displayBrokenLinks(broken);
      process.exit(broken.length > 0 ? 1 : 0);
      break;
    case 'anchors':
      console.log();
      headings.forEach(h => console.log(`  ${C.cyan}#${h.anchor}${C.reset}`));
      console.log();
      break;
    case 'link':
      if (!opts.linkHeading) {
        console.error('  Error: No heading specified');
        process.exit(1);
      }
      const anchor = generateAnchor(opts.linkHeading);
      console.log(`\n  [${opts.linkHeading}](#${anchor})\n`);
      break;
  }
}

main();
