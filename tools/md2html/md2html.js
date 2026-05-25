#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Simple Markdown Parser ---
function parseMarkdown(md) {
  let html = md;

  // Normalize line endings
  html = html.replace(/\r\n/g, '\n');

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${langClass}>${escaped}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)*)/gm, (match, header, separator, body) => {
    const headers = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Unordered lists
  html = html.replace(/^(\s*)[-*+]\s+(.+)$/gm, (match, indent, content) => {
    return `<li>${content}</li>`;
  });

  // Ordered lists
  html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive li in ul
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>\n$1</ul>');

  // Paragraphs
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  // Clean up extra newlines
  html = html.replace(/\n{3,}/g, '\n\n');

  return html;
}

// --- Generate TOC ---
function generateToc(md) {
  const headings = [];
  const regex = /^(#{1,6})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(md)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    headings.push({ level, text, id });
  }

  if (headings.length === 0) return '';

  let toc = '<nav class="toc"><h3>Table of Contents</h3><ul>\n';
  headings.forEach(h => {
    const indent = '  '.repeat(h.level - 1);
    toc += `${indent}<li><a href="#${h.id}">${h.text}</a></li>\n`;
  });
  toc += '</ul></nav>';

  return toc;
}

// --- Themes ---
const themes = {
  default: {
    name: 'Default',
    css: `
      :root { --bg: #fff; --text: #333; --heading: #1a1a1a; --link: #3b82f6; --code-bg: #f5f5f5; --border: #e5e5e5; --blockquote-bg: #f9f9f9; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, 'Segoe UI', sans-serif; color: var(--text); background: var(--bg); line-height: 1.7; max-width: 800px; margin: 40px auto; padding: 0 24px; }
      h1, h2, h3, h4, h5, h6 { color: var(--heading); margin: 1.5em 0 0.5em; line-height: 1.3; }
      h1 { font-size: 2em; border-bottom: 2px solid var(--border); padding-bottom: 0.3em; }
      h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.2em; }
      p { margin: 0.8em 0; }
      a { color: var(--link); text-decoration: none; }
      a:hover { text-decoration: underline; }
      code { background: var(--code-bg); padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
      pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 16px; overflow-x: auto; margin: 1em 0; }
      pre code { background: none; padding: 0; }
      blockquote { border-left: 4px solid var(--link); padding: 8px 16px; margin: 1em 0; background: var(--blockquote-bg); }
      ul, ol { padding-left: 24px; margin: 0.8em 0; }
      li { margin: 0.3em 0; }
      table { width: 100%; border-collapse: collapse; margin: 1em 0; }
      th, td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
      th { background: var(--code-bg); font-weight: 600; }
      hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
      img { max-width: 100%; border-radius: 6px; }
      .toc { background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 16px; margin: 1.5em 0; }
      .toc h3 { margin: 0 0 8px; font-size: 14px; }
      .toc ul { list-style: none; padding-left: 0; }
      .toc li { margin: 4px 0; padding-left: 16px; }
      .toc a { font-size: 14px; }
      @media print { body { max-width: none; margin: 0; padding: 20px; } }
    `,
  },
  dark: {
    name: 'Dark',
    css: `
      :root { --bg: #1a1a2e; --text: #e0e0e0; --heading: #fff; --link: #58a6ff; --code-bg: #16213e; --border: #2a2a4a; --blockquote-bg: #16213e; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, 'Segoe UI', sans-serif; color: var(--text); background: var(--bg); line-height: 1.7; max-width: 800px; margin: 40px auto; padding: 0 24px; }
      h1, h2, h3, h4, h5, h6 { color: var(--heading); margin: 1.5em 0 0.5em; line-height: 1.3; }
      h1 { font-size: 2em; border-bottom: 2px solid var(--border); padding-bottom: 0.3em; }
      h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.2em; }
      p { margin: 0.8em 0; }
      a { color: var(--link); text-decoration: none; }
      a:hover { text-decoration: underline; }
      code { background: var(--code-bg); padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
      pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 16px; overflow-x: auto; margin: 1em 0; }
      pre code { background: none; padding: 0; }
      blockquote { border-left: 4px solid var(--link); padding: 8px 16px; margin: 1em 0; background: var(--blockquote-bg); }
      ul, ol { padding-left: 24px; margin: 0.8em 0; }
      li { margin: 0.3em 0; }
      table { width: 100%; border-collapse: collapse; margin: 1em 0; }
      th, td { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
      th { background: var(--code-bg); font-weight: 600; }
      hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
      img { max-width: 100%; border-radius: 6px; }
      .toc { background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 16px; margin: 1.5em 0; }
      .toc h3 { margin: 0 0 8px; font-size: 14px; color: var(--heading); }
      .toc ul { list-style: none; padding-left: 0; }
      .toc li { margin: 4px 0; padding-left: 16px; }
      .toc a { font-size: 14px; }
    `,
  },
  github: {
    name: 'GitHub',
    css: `
      :root { --bg: #fff; --text: #24292e; --heading: #24292e; --link: #0366d6; --code-bg: #f6f8fa; --border: #e1e4e8; --blockquote-bg: #f6f8fa; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: var(--text); background: var(--bg); line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 24px; }
      h1, h2, h3, h4, h5, h6 { color: var(--heading); margin: 1.5em 0 0.5em; line-height: 1.25; }
      h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
      h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
      p { margin: 0 0 16px; }
      a { color: var(--link); text-decoration: none; }
      a:hover { text-decoration: underline; }
      code { background: var(--code-bg); padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
      pre { background: var(--code-bg); border-radius: 6px; padding: 16px; overflow-x: auto; margin: 0 0 16px; }
      pre code { background: none; padding: 0; font-size: 85%; }
      blockquote { border-left: 4px solid var(--border); padding: 0 16px; margin: 0 0 16px; color: #6a737d; }
      ul, ol { padding-left: 2em; margin: 0 0 16px; }
      li { margin: 0.25em 0; }
      table { width: 100%; border-collapse: collapse; margin: 0 0 16px; }
      th, td { border: 1px solid var(--border); padding: 6px 13px; }
      th { background: var(--code-bg); font-weight: 600; }
      hr { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
      img { max-width: 100%; }
      .toc { background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 16px; margin: 0 0 16px; }
      .toc h3 { margin: 0 0 8px; font-size: 14px; }
      .toc ul { list-style: none; padding-left: 0; margin: 0; }
      .toc li { margin: 4px 0; padding-left: 16px; }
      .toc a { font-size: 14px; }
    `,
  },
};

// --- Generate HTML ---
function generateHtml(md, options = {}) {
  const theme = themes[options.theme] || themes.default;
  const title = options.title || extractTitle(md) || 'Document';
  const toc = options.toc ? generateToc(md) : '';
  const content = parseMarkdown(md);

  // Add IDs to headings for TOC links
  let finalContent = content;
  if (options.toc) {
    finalContent = content.replace(/<h([1-6])>(.+?)<\/h[1-6]>/g, (match, level, text) => {
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return `<h${level} id="${id}">${text}</h${level}>`;
    });
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>${theme.css}</style>
</head>
<body>
${toc}
${finalContent}
</body>
</html>`;
}

function extractTitle(md) {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// --- CLI ---
const args = process.argv.slice(2);

function showHelp() {
  console.log(`
  md2html - Markdown to HTML Converter

  Usage: md2html <input.md> [options]

  Options:
    -o, --output FILE   Output file (default: input.html)
    -t, --theme NAME    Theme: default, dark, github (default: default)
    --toc               Add table of contents
    --title TEXT        Custom page title
    -h, --help          Show this help

  Themes: ${Object.keys(themes).join(', ')}

  Examples:
    md2html README.md
    md2html doc.md -o out.html -t dark
    md2html article.md --toc --title "My Article"
    md2html guide.md -t github --toc
`);
}

if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
  showHelp();
  process.exit(0);
}

const inputFile = args[0];
let outputFile = '';
let theme = 'default';
let toc = false;
let title = '';

for (let i = 1; i < args.length; i++) {
  switch (args[i]) {
    case '-o': case '--output': outputFile = args[++i]; break;
    case '-t': case '--theme': theme = args[++i]; break;
    case '--toc': toc = true; break;
    case '--title': title = args[++i]; break;
  }
}

if (!existsSync(inputFile)) {
  console.error(`  File not found: ${inputFile}`);
  process.exit(1);
}

if (!outputFile) {
  outputFile = inputFile.replace(/\.md$/, '.html');
  if (outputFile === inputFile) outputFile = inputFile + '.html';
}

const md = readFileSync(inputFile, 'utf-8');
const html = generateHtml(md, { theme, toc, title });
writeFileSync(outputFile, html);

console.log(`\n  Converted: ${inputFile} → ${outputFile}`);
console.log(`  Theme: ${theme}`);
if (toc) console.log('  TOC: included');
console.log();
