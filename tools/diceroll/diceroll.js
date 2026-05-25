#!/usr/bin/env node

import { randomInt } from 'node:crypto';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mdiceroll\x1b[0m - Dice roller

  \x1b[1mUsage:\x1b[0m
    diceroll [notation]
    diceroll <sides>
    diceroll <count>d<sides>

  \x1b[1mDice Notation:\x1b[0m
    d6          Roll one 6-sided die
    2d6         Roll two 6-sided dice
    d20         Roll one 20-sided die
    4d6         Roll four 6-sided dice
    d6+3        Roll d6 with +3 modifier
    2d6-2       Roll 2d6 with -2 modifier
    d20 advantage   Roll with advantage (keep highest)
    d20 disadvantage  Roll with disadvantage (keep lowest)

  \x1b[1mOptions:\x1b[0m
    -n, --count <n>     Number of rolls (default: 1)
    -s, --sum           Show sum only
    -v, --verbose       Show all rolls
    --stats             Show statistics
    --min <n>           Minimum result
    --max <n>           Maximum result
    -h, --help          Show this help

  \x1b[1mExamples:\x1b[0m
    diceroll d6
    diceroll 2d6
    diceroll 4d6+2
    diceroll d20 advantage
    diceroll d20 disadvantage
    diceroll d6 -n 10 --stats
    diceroll d20 -v
`);
}

// --- Parse dice notation ---
function parseNotation(input) {
  const str = input.trim().toLowerCase();

  // Simple number (sides)
  if (/^\d+$/.test(str)) {
    return { count: 1, sides: parseInt(str), modifier: 0, advantage: false, disadvantage: false };
  }

  // Advantage/disadvantage
  let advantage = false;
  let disadvantage = false;
  let notation = str;

  if (str.includes('advantage')) {
    advantage = true;
    notation = str.replace('advantage', '').trim();
  } else if (str.includes('disadvantage')) {
    disadvantage = true;
    notation = str.replace('disadvantage', '').trim();
  }

  // Parse notation: NdS+M or NdS-M
  const match = notation.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
  if (!match) {
    throw new Error(`Invalid dice notation: ${input}`);
  }

  return {
    count: parseInt(match[1]) || 1,
    sides: parseInt(match[2]),
    modifier: parseInt(match[3]) || 0,
    advantage,
    disadvantage,
  };
}

// --- Roll dice ---
function rollDice(sides) {
  return randomInt(1, sides + 1);
}

// --- Execute roll ---
function executeRoll(notation) {
  const { count, sides, modifier, advantage, disadvantage } = notation;

  if (sides < 1) throw new Error('Invalid number of sides');
  if (count < 1) throw new Error('Invalid dice count');
  if (count > 1000) throw new Error('Too many dice (max 1000)');

  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDice(sides));
  }

  let selectedRolls = [...rolls];
  let dropped = [];

  if (advantage && count >= 2) {
    const max = Math.max(...rolls);
    selectedRolls = [max];
    dropped = rolls.filter((r, i) => i !== rolls.indexOf(max));
  } else if (disadvantage && count >= 2) {
    const min = Math.min(...rolls);
    selectedRolls = [min];
    dropped = rolls.filter((r, i) => i !== rolls.indexOf(min));
  }

  const sum = selectedRolls.reduce((a, b) => a + b, 0) + modifier;

  return {
    notation,
    rolls,
    selectedRolls,
    dropped,
    modifier,
    sum: Math.max(0, sum),
  };
}

// --- Display ---
function displayRoll(result, verbose = false) {
  const { notation, rolls, selectedRolls, dropped, modifier, sum } = result;

  let diceStr = '';
  if (notation.count > 1 || notation.advantage || notation.disadvantage) {
    diceStr = `${notation.count}d${notation.sides}`;
  } else {
    diceStr = `d${notation.sides}`;
  }

  if (modifier > 0) diceStr += `+${modifier}`;
  if (modifier < 0) diceStr += `${modifier}`;

  // Color the sum
  let sumColor = C.bold;
  if (sum === notation.sides * notation.count + modifier) sumColor = C.green; // Max
  if (sum === notation.count + modifier) sumColor = C.red; // Min

  let rollStr = '';
  if (verbose || notation.advantage || notation.disadvantage) {
    const rollParts = selectedRolls.map(r => {
      if (r === notation.sides) return `${C.green}${r}${C.reset}`;
      if (r === 1) return `${C.red}${r}${C.reset}`;
      return `${r}`;
    });
    const dropParts = dropped.map(r => `${C.dim}${r}${C.reset}`);
    rollStr = ` [${[...rollParts, ...dropParts].join(', ')}]`;
  }

  console.log(`  ${C.dim}${diceStr}${C.reset} = ${sumColor}${sum}${C.reset}${rollStr}`);
}

function displayStats(results) {
  const sums = results.map(r => r.sum);
  const min = Math.min(...sums);
  const max = Math.max(...sums);
  const avg = (sums.reduce((a, b) => a + b, 0) / sums.length).toFixed(1);
  const median = sums.sort((a, b) => a - b)[Math.floor(sums.length / 2)];

  console.log(`\n  ${C.bold}Statistics${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(20)}${C.reset}`);
  console.log(`  ${C.dim}Rolls:${C.reset}   ${sums.length}`);
  console.log(`  ${C.dim}Min:${C.reset}     ${C.red}${min}${C.reset}`);
  console.log(`  ${C.dim}Max:${C.reset}     ${C.green}${max}${C.reset}`);
  console.log(`  ${C.dim}Avg:${C.reset}     ${avg}`);
  console.log(`  ${C.dim}Median:${C.reset}  ${median}`);
  console.log();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let notation = 'd6';
  let count = 1;
  let sumOnly = false;
  let verbose = false;
  let stats = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--count') {
      count = parseInt(args[++i]) || 1;
    } else if (arg === '-s' || arg === '--sum') {
      sumOnly = true;
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (arg === '--stats') {
      stats = true;
    } else if (!arg.startsWith('-')) {
      notation = arg;
    }
  }

  return { notation, count, sumOnly, verbose, stats };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  try {
    const parsed = parseNotation(opts.notation);

    console.log();

    if (opts.stats) {
      const results = [];
      for (let i = 0; i < opts.count; i++) {
        results.push(executeRoll(parsed));
      }
      results.forEach(r => displayRoll(r, opts.verbose));
      displayStats(results);
    } else if (opts.sumOnly) {
      for (let i = 0; i < opts.count; i++) {
        const result = executeRoll(parsed);
        console.log(`  ${result.sum}`);
      }
      console.log();
    } else {
      for (let i = 0; i < opts.count; i++) {
        const result = executeRoll(parsed);
        displayRoll(result, opts.verbose);
      }
      console.log();
    }
  } catch (err) {
    console.error(`\n  ${C.red}Error:${C.reset} ${err.message}\n`);
    process.exit(1);
  }
}

main();
