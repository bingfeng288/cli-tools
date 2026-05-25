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
  \x1b[1mdiffstat\x1b[0m - Diff statistics summary

  \x1b[1mUsage:\x1b[0m
    diffstat <file>
    git diff | diffstat

  \x1b[1mOptions:\x1b[0m
    -w, --width <n>       Histogram width (default: 40)
    -s, --sort <field>    Sort by: name, changes, insertions, deletions
    --json                Output as JSON
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    diffstat changes.diff
    git diff | diffstat
    git diff --stat | diffstat
    diffstat changes.diff --sort changes
    diffstat changes.diff --json
`);
}

// --- Parse unified diff ---
function parseDiff(content) {
  const files = [];
  let current = null;

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // diff --git a/file.txt b/file.txt
    if (line.startsWith('diff --git')) {
      const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
      if (match) {
        current = {
          file: match[2],
          insertions: 0,
          deletions: 0,
        };
        files.push(current);
      }
    }
    // Detect file headers for non-git diffs
    // --- a/file.txt
    // +++ b/file.txt
    else if (line.startsWith('--- ')) {
      const path = line.slice(4).replace(/^a\//, '');
      if (path === '/dev/null') continue;
      // Look for matching +++
      const nextLine = lines[i + 1];
      if (nextLine && nextLine.startsWith('+++ ')) {
        const newPath = nextLine.slice(4).replace(/^b\//, '');
        const fileName = newPath !== '/dev/null' ? newPath : path;
        // Only create new entry if we don't already have one from diff --git
        if (!current || current.file !== fileName) {
          current = {
            file: fileName,
            insertions: 0,
            deletions: 0,
          };
          files.push(current);
        }
        i++; // skip +++
      }
    }
    // Count + and - lines (but not +++ or ---)
    else if (current) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        current.insertions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        current.deletions++;
      }
    }
  }

  return files;
}

// --- Parse git diff --stat format ---
function parseDiffStat(content) {
  const files = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // file.txt | 10 ++++---
    const match = line.match(/^(.+?)\s+\|\s+(\d+)\s+([+-]*)$/);
    if (match) {
      const [, file, total, changes] = match;
      const insertions = (changes.match(/\+/g) || []).length;
      const deletions = (changes.match(/-/g) || []).length;
      const totalChanges = parseInt(total);

      // Distribute total changes proportionally
      const ratio = insertions + deletions > 0 ? totalChanges / (insertions + deletions) : 0;
      files.push({
        file: file.trim(),
        insertions: Math.round(insertions * ratio),
        deletions: Math.round(deletions * ratio),
      });
    }
  }

  return files;
}

// --- Format number with color ---
function formatNum(n, color) {
  return `${color}${n}${C.reset}`;
}

// --- Draw histogram bar ---
function drawBar(insertions, deletions, maxWidth, maxChanges) {
  if (maxChanges === 0) return '';

  const total = insertions + deletions;
  const barLen = Math.round((total / maxChanges) * maxWidth);
  const insLen = Math.round((insertions / total) * barLen);
  const delLen = barLen - insLen;

  return `${C.green}${'='.repeat(insLen)}${C.red}${'='.repeat(delLen)}${C.reset}`;
}

// --- Display stats ---
function displayStats(files, options = {}) {
  const { width = 40, sort = null } = options;

  if (files.length === 0) {
    console.log(`  ${C.dim}No changes found${C.reset}`);
    return;
  }

  // Sort
  const sorted = [...files];
  if (sort === 'name') {
    sorted.sort((a, b) => a.file.localeCompare(b.file));
  } else if (sort === 'changes') {
    sorted.sort((a, b) => (b.insertions + b.deletions) - (a.insertions + a.deletions));
  } else if (sort === 'insertions') {
    sorted.sort((a, b) => b.insertions - a.insertions);
  } else if (sort === 'deletions') {
    sorted.sort((a, b) => b.deletions - a.deletions);
  }

  const maxChanges = Math.max(...sorted.map(f => f.insertions + f.deletions), 1);
  const maxFileLen = Math.max(...sorted.map(f => f.file.length), 4);

  // Totals
  const totalInsertions = sorted.reduce((s, f) => s + f.insertions, 0);
  const totalDeletions = sorted.reduce((s, f) => s + f.deletions, 0);

  console.log();

  for (const { file, insertions, deletions } of sorted) {
    const total = insertions + deletions;
    const bar = drawBar(insertions, deletions, width, maxChanges);
    const insStr = insertions > 0 ? ` ${formatNum(insertions, C.green)}` : '';
    const delStr = deletions > 0 ? ` ${formatNum(deletions, C.red)}` : '';

    console.log(`  ${file.padEnd(maxFileLen)} ${bar}${insStr}${delStr}`);
  }

  console.log();
  console.log(`  ${C.bold}Summary${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);
  console.log(`  ${C.bold}${sorted.length}${C.reset} files changed`);
  if (totalInsertions > 0) console.log(`  ${formatNum(totalInsertions, C.green)} insertions`);
  if (totalDeletions > 0) console.log(`  ${formatNum(totalDeletions, C.red)} deletions`);
  console.log();
}

// --- Detect format ---
function detectFormat(content) {
  // Check if it's git diff --stat format
  if (/^\s*.+\s+\|\s+\d+\s+[+-]/.test(content.split('\n')[0])) {
    return 'stat';
  }
  // Check if it's unified diff
  if (content.includes('--- a/') || content.includes('+++ b/') || content.includes('diff --git')) {
    return 'unified';
  }
  return 'unified'; // default
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let file = null;
  let width = 40;
  let sort = null;
  let json = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-w' || arg === '--width') {
      width = parseInt(args[++i]) || 40;
    } else if (arg === '-s' || arg === '--sort') {
      sort = args[++i];
    } else if (arg === '--json') {
      json = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { file, width, sort, json };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read input
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

  // Detect format and parse
  const format = detectFormat(content);
  const files = format === 'stat' ? parseDiffStat(content) : parseDiff(content);

  // Output
  if (opts.json) {
    const totalInsertions = files.reduce((s, f) => s + f.insertions, 0);
    const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);
    console.log(JSON.stringify({
      files: files.map(f => ({
        file: f.file,
        insertions: f.insertions,
        deletions: f.deletions,
        changes: f.insertions + f.deletions,
      })),
      summary: {
        filesChanged: files.length,
        totalInsertions,
        totalDeletions,
        totalChanges: totalInsertions + totalDeletions,
      },
    }, null, 2));
  } else {
    displayStats(files, { width: opts.width, sort: opts.sort });
  }
}

main();
