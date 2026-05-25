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
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mmdlint\x1b[0m - Markdown linter

  \x1b[1mUsage:\x1b[0m
    mdlint <file...> [options]

  \x1b[1mRules:\x1b[0m
    MD001    Heading levels should only increment by one
    MD003    Heading style should be consistent
    MD009    Trailing spaces
    MD010    Hard tabs
    MD012    Multiple consecutive blank lines
    MD013    Line length (default: 120)
    MD018    No space after hash in heading
    MD019    Multiple spaces after hash in heading
    MD022    Headings should be surrounded by blank lines
    MD023    Headings must start at beginning of line
    MD025    Only one top-level heading
    MD027    Multiple spaces after blockquote symbol
    MD030    Spaces after list markers
    MD032    Lists should be surrounded by blank lines
    MD034   No bare URLs
    MD037   Spaces inside emphasis markers
    MD038   Spaces inside code span
    MD039   Spaces inside link text
    MD041   First line should be a top-level heading
    MD047   Files should end with a single newline

  \x1b[1mOptions:\x1b[0m
    --max-line-length <n>   Max line length (default: 120)
    --no-heading-blank      Don't require blank lines around headings
    --no-list-blank         Don't require blank lines around lists
    --fix                   Auto-fix issues
    --json                  Output as JSON
    -h, --help              Show this help

  \x1b[1mExamples:\x1b[0m
    mdlint README.md
    mdlint *.md
    mdlint doc.md --max-line-length 80
    mdlint doc.md --fix
`);
}

// --- Rules ---
const rules = {
  MD001: (lines) => {
    const issues = [];
    let prevLevel = 0;
    lines.forEach((line, i) => {
      const match = line.match(/^(#{1,6})\s/);
      if (match) {
        const level = match[1].length;
        if (prevLevel > 0 && level > prevLevel + 1) {
          issues.push({ line: i + 1, rule: 'MD001', message: `Heading level ${level} should only increment by one from ${prevLevel}` });
        }
        prevLevel = level;
      }
    });
    return issues;
  },

  MD003: (lines) => {
    const issues = [];
    let style = null; // 'atx' or 'setext'
    lines.forEach((line, i) => {
      if (/^#{1,6}\s/.test(line)) {
        if (style === 'setext') {
          issues.push({ line: i + 1, rule: 'MD003', message: 'Mixed heading style (ATX after setext)' });
        }
        style = 'atx';
      } else if (/^[=-]+$/.test(line.trim()) && i > 0 && lines[i - 1].trim()) {
        if (style === 'atx') {
          issues.push({ line: i + 1, rule: 'MD003', message: 'Mixed heading style (setext after ATX)' });
        }
        style = 'setext';
      }
    });
    return issues;
  },

  MD009: (lines) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (line !== line.trimEnd() && line.trimEnd().length > 0) {
        const trailing = line.length - line.trimEnd().length;
        issues.push({ line: i + 1, rule: 'MD009', message: `Trailing spaces (${trailing} space${trailing > 1 ? 's' : ''})` });
      }
    });
    return issues;
  },

  MD010: (lines) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (line.includes('\t')) {
        issues.push({ line: i + 1, rule: 'MD010', message: 'Hard tabs' });
      }
    });
    return issues;
  },

  MD012: (lines) => {
    const issues = [];
    let blankCount = 0;
    lines.forEach((line, i) => {
      if (line.trim() === '') {
        blankCount++;
        if (blankCount > 1) {
          issues.push({ line: i + 1, rule: 'MD012', message: 'Multiple consecutive blank lines' });
        }
      } else {
        blankCount = 0;
      }
    });
    return issues;
  },

  MD013: (lines, maxLen = 120) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (line.length > maxLen) {
        issues.push({ line: i + 1, rule: 'MD013', message: `Line length ${line.length} exceeds ${maxLen}` });
      }
    });
    return issues;
  },

  MD018: (lines) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (/^#+[^ #]/.test(line)) {
        issues.push({ line: i + 1, rule: 'MD018', message: 'No space after hash in heading' });
      }
    });
    return issues;
  },

  MD019: (lines) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (/^#+\s{2,}/.test(line)) {
        issues.push({ line: i + 1, rule: 'MD019', message: 'Multiple spaces after hash in heading' });
      }
    });
    return issues;
  },

  MD022: (lines, requireBlank = true) => {
    if (!requireBlank) return [];
    const issues = [];
    lines.forEach((line, i) => {
      if (/^#{1,6}\s/.test(line)) {
        if (i > 0 && lines[i - 1].trim() !== '') {
          issues.push({ line: i + 1, rule: 'MD022', message: 'Heading should be preceded by a blank line' });
        }
        if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
          issues.push({ line: i + 1, rule: 'MD022', message: 'Heading should be followed by a blank line' });
        }
      }
    });
    return issues;
  },

  MD023: (lines) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (/^\s+#{1,6}\s/.test(line)) {
        issues.push({ line: i + 1, rule: 'MD023', message: 'Heading must start at beginning of line' });
      }
    });
    return issues;
  },

  MD025: (lines) => {
    const issues = [];
    let h1Count = 0;
    lines.forEach((line, i) => {
      if (/^#{1}\s/.test(line)) {
        h1Count++;
        if (h1Count > 1) {
          issues.push({ line: i + 1, rule: 'MD025', message: 'Multiple top-level headings' });
        }
      }
    });
    return issues;
  },

  MD027: (lines) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (/^>\s{2,}/.test(line)) {
        issues.push({ line: i + 1, rule: 'MD027', message: 'Multiple spaces after blockquote symbol' });
      }
    });
    return issues;
  },

  MD030: (lines) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (/^[\s]*[-*+]\s{2,}/.test(line)) {
        issues.push({ line: i + 1, rule: 'MD030', message: 'Multiple spaces after list marker' });
      }
      if (/^[\s]*\d+\.\s{2,}/.test(line)) {
        issues.push({ line: i + 1, rule: 'MD030', message: 'Multiple spaces after list marker' });
      }
    });
    return issues;
  },

  MD032: (lines, requireBlank = true) => {
    if (!requireBlank) return [];
    const issues = [];
    let inList = false;
    lines.forEach((line, i) => {
      const isListItem = /^[\s]*[-*+]\s/.test(line) || /^[\s]*\d+\.\s/.test(line);
      if (isListItem && !inList) {
        if (i > 0 && lines[i - 1].trim() !== '') {
          issues.push({ line: i + 1, rule: 'MD032', message: 'List should be preceded by a blank line' });
        }
        inList = true;
      } else if (!isListItem && inList && line.trim() !== '') {
        if (i > 0 && lines[i - 1].trim() !== '') {
          issues.push({ line: i, rule: 'MD032', message: 'List should be followed by a blank line' });
        }
        inList = false;
      }
    });
    return issues;
  },

  MD034: (lines) => {
    const issues = [];
    const urlRegex = /(?<![(\[])(https?:\/\/[^\s<>]+)(?![)\]])/g;
    lines.forEach((line, i) => {
      if (urlRegex.test(line)) {
        issues.push({ line: i + 1, rule: 'MD034', message: 'Bare URL used' });
      }
      urlRegex.lastIndex = 0;
    });
    return issues;
  },

  MD037: (lines) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (/\*\s.*\*\*/.test(line) || /\*\*\s/.test(line)) {
        issues.push({ line: i + 1, rule: 'MD037', message: 'Spaces inside emphasis markers' });
      }
    });
    return issues;
  },

  MD038: (lines) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (/` [^`]+`/.test(line) || /[^`]+` /.test(line)) {
        issues.push({ line: i + 1, rule: 'MD038', message: 'Spaces inside code span' });
      }
    });
    return issues;
  },

  MD039: (lines) => {
    const issues = [];
    lines.forEach((line, i) => {
      if (/\[ [^\]]+\]/.test(line)) {
        issues.push({ line: i + 1, rule: 'MD039', message: 'Spaces inside link text' });
      }
    });
    return issues;
  },

  MD041: (lines) => {
    const issues = [];
    if (lines.length > 0 && !/^#{1}\s/.test(lines[0])) {
      issues.push({ line: 1, rule: 'MD041', message: 'First line should be a top-level heading' });
    }
    return issues;
  },

  MD047: (lines) => {
    const issues = [];
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      if (lastLine !== '') {
        issues.push({ line: lines.length, rule: 'MD047', message: 'File should end with a single newline' });
      }
    }
    return issues;
  },
};

// --- Lint file ---
function lintFile(content, options = {}) {
  const lines = content.split('\n');
  const allIssues = [];

  for (const [ruleName, ruleFn] of Object.entries(rules)) {
    const issues = ruleFn(lines, options.maxLineLength || 120);
    allIssues.push(...issues);
  }

  // Sort by line number
  allIssues.sort((a, b) => a.line - b.line);

  return allIssues;
}

// --- Fix file ---
function fixFile(content, issues) {
  let lines = content.split('\n');

  // Apply fixes
  for (const issue of issues) {
    const i = issue.line - 1;
    if (i < 0 || i >= lines.length) continue;

    switch (issue.rule) {
      case 'MD009':
        lines[i] = lines[i].trimEnd();
        break;
      case 'MD010':
        lines[i] = lines[i].replace(/\t/g, '  ');
        break;
      case 'MD018':
        lines[i] = lines[i].replace(/^(#+)([^ #])/, '$1 $2');
        break;
      case 'MD019':
        lines[i] = lines[i].replace(/^(#+)\s{2,}/, '$1 ');
        break;
      case 'MD027':
        lines[i] = lines[i].replace(/^>\s{2,}/, '> ');
        break;
      case 'MD030':
        lines[i] = lines[i].replace(/^([\s]*[-*+])\s{2,}/, '$1 ');
        lines[i] = lines[i].replace(/^([\s]*\d+\.)\s{2,}/, '$1 ');
        break;
    }
  }

  // Remove multiple blank lines (MD012)
  const result = [];
  let prevBlank = false;
  for (const line of lines) {
    if (line.trim() === '') {
      if (!prevBlank) result.push(line);
      prevBlank = true;
    } else {
      prevBlank = false;
      result.push(line);
    }
  }
  lines = result;

  // Ensure file ends with newline (MD047)
  if (lines.length > 0 && lines[lines.length - 1] !== '') {
    lines.push('');
  }

  return lines.join('\n');
}

// --- Display ---
function displayIssues(file, issues) {
  if (issues.length === 0) {
    console.log(`  ${C.green}✓${C.reset} ${file}: no issues`);
    return;
  }

  console.log(`\n  ${C.bold}${file}${C.reset} (${issues.length} issue${issues.length > 1 ? 's' : ''})\n`);

  issues.forEach(issue => {
    const line = `${C.cyan}${String(issue.line).padStart(4)}${C.reset}`;
    const rule = `${C.yellow}${issue.rule}${C.reset}`;
    console.log(`  ${line}  ${rule}  ${issue.message}`);
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

  let maxLineLength = 120;
  let headingBlank = true;
  let listBlank = true;
  let fix = false;
  let jsonOutput = false;
  const files = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--max-line-length') {
      maxLineLength = parseInt(args[++i]) || 120;
    } else if (arg === '--no-heading-blank') {
      headingBlank = false;
    } else if (arg === '--no-list-blank') {
      listBlank = false;
    } else if (arg === '--fix') {
      fix = true;
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    }
  }

  return { maxLineLength, headingBlank, listBlank, fix, jsonOutput, files };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (opts.files.length === 0) {
    console.error('  Error: No files specified');
    process.exit(1);
  }

  let totalIssues = 0;
  const results = [];

  for (const file of opts.files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const issues = lintFile(content, opts);

      if (opts.fix) {
        const fixed = fixFile(content, issues);
        writeFileSync(file, fixed);
        console.log(`  ${C.green}✓${C.reset} Fixed ${file}`);
      } else {
        displayIssues(file, issues);
        totalIssues += issues.length;
        results.push({ file, issues });
      }
    } catch (err) {
      console.error(`  ${C.red}Error:${C.reset} ${file}: ${err.message}`);
    }
  }

  if (opts.jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  }

  if (totalIssues > 0 && !opts.fix) {
    console.log(`  ${C.bold}Total:${C.reset} ${totalIssues} issue${totalIssues > 1 ? 's' : ''}\n`);
    process.exit(1);
  }
}

main();
