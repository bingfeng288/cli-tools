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
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

// --- Stop words ---
const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see',
  'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
  'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work',
  'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
  'give', 'day', 'most', 'us', 'is', 'am', 'are', 'was', 'were', 'been',
  'has', 'had', 'did', 'does', 'doing', 'done', 'should', 'might', 'must',
  'shall', 'may', 'need', 'here', 'where', 'why', 'how', 'each', 'every',
  'both', 'few', 'more', 'most', 'other', 'such', 'own', 'same', 'too',
  'very', 'just', 'don', 'now',
]);

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mwordfreq\x1b[0m - Word frequency analyzer

  \x1b[1mUsage:\x1b[0m
    wordfreq [file] [options]
    cat text.txt | wordfreq

  \x1b[1mOptions:\x1b[0m
    -n, --top <n>         Show top N words (default: 20)
    -s, --stop            Include stop words
    -l, --length <min>    Minimum word length
    -c, --count           Show counts only
    -p, --percent         Show percentages
    --stats               Show text statistics
    --json                Output as JSON
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    wordfreq document.txt
    wordfreq document.txt -n 50
    wordfreq document.txt --stats
    cat essay.txt | wordfreq -p
    wordfreq document.txt -l 5
`);
}

// --- Analyze text ---
function analyze(text, options = {}) {
  const {
    includeStop = false,
    minLength = 1,
  } = options;

  // Split into words
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= minLength);

  // Count frequencies
  const freq = {};
  for (const word of words) {
    if (!includeStop && STOP_WORDS.has(word)) continue;
    freq[word] = (freq[word] || 0) + 1;
  }

  // Sort by frequency
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count, percent: (count / words.length * 100) }));

  return {
    words: sorted,
    totalWords: words.length,
    uniqueWords: Object.keys(freq).length,
  };
}

// --- Text statistics ---
function getStats(text) {
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  const lines = text.split('\n').length;

  // Average word length
  const wordList = text.toLowerCase().replace(/[^a-z0-9'\s-]/g, '').split(/\s+/).filter(w => w.length > 0);
  const avgWordLength = wordList.reduce((sum, w) => sum + w.length, 0) / wordList.length;

  // Average sentence length (words per sentence)
  const avgSentenceLength = words / sentences;

  // Flesch Reading Ease (simplified)
  const syllables = wordList.reduce((sum, w) => sum + countSyllables(w), 0);
  const flesch = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));

  // Reading time (average 200 words per minute)
  const readingTimeMin = words / 200;

  return {
    chars,
    charsNoSpace,
    words,
    sentences,
    paragraphs,
    lines,
    avgWordLength: avgWordLength.toFixed(1),
    avgSentenceLength: avgSentenceLength.toFixed(1),
    fleschScore: flesch.toFixed(0),
    readingTime: readingTimeMin < 1 ? `${Math.ceil(readingTimeMin * 60)} sec` : `${Math.ceil(readingTimeMin)} min`,
  };
}

// --- Count syllables (approximate) ---
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;

  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');

  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

// --- Display frequency table ---
function displayFrequency(words, top, showPercent = false, showCount = true) {
  const maxCount = Math.max(...words.slice(0, top).map(w => w.count));
  const barWidth = 30;

  console.log(`\n  ${C.bold}Word Frequency${C.reset} (top ${Math.min(top, words.length)} of ${words.length} unique words)\n`);

  words.slice(0, top).forEach((item, i) => {
    const rank = `${C.dim}${String(i + 1).padStart(3)}${C.reset}`;
    const word = `${C.cyan}${item.word.padEnd(20)}${C.reset}`;
    const bar = `${C.green}${'█'.repeat(Math.round(item.count / maxCount * barWidth)).padEnd(barWidth)}${C.reset}`;
    const count = showCount ? ` ${C.bold}${String(item.count).padStart(5)}${C.reset}` : '';
    const percent = showPercent ? ` ${C.dim}${item.percent.toFixed(1)}%${C.reset}` : '';

    console.log(`  ${rank}. ${word} ${bar}${count}${percent}`);
  });

  console.log();
}

// --- Display stats ---
function displayStats(stats) {
  console.log(`\n  ${C.bold}Text Statistics${C.reset}\n`);
  console.log(`  ${C.dim}Characters:${C.reset}      ${C.bold}${stats.chars.toLocaleString()}${C.reset}`);
  console.log(`  ${C.dim}Chars (no space):${C.reset} ${C.bold}${stats.charsNoSpace.toLocaleString()}${C.reset}`);
  console.log(`  ${C.dim}Words:${C.reset}           ${C.bold}${stats.words.toLocaleString()}${C.reset}`);
  console.log(`  ${C.dim}Sentences:${C.reset}       ${C.bold}${stats.sentences.toLocaleString()}${C.reset}`);
  console.log(`  ${C.dim}Paragraphs:${C.reset}      ${C.bold}${stats.paragraphs.toLocaleString()}${C.reset}`);
  console.log(`  ${C.dim}Lines:${C.reset}           ${C.bold}${stats.lines.toLocaleString()}${C.reset}`);
  console.log();
  console.log(`  ${C.dim}Avg word length:${C.reset}  ${stats.avgWordLength} chars`);
  console.log(`  ${C.dim}Avg sentence:${C.reset}     ${stats.avgSentenceLength} words`);
  console.log(`  ${C.dim}Flesch score:${C.reset}     ${stats.fleschScore} ${getFleschLabel(stats.fleschScore)}`);
  console.log(`  ${C.dim}Reading time:${C.reset}     ${stats.readingTime}`);
  console.log();
}

function getFleschLabel(score) {
  const s = parseFloat(score);
  if (s >= 90) return '(very easy)';
  if (s >= 80) return '(easy)';
  if (s >= 70) return '(fairly easy)';
  if (s >= 60) return '(standard)';
  if (s >= 50) return '(fairly difficult)';
  if (s >= 30) return '(difficult)';
  return '(very difficult)';
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let top = 20;
  let includeStop = false;
  let minLength = 1;
  let countOnly = false;
  let showPercent = false;
  let showStats = false;
  let jsonOutput = false;
  let file = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--top') {
      top = parseInt(args[++i]) || 20;
    } else if (arg === '-s' || arg === '--stop') {
      includeStop = true;
    } else if (arg === '-l' || arg === '--length') {
      minLength = parseInt(args[++i]) || 1;
    } else if (arg === '-c' || arg === '--count') {
      countOnly = true;
    } else if (arg === '-p' || arg === '--percent') {
      showPercent = true;
    } else if (arg === '--stats') {
      showStats = true;
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  return { top, includeStop, minLength, countOnly, showPercent, showStats, jsonOutput, file };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read input
  let text;
  if (opts.file) {
    try {
      text = readFileSync(opts.file, 'utf-8');
    } catch (err) {
      console.error(`  Error reading file: ${err.message}`);
      process.exit(1);
    }
  } else {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    text = Buffer.concat(chunks).toString('utf-8');
  }

  if (!text.trim()) {
    console.error('  Error: No text provided');
    process.exit(1);
  }

  // Stats mode
  if (opts.showStats) {
    const stats = getStats(text);
    displayStats(stats);
    return;
  }

  // Word frequency
  const result = analyze(text, {
    includeStop: opts.includeStop,
    minLength: opts.minLength,
  });

  if (opts.jsonOutput) {
    console.log(JSON.stringify({
      totalWords: result.totalWords,
      uniqueWords: result.uniqueWords,
      words: result.words.slice(0, opts.top),
    }, null, 2));
    return;
  }

  if (opts.countOnly) {
    result.words.slice(0, opts.top).forEach(item => {
      console.log(`${item.count} ${item.word}`);
    });
    return;
  }

  displayFrequency(result.words, opts.top, opts.showPercent);
}

main();
