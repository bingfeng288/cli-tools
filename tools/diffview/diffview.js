#!/usr/bin/env node

import { readFileSync } from 'node:fs';

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
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mdiffview\x1b[0m - CLI diff viewer

  \x1b[1mUsage:\x1b[0m
    diffview <file1> <file2> [options]
    echo "text1" | diffview --stdin "text2"

  \x1b[1mOptions:\x1b[0m
    -u, --unified             Unified diff format (default)
    -s, --side-by-side        Side-by-side view
    -w, --word                Word-level diff
    -l, --line                Line-level diff
    -n, --line-numbers        Show line numbers
    -i, --ignore-whitespace   Ignore whitespace changes
    -c, --context <n>         Number of context lines (default: 3)
    --width <n>               Width for side-by-side (default: 80)
    -h, --help                Show this help

  \x1b[1mExamples:\x1b[0m
    diffview old.txt new.txt
    diffview old.txt new.txt -s
    diffview old.txt new.txt -w
    diffview old.txt new.txt -n
    diffview old.txt new.txt -i
`);
}

// --- LCS (Longest Common Subsequence) ---
function lcs(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'equal', oldIdx: i - 1, newIdx: j - 1 });
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      result.unshift({ type: 'delete', oldIdx: i - 1 });
      i--;
    } else {
      result.unshift({ type: 'insert', newIdx: j - 1 });
      j--;
    }
  }

  while (i > 0) { result.unshift({ type: 'delete', oldIdx: --i }); }
  while (j > 0) { result.unshift({ type: 'insert', newIdx: --j }); }

  return result;
}

// --- Word diff ---
function wordDiff(line1, line2) {
  const words1 = line1.split(/(\s+)/);
  const words2 = line2.split(/(\s+)/);
  const ops = lcs(words1, words2);

  let oldResult = '';
  let newResult = '';

  for (const op of ops) {
    if (op.type === 'equal') {
      oldResult += words1[op.oldIdx];
      newResult += words2[op.newIdx];
    } else if (op.type === 'delete') {
      oldResult += `${C.red}${words1[op.oldIdx]}${C.reset}`;
    } else {
      newResult += `${C.green}${words2[op.newIdx]}${C.reset}`;
    }
  }

  return { old: oldResult, new: newResult };
}

// --- Line diff ---
function lineDiff(oldLines, newLines, ignoreWhitespace = false) {
  const normalize = ignoreWhitespace ? (s) => s.trim().replace(/\s+/g, ' ') : (s) => s;
  const oldNorm = oldLines.map(normalize);
  const newNorm = newLines.map(normalize);
  const ops = lcs(oldNorm, newNorm);

  const changes = [];
  let oldIdx = 0, newIdx = 0;

  for (const op of ops) {
    while (oldIdx < op.oldIdx || (op.type === 'insert' && oldIdx <= op.oldIdx)) {
      if (op.type === 'insert' && oldIdx === op.oldIdx) break;
      changes.push({ type: 'delete', line: oldLines[oldIdx], oldNum: oldIdx + 1 });
      oldIdx++;
    }
    while (newIdx < op.newIdx) {
      changes.push({ type: 'insert', line: newLines[newIdx], newNum: newIdx + 1 });
      newIdx++;
    }

    if (op.type === 'equal') {
      changes.push({ type: 'equal', line: oldLines[op.oldIdx], oldNum: op.oldIdx + 1, newNum: op.newIdx + 1 });
      oldIdx = op.oldIdx + 1;
      newIdx = op.newIdx + 1;
    } else if (op.type === 'delete') {
      changes.push({ type: 'delete', line: oldLines[op.oldIdx], oldNum: op.oldIdx + 1 });
      oldIdx = op.oldIdx + 1;
    } else {
      changes.push({ type: 'insert', line: newLines[op.newIdx], newNum: op.newIdx + 1 });
      newIdx = op.newIdx + 1;
    }
  }

  // Remaining
  while (oldIdx < oldLines.length) {
    changes.push({ type: 'delete', line: oldLines[oldIdx], oldNum: oldIdx + 1 });
    oldIdx++;
  }
  while (newIdx < newLines.length) {
    changes.push({ type: 'insert', line: newLines[newIdx], newNum: newIdx + 1 });
    newIdx++;
  }

  return changes;
}

// --- Unified diff ---
function unifiedDiff(changes, context = 3) {
  const lines = [];
  let hunks = [];
  let currentHunk = null;

  // Find changed lines
  const changedIndices = new Set();
  changes.forEach((c, i) => {
    if (c.type !== 'equal') changedIndices.add(i);
  });

  // Group into hunks
  changes.forEach((c, i) => {
    const nearChange = [...changedIndices].some(ci => Math.abs(ci - i) <= context);

    if (nearChange) {
      if (!currentHunk) {
        currentHunk = { start: i, changes: [] };
      }
      currentHunk.changes.push(c);
    } else if (currentHunk) {
      hunks.push(currentHunk);
      currentHunk = null;
    }
  });
  if (currentHunk) hunks.push(currentHunk);

  // Format hunks
  for (const hunk of hunks) {
    const first = hunk.changes[0];
    const last = hunk.changes[hunk.changes.length - 1];
    const oldStart = first.oldNum || first.newNum;
    const newStart = first.newNum || first.oldNum;
    const oldCount = hunk.changes.filter(c => c.type !== 'insert').length;
    const newCount = hunk.changes.filter(c => c.type !== 'delete').length;

    lines.push(`${C.yellow}@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${C.reset}`);

    for (const c of hunk.changes) {
      if (c.type === 'equal') {
        lines.push(`  ${c.line}`);
      } else if (c.type === 'delete') {
        lines.push(`${C.red}-${c.line}${C.reset}`);
      } else {
        lines.push(`${C.green}+${c.line}${C.reset}`);
      }
    }
  }

  return lines;
}

// --- Side-by-side diff ---
function sideBySideDiff(changes, width = 80, showLineNumbers = false) {
  const halfWidth = Math.floor((width - (showLineNumbers ? 14 : 3)) / 2);
  const lines = [];

  // Find matching pairs
  const pairs = [];
  let i = 0;

  while (i < changes.length) {
    if (changes[i].type === 'equal') {
      pairs.push({ type: 'equal', old: changes[i], new: changes[i] });
      i++;
    } else if (changes[i].type === 'delete' && i + 1 < changes.length && changes[i + 1].type === 'insert') {
      pairs.push({ type: 'change', old: changes[i], new: changes[i + 1] });
      i += 2;
    } else if (changes[i].type === 'delete') {
      pairs.push({ type: 'delete', old: changes[i], new: null });
      i++;
    } else {
      pairs.push({ type: 'insert', old: null, new: changes[i] });
      i++;
    }
  }

  // Separator
  const sep = showLineNumbers ? '│' : '│';

  for (const pair of pairs) {
    let oldText = pair.old?.line || '';
    let newText = pair.new?.line || '';

    // Truncate
    if (oldText.length > halfWidth) oldText = oldText.slice(0, halfWidth - 3) + '...';
    if (newText.length > halfWidth) newText = newText.slice(0, halfWidth - 3) + '...';

    let oldNum = showLineNumbers ? `${String(pair.old?.oldNum || '').padStart(4)} ` : '';
    let newNum = showLineNumbers ? ` ${String(pair.new?.newNum || '').padStart(4)}` : '';

    if (pair.type === 'equal') {
      lines.push(`${C.dim}${oldNum}${C.reset}${oldText.padEnd(halfWidth)} ${C.dim}${sep}${C.reset} ${newText}${C.dim}${newNum}${C.reset}`);
    } else if (pair.type === 'delete') {
      lines.push(`${C.dim}${oldNum}${C.reset}${C.red}${oldText}${C.reset}`.padEnd(width) + ` ${C.dim}${sep}${C.reset} ${C.dim}${newNum}${C.reset}`);
    } else if (pair.type === 'insert') {
      lines.push(`${C.dim}${oldNum}${C.reset}${' '.repeat(halfWidth)} ${C.dim}${sep}${C.reset} ${C.green}${newText}${C.reset}${C.dim}${newNum}${C.reset}`);
    } else {
      // Word diff for changes
      const wd = wordDiff(oldText, newText);
      lines.push(`${C.dim}${oldNum}${C.reset}${C.red}${wd.old}${C.reset}`.padEnd(width) + ` ${C.dim}${sep}${C.reset} ${C.green}${wd.new}${C.reset}${C.dim}${newNum}${C.reset}`);
    }
  }

  return lines;
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let file1 = null, file2 = null;
  let mode = 'unified';
  let context = 3;
  let width = 80;
  let showLineNumbers = false;
  let ignoreWhitespace = false;
  let stdin = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-u' || arg === '--unified') mode = 'unified';
    else if (arg === '-s' || arg === '--side-by-side') mode = 'side';
    else if (arg === '-w' || arg === '--word') mode = 'word';
    else if (arg === '-l' || arg === '--line') mode = 'line';
    else if (arg === '-n' || arg === '--line-numbers') showLineNumbers = true;
    else if (arg === '-i' || arg === '--ignore-whitespace') ignoreWhitespace = true;
    else if (arg === '-c' || arg === '--context') context = parseInt(args[++i]) || 3;
    else if (arg === '--width') width = parseInt(args[++i]) || 80;
    else if (arg === '--stdin') stdin = true;
    else if (!file1) file1 = arg;
    else if (!file2) file2 = arg;
  }

  return { file1, file2, mode, context, width, showLineNumbers, ignoreWhitespace, stdin };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  let oldText, newText;

  if (opts.stdin) {
    oldText = opts.file1 || '';
    newText = opts.file2 || '';
  } else {
    if (!opts.file1 || !opts.file2) {
      console.error('  Error: Two files required');
      process.exit(1);
    }
    try {
      oldText = readFileSync(opts.file1, 'utf-8');
      newText = readFileSync(opts.file2, 'utf-8');
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      process.exit(1);
    }
  }

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  console.log();

  if (opts.mode === 'unified' || opts.mode === 'line') {
    const changes = lineDiff(oldLines, newLines, opts.ignoreWhitespace);

    if (opts.mode === 'unified') {
      const output = unifiedDiff(changes, opts.context);
      if (output.length === 0) {
        console.log(`  ${C.dim}No differences${C.reset}`);
      } else {
        output.forEach(line => console.log(`  ${line}`));
      }
    } else {
      // Line mode - show all changes
      for (const c of changes) {
        if (c.type === 'equal') {
          console.log(`  ${C.dim}  ${c.line}${C.reset}`);
        } else if (c.type === 'delete') {
          console.log(`  ${C.red}- ${c.line}${C.reset}`);
        } else {
          console.log(`  ${C.green}+ ${c.line}${C.reset}`);
        }
      }
    }
  } else if (opts.mode === 'side') {
    const changes = lineDiff(oldLines, newLines, opts.ignoreWhitespace);
    const output = sideBysideDiff(changes, opts.width, opts.showLineNumbers);
    output.forEach(line => console.log(`  ${line}`));
  } else if (opts.mode === 'word') {
    // Word-level diff for each line pair
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      if (oldLine === newLine) {
        console.log(`  ${C.dim}  ${oldLine}${C.reset}`);
      } else if (!oldLine) {
        console.log(`  ${C.green}+ ${newLine}${C.reset}`);
      } else if (!newLine) {
        console.log(`  ${C.red}- ${oldLine}${C.reset}`);
      } else {
        const wd = wordDiff(oldLine, newLine);
        console.log(`  ${C.red}-${C.reset} ${wd.old}`);
        console.log(`  ${C.green}+${C.reset} ${wd.new}`);
      }
    }
  }

  console.log();
}

// Fix typo in function call
function sideBysideDiff(changes, width, showLineNumbers) {
  return sideBySideDiff(changes, width, showLineNumbers);
}

main();
