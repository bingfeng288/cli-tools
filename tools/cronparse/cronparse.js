#!/usr/bin/env node

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// --- Help ---
function showHelp() {
  console.log(`
  ${C.bold}cronparse${C.reset} - Cron expression parser and explorer

  ${C.bold}Usage:${C.reset}
    cronparse <expression> [options]
    cronparse --preset <name>
    cronparse --list

  ${C.bold}Options:${C.reset}
    -n, --next <count>        Show next N executions (default: 10)
    -d, --describe            Human-readable description
    -v, --validate            Validate expression only
    -p, --preset <name>       Use a common preset
    -l, --list                List all presets
    -h, --help                Show this help

  ${C.bold}Cron Format:${C.reset}
    ┌───────── minute (0-59)
    │ ┌───────── hour (0-23)
    │ │ ┌───────── day of month (1-31)
    │ │ │ ┌───────── month (1-12)
    │ │ │ │ ┌───────── day of week (0-6, Sun=0)
    │ │ │ │ │
    * * * * *

  ${C.bold}Special Characters:${C.reset}
    *       Any value
    ,       List (1,3,5)
    -       Range (1-5)
    /       Step (*/5)
    L       Last day of month
    W       Nearest weekday
    #       Nth day of week (5#3 = third Friday)

  ${C.bold}Examples:${C.reset}
    cronparse '*/15 * * * *'           Every 15 minutes
    cronparse '0 9 * * 1-5'           Weekdays at 9am
    cronparse '0 0 1 * *'             First of every month
    cronparse '0 */2 * * *'           Every 2 hours
    cronparse -p daily                 Use preset
    cronparse -l                       List presets
`);
}

// --- Presets ---
const PRESETS = {
  'minutely': '* * * * *',
  'every5min': '*/5 * * * *',
  'every15min': '*/15 * * * *',
  'every30min': '*/30 * * * *',
  'hourly': '0 * * * *',
  'every2hours': '0 */2 * * *',
  'every6hours': '0 */6 * * *',
  'every12hours': '0 */12 * * *',
  'daily': '0 0 * * *',
  'daily9am': '0 9 * * *',
  'daily6pm': '0 18 * * *',
  'weekdays': '0 9 * * 1-5',
  'weekends': '0 10 * * 0,6',
  'weekly': '0 0 * * 0',
  'weeklymon': '0 0 * * 1',
  'monthly': '0 0 1 * *',
  'quarterly': '0 0 1 1,4,7,10 *',
  'yearly': '0 0 1 1 *',
  'midnight': '0 0 * * *',
  'noon': '0 12 * * *',
};

// --- Parse field ---
function parseField(field, min, max, names = {}) {
  const values = new Set();

  for (const part of field.split(',')) {
    // Handle step
    const [rangePart, stepStr] = part.split('/');
    const step = stepStr ? parseInt(stepStr) : 1;

    if (rangePart === '*') {
      for (let i = min; i <= max; i += step) values.add(i);
    } else if (rangePart.includes('-')) {
      const [startStr, endStr] = rangePart.split('-');
      let start = names[startStr.toLowerCase()] ?? parseInt(startStr);
      let end = names[endStr.toLowerCase()] ?? parseInt(endStr);
      for (let i = start; i <= end; i += step) values.add(i);
    } else {
      let val = names[rangePart.toLowerCase()] ?? parseInt(rangePart);
      values.add(val);
    }
  }

  return [...values].sort((a, b) => a - b);
}

// --- Validate ---
function validate(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    return { valid: false, error: `Expected 5-6 fields, got ${parts.length}` };
  }

  const fields = [
    { name: 'minute', min: 0, max: 59 },
    { name: 'hour', min: 0, max: 23 },
    { name: 'day of month', min: 1, max: 31 },
    { name: 'month', min: 1, max: 12, names: { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 } },
    { name: 'day of week', min: 0, max: 6, names: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } },
  ];

  for (let i = 0; i < 5; i++) {
    const field = parts[i];
    const { name, min, max } = fields[i];
    const cleanField = field.replace(/[LW#]/g, '*');

    try {
      const values = parseField(cleanField, min, max, fields[i].names || {});
      for (const v of values) {
        if (v < min || v > max) {
          return { valid: false, error: `${name}: value ${v} out of range [${min}-${max}]` };
        }
      }
    } catch {
      return { valid: false, error: `${name}: invalid field '${field}'` };
    }
  }

  return { valid: true };
}

// --- Describe ---
function describe(expr) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return 'Invalid expression';

  const [minute, hour, dom, month, dow] = parts;

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function describeField(field, singular, plural, names = {}) {
    if (field === '*') return `every ${singular}`;

    // Step
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2));
      return `every ${step} ${step === 1 ? singular : plural}`;
    }

    // Range with step
    if (field.includes('-') && field.includes('/')) {
      const [range, step] = field.split('/');
      const [start, end] = range.split('-');
      return `every ${step} ${plural} from ${start} through ${end}`;
    }

    // List
    if (field.includes(',')) {
      const items = field.split(',').map(v => names[v.toLowerCase()] || v);
      return `${items.join(', ')}`;
    }

    // Range
    if (field.includes('-')) {
      const [start, end] = field.split('-');
      const s = names[start.toLowerCase()] || start;
      const e = names[end.toLowerCase()] || end;
      return `${s} through ${e}`;
    }

    return names[field.toLowerCase()] || field;
  }

  const monthDesc = describeField(month, 'month', 'months', {
    jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June',
    jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December',
  });

  const dowDesc = describeField(dow, 'day of the week', 'days of the week', {
    sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday',
  });

  let result = 'At ';

  // Time
  if (minute === '0' && hour === '*') {
    result += 'the start of every hour';
  } else if (minute === '0' && hour !== '*') {
    if (hour.startsWith('*/')) {
      result += `the start of every ${hour.slice(2)} hours`;
    } else {
      result += `${hour.padStart(2, '0')}:00`;
    }
  } else if (minute !== '*' && hour !== '*') {
    result += `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  } else if (minute.startsWith('*/')) {
    result += `every ${minute.slice(2)} minutes`;
  } else {
    result += `minute ${minute}`;
  }

  // Day of month
  if (dom !== '*') {
    if (dom.startsWith('*/')) {
      result += `, every ${dom.slice(2)} days`;
    } else {
      result += `, on day ${dom}`;
    }
  }

  // Month
  if (month !== '*') {
    result += ` in ${monthDesc}`;
  }

  // Day of week
  if (dow !== '*') {
    result += ` on ${dowDesc}`;
  }

  return result;
}

// --- Get next executions ---
function getNextExecutions(expr, count = 10) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return [];

  const [minField, hourField, domField, monthField, dowField] = parts;

  const minutes = parseField(minField, 0, 59);
  const hours = parseField(hourField, 0, 23);
  const doms = parseField(domField, 1, 31);
  const months = parseField(monthField, 1, 12, { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 });
  const dows = parseField(dowField, 0, 6, { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 });

  const results = [];
  const now = new Date();
  const current = new Date(now);
  current.setSeconds(0);
  current.setMilliseconds(0);
  current.setMinutes(current.getMinutes() + 1); // Start from next minute

  const maxIterations = 525960; // ~1 year of minutes
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    iterations++;
    const m = current.getMinutes();
    const h = current.getHours();
    const d = current.getDate();
    const mo = current.getMonth() + 1;
    const dw = current.getDay();

    if (minutes.includes(m) && hours.includes(h) && doms.includes(d) && months.includes(mo) && dows.includes(dw)) {
      results.push(new Date(current));
    }

    current.setMinutes(current.getMinutes() + 1);
  }

  return results;
}

// --- Display ---
function displayResults(expr, executions) {
  const now = new Date();

  console.log();
  console.log(`  ${C.bold}Expression:${C.reset}  ${C.cyan}${expr}${C.reset}`);
  console.log(`  ${C.bold}Description:${C.reset} ${describe(expr)}`);
  console.log(`  ${C.bold}Current time:${C.reset} ${formatDate(now)}`);
  console.log();

  if (executions.length === 0) {
    console.log(`  ${C.yellow}No upcoming executions found${C.reset}`);
    return;
  }

  console.log(`  ${C.bold}Next ${executions.length} executions:${C.reset}\n`);

  executions.forEach((date, i) => {
    const diff = date - now;
    const diffMin = Math.round(diff / 60000);
    const diffStr = formatDiff(diffMin);
    const marker = i === 0 ? `${C.green}→ next${C.reset}   ` : `         `;
    console.log(`  ${marker}${C.bold}${formatDate(date)}${C.reset}  ${C.dim}(${diffStr})${C.reset}`);
  });
  console.log();
}

function formatDate(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${y}-${mo}-${d} ${h}:${m} (${days[date.getDay()]})`;
}

function formatDiff(minutes) {
  if (minutes < 60) return `in ${minutes}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `in ${h}h ${m}m`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return `in ${d}d ${h}h`;
}

function listPresets() {
  console.log(`\n  ${C.bold}Available Presets:${C.reset}\n`);
  const maxName = Math.max(...Object.keys(PRESETS).map(n => n.length));
  Object.entries(PRESETS).forEach(([name, expr]) => {
    console.log(`  ${C.green}${name.padEnd(maxName)}${C.reset}  ${C.cyan}${expr}${C.reset}  ${C.dim}${describe(expr)}${C.reset}`);
  });
  console.log();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let expression = null;
  let nextCount = 10;
  let validateOnly = false;
  let listMode = false;
  let presetName = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--next') {
      nextCount = parseInt(args[++i]) || 10;
    } else if (arg === '-v' || arg === '--validate') {
      validateOnly = true;
    } else if (arg === '-l' || arg === '--list') {
      listMode = true;
    } else if (arg === '-p' || arg === '--preset') {
      presetName = args[++i];
    } else if (!arg.startsWith('-')) {
      expression = arg;
    }
  }

  return { expression, nextCount, validateOnly, listMode, presetName };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (opts.listMode) {
    listPresets();
    return;
  }

  if (opts.presetName) {
    const preset = PRESETS[opts.presetName.toLowerCase()];
    if (!preset) {
      console.error(`  ${C.red}Unknown preset:${C.reset} ${opts.presetName}`);
      console.error(`  ${C.dim}Use --list to see available presets${C.reset}`);
      process.exit(1);
    }
    opts.expression = preset;
  }

  if (!opts.expression) {
    console.error('  Error: No cron expression provided');
    process.exit(1);
  }

  // Validate
  const result = validate(opts.expression);
  if (!result.valid) {
    console.error(`  ${C.red}Invalid:${C.reset} ${result.error}`);
    process.exit(1);
  }

  if (opts.validateOnly) {
    console.log(`  ${C.green}✓ Valid${C.reset} cron expression: ${C.cyan}${opts.expression}${C.reset}`);
    return;
  }

  const executions = getNextExecutions(opts.expression, opts.nextCount);
  displayResults(opts.expression, executions);
}

main();
