#!/usr/bin/env node

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
};

// --- Constants ---
const CONSTS = {
  pi: Math.PI,
  e: Math.E,
  phi: 1.618033988749895,
  sqrt2: Math.SQRT2,
  sqrt1_2: Math.SQRT1_2,
  ln2: Math.LN2,
  ln10: Math.LN10,
};

// --- Help ---
function showHelp() {
  console.log(`
  ${C.bold}calccli${C.reset} - CLI calculator

  ${C.bold}Usage:${C.reset}
    calccli <expression>
    calccli --interactive
    calccli --convert <value> <from> <to>
    calccli --history

  ${C.bold}Operators:${C.reset}
    +  -  *  /  %  ** (power)
    ( ) for grouping

  ${C.bold}Functions:${C.reset}
    sin(x)  cos(x)  tan(x)  asin(x)  acos(x)  atan(x)
    sqrt(x) cbrt(x) abs(x)  ceil(x)  floor(x) round(x)
    log(x)  log2(x) log10(x)
    exp(x)  pow(x,y) min(x,y) max(x,y)
    factorial(n)  random()

  ${C.bold}Constants:${C.reset}
    pi  e  phi  sqrt2  ln2  ln10

  ${C.bold}Unit Conversions:${C.reset}
    --convert <value> <from> <to>
    Length: mm cm m km in ft yd mi
    Weight: mg g kg lb oz
    Temp: c f k
    Data: b kb mb gb tb

  ${C.bold}Options:${C.reset}
    -i, --interactive         Interactive mode
    -h, --history             Show calculation history
    -f, --format              Format with commas
    --deg                     Use degrees (default: radians)
    --help                    Show this help

  ${C.bold}Examples:${C.reset}
    calccli "2 + 3 * 4"
    calccli "sqrt(16) + 2**3"
    calccli "sin(pi/2)"
    calccli "factorial(10)"
    calccli --convert 100 km mi
    calccli --convert 72 f c
`);
}

// --- Unit conversions ---
const CONVERSIONS = {
  // Length (base: meters)
  length: {
    mm: 0.001, cm: 0.01, m: 1, km: 1000,
    in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344,
  },
  // Weight (base: grams)
  weight: {
    mg: 0.001, g: 1, kg: 1000, lb: 453.592, oz: 28.3495,
  },
  // Temperature (special handling)
  temp: { c: 'c', f: 'f', k: 'k' },
  // Data (base: bytes)
  data: {
    b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4,
  },
};

function getUnitCategory(unit) {
  for (const [cat, units] of Object.entries(CONVERSIONS)) {
    if (unit in units) return cat;
  }
  return null;
}

function convert(value, from, to) {
  from = from.toLowerCase();
  to = to.toLowerCase();

  const catFrom = getUnitCategory(from);
  const catTo = getUnitCategory(to);

  if (!catFrom || !catTo || catFrom !== catTo) {
    throw new Error(`Cannot convert ${from} to ${to}`);
  }

  if (catFrom === 'temp') {
    // Convert to Celsius first
    let celsius;
    if (from === 'c') celsius = value;
    else if (from === 'f') celsius = (value - 32) * 5 / 9;
    else celsius = value - 273.15;

    // Convert from Celsius to target
    if (to === 'c') return celsius;
    if (to === 'f') return celsius * 9 / 5 + 32;
    return celsius + 273.15;
  }

  const units = CONVERSIONS[catFrom];
  const baseValue = value * units[from];
  return baseValue / units[to];
}

// --- Math functions ---
const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  log: Math.log,
  log2: Math.log2,
  log10: Math.log10,
  exp: Math.exp,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
  random: () => Math.random(),
  factorial: (n) => {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  },
};

// --- Evaluate expression ---
function evaluate(expr, useDeg = false) {
  // Replace constants
  let processed = expr;
  for (const [name, value] of Object.entries(CONSTS)) {
    processed = processed.replace(new RegExp(`\\b${name}\\b`, 'g'), value);
  }

  // Replace functions
  for (const [name, fn] of Object.entries(FUNCTIONS)) {
    processed = processed.replace(new RegExp(`\\b${name}\\b`, 'g'), `__fn_${name}`);
  }

  // Handle degree mode for trig functions
  const wrapAngle = (v) => useDeg ? v * Math.PI / 180 : v;
  const unwrapAngle = (v) => useDeg ? v * 180 / Math.PI : v;

  // Create safe evaluation context
  const context = {};
  for (const [name, fn] of Object.entries(FUNCTIONS)) {
    if (['sin', 'cos', 'tan'].includes(name)) {
      context[`__fn_${name}`] = (x) => fn(wrapAngle(x));
    } else if (['asin', 'acos', 'atan'].includes(name)) {
      context[`__fn_${name}`] = (x) => unwrapAngle(fn(x));
    } else {
      context[`__fn_${name}`] = fn;
    }
  }

  // Build evaluation string
  let evalStr = processed;
  for (const name of Object.keys(context)) {
    evalStr = evalStr.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `context["${name}"]`);
  }

  // Replace ^ with **
  evalStr = evalStr.replace(/\^/g, '**');

  // Evaluate
  try {
    const result = new Function('context', `"use strict"; return (${evalStr})`)(context);
    return result;
  } catch (err) {
    throw new Error(`Invalid expression: ${err.message}`);
  }
}

// --- Format number ---
function formatNumber(num, useCommas = false) {
  if (typeof num !== 'number') return String(num);
  if (Number.isInteger(num) && Math.abs(num) < 1e15) {
    return useCommas ? num.toLocaleString() : num.toString();
  }
  // Handle very large or very small numbers
  if (Math.abs(num) >= 1e15 || (Math.abs(num) < 1e-6 && num !== 0)) {
    return num.toExponential(10);
  }
  // Regular decimal
  const str = num.toPrecision(12);
  return useCommas ? parseFloat(str).toLocaleString() : parseFloat(str).toString();
}

// --- History ---
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HISTORY_FILE = join(homedir(), '.calccli_history');

function loadHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(-100)));
}

// --- Interactive mode ---
function interactive(useDeg, useCommas) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${C.cyan}calc>${C.reset} `,
  });

  console.log(`\n  ${C.bold}calccli interactive mode${C.reset} (type 'quit' to exit)\n`);
  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();
    if (input === 'quit' || input === 'exit') {
      rl.close();
      return;
    }
    if (input === 'history') {
      const history = loadHistory();
      history.slice(-10).forEach((h, i) => {
        console.log(`  ${C.dim}${h.expr}${C.reset} = ${C.green}${h.result}${C.reset}`);
      });
      rl.prompt();
      return;
    }
    if (!input) {
      rl.prompt();
      return;
    }

    try {
      const result = evaluate(input, useDeg);
      const formatted = formatNumber(result, useCommas);
      console.log(`  ${C.green}${formatted}${C.reset}`);

      const history = loadHistory();
      history.push({ expr: input, result: formatted, time: new Date().toISOString() });
      saveHistory(history);
    } catch (err) {
      console.log(`  ${C.yellow}${err.message}${C.reset}`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n  Goodbye!\n');
    process.exit(0);
  });
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  let expression = null;
  let interactiveMode = false;
  let showHist = false;
  let useCommas = false;
  let useDeg = false;
  let convertArgs = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-i' || arg === '--interactive') {
      interactiveMode = true;
    } else if (arg === '-h' || arg === '--history') {
      showHist = true;
    } else if (arg === '-f' || arg === '--format') {
      useCommas = true;
    } else if (arg === '--deg') {
      useDeg = true;
    } else if (arg === '--convert') {
      convertArgs = [args[++i], args[++i], args[++i]];
    } else if (!expression) {
      expression = arg;
    }
  }

  return { expression, interactiveMode, showHist, useCommas, useDeg, convertArgs };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  // Interactive mode
  if (opts.interactiveMode) {
    interactive(opts.useDeg, opts.useCommas);
    return;
  }

  // History
  if (opts.showHist) {
    const history = loadHistory();
    if (history.length === 0) {
      console.log(`\n  ${C.dim}No calculation history${C.reset}\n`);
    } else {
      console.log(`\n  ${C.bold}Calculation History${C.reset}\n`);
      history.slice(-20).forEach(h => {
        console.log(`  ${C.dim}${h.expr}${C.reset} = ${C.green}${h.result}${C.reset}`);
      });
      console.log();
    }
    return;
  }

  // Unit conversion
  if (opts.convertArgs) {
    const [value, from, to] = opts.convertArgs;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      console.error('  Error: Invalid number');
      process.exit(1);
    }
    const result = convert(numValue, from, to);
    console.log(`\n  ${formatNumber(numValue, opts.useCommas)} ${from} = ${C.green}${formatNumber(result, opts.useCommas)} ${to}${C.reset}\n`);
    return;
  }

  // Expression evaluation
  if (!opts.expression) {
    showHelp();
    return;
  }

  try {
    const result = evaluate(opts.expression, opts.useDeg);
    const formatted = formatNumber(result, opts.useCommas);
    console.log(`\n  ${opts.expression} = ${C.green}${formatted}${C.reset}\n`);

    const history = loadHistory();
    history.push({ expr: opts.expression, result: formatted, time: new Date().toISOString() });
    saveHistory(history);
  } catch (err) {
    console.error(`\n  ${C.yellow}Error:${C.reset} ${err.message}\n`);
    process.exit(1);
  }
}

main();
