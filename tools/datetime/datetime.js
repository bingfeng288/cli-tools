#!/usr/bin/env node

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
  \x1b[1mdatetime\x1b[0m - Date/time utility

  \x1b[1mUsage:\x1b[0m
    datetime [options]
    datetime format <date> [format]
    datetime parse <string>
    datetime add <date> <amount> <unit>
    datetime diff <date1> <date2>
    datetime tz <date> <timezone>

  \x1b[1mCommands:\x1b[0m
    now                     Show current date/time
    format <date> [format]  Format a date
    parse <string>          Parse a date string
    add <date> <amt> <unit> Add to a date
    diff <date1> <date2>    Difference between dates
    tz <date> <timezone>    Convert timezone

  \x1b[1mFormat Tokens:\x1b[0m
    YYYY    Year (4 digits)
    YY      Year (2 digits)
    MM      Month (01-12)
    DD      Day (01-31)
    HH      Hour (00-23)
    mm      Minute (00-59)
    ss      Second (00-59)
    dddd    Day name (Monday)
    ddd     Day short (Mon)
    MMM     Month short (Jan)
    MMMM    Month full (January)

  \x1b[1mUnits:\x1b[0m
    years, months, weeks, days, hours, minutes, seconds

  \x1b[1mOptions:\x1b[0m
    -f, --format <fmt>    Output format
    -u, --utc             Use UTC
    -v, --verbose         Show verbose output
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    datetime now
    datetime format 2024-01-15 "YYYY-MM-DD"
    datetime add 2024-01-15 30 days
    datetime diff 2024-01-01 2024-12-31
    datetime tz 2024-01-15T12:00:00Z "America/New_York"
`);
}

// --- Format date ---
function formatDate(date, format) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }

  const tokens = {
    'YYYY': d.getFullYear(),
    'YY': String(d.getFullYear()).slice(-2),
    'MM': String(d.getMonth() + 1).padStart(2, '0'),
    'DD': String(d.getDate()).padStart(2, '0'),
    'HH': String(d.getHours()).padStart(2, '0'),
    'mm': String(d.getMinutes()).padStart(2, '0'),
    'ss': String(d.getSeconds()).padStart(2, '0'),
    'dddd': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()],
    'ddd': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
    'MMMM': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getMonth()],
    'MMM': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()],
  };

  let result = format;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replace(new RegExp(token, 'g'), value);
  }

  return result;
}

// --- Parse date string ---
function parseDate(str) {
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    throw new Error(`Cannot parse date: ${str}`);
  }
  return d;
}

// --- Add to date ---
function addToDate(date, amount, unit) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }

  const n = parseInt(amount);
  if (isNaN(n)) {
    throw new Error(`Invalid amount: ${amount}`);
  }

  switch (unit.toLowerCase()) {
    case 'year':
    case 'years':
      d.setFullYear(d.getFullYear() + n);
      break;
    case 'month':
    case 'months':
      d.setMonth(d.getMonth() + n);
      break;
    case 'week':
    case 'weeks':
      d.setDate(d.getDate() + n * 7);
      break;
    case 'day':
    case 'days':
      d.setDate(d.getDate() + n);
      break;
    case 'hour':
    case 'hours':
      d.setHours(d.getHours() + n);
      break;
    case 'minute':
    case 'minutes':
      d.setMinutes(d.getMinutes() + n);
      break;
    case 'second':
    case 'seconds':
      d.setSeconds(d.getSeconds() + n);
      break;
    default:
      throw new Error(`Unknown unit: ${unit}`);
  }

  return d;
}

// --- Diff dates ---
function diffDates(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  if (isNaN(d1.getTime())) throw new Error(`Invalid date: ${date1}`);
  if (isNaN(d2.getTime())) throw new Error(`Invalid date: ${date2}`);

  const diffMs = d2 - d1;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  return {
    milliseconds: diffMs,
    seconds: diffSec,
    minutes: diffMin,
    hours: diffHour,
    days: diffDay,
    weeks: diffWeek,
    months: diffMonth,
    years: diffYear,
    absolute: Math.abs(diffMs),
  };
}

// --- Relative time ---
function relativeTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }

  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 0) {
    // Future
    const absSec = Math.abs(diffSec);
    const absMin = Math.abs(diffMin);
    const absHour = Math.abs(diffHour);
    const absDay = Math.abs(diffDay);

    if (absSec < 60) return `in ${absSec} seconds`;
    if (absMin < 60) return `in ${absMin} minutes`;
    if (absHour < 24) return `in ${absHour} hours`;
    if (absDay < 30) return `in ${absDay} days`;
    return `in ${Math.floor(absDay / 30)} months`;
  } else {
    // Past
    if (diffSec < 60) return `${diffSec} seconds ago`;
    if (diffMin < 60) return `${diffMin} minutes ago`;
    if (diffHour < 24) return `${diffHour} hours ago`;
    if (diffDay < 30) return `${diffDay} days ago`;
    return `${Math.floor(diffDay / 30)} months ago`;
  }
}

// --- Convert timezone ---
function convertTimezone(date, timezone) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }

  try {
    return d.toLocaleString('en-US', { timeZone: timezone });
  } catch (err) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

// --- Show current time ---
function showNow(options = {}) {
  const { format = null, utc = false, verbose = false } = options;
  const now = new Date();

  if (format) {
    console.log(`  ${formatDate(now, format)}`);
    return;
  }

  console.log();
  console.log(`  ${C.bold}Current Date/Time${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);

  if (utc) {
    console.log(`  ${C.cyan}UTC:${C.reset}       ${now.toISOString()}`);
  } else {
    console.log(`  ${C.cyan}Local:${C.reset}     ${now.toLocaleString()}`);
    console.log(`  ${C.cyan}ISO:${C.reset}       ${now.toISOString()}`);
    console.log(`  ${C.cyan}Unix:${C.reset}      ${Math.floor(now.getTime() / 1000)}`);
  }

  if (verbose) {
    console.log(`  ${C.cyan}Timezone:${C.reset}  ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    console.log(`  ${C.cyan}UTC Offset:${C.reset} ${now.getTimezoneOffset()} minutes`);
  }

  console.log();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let command = null;
  let format = null;
  let utc = false;
  let verbose = false;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-f' || arg === '--format') {
      format = args[++i];
    } else if (arg === '-u' || arg === '--utc') {
      utc = true;
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (!arg.startsWith('-')) {
      if (!command) {
        command = arg;
      } else {
        positional.push(arg);
      }
    }
  }

  if (!command) command = 'now';

  return { command, format, utc, verbose, positional };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  try {
    switch (opts.command) {
      case 'now':
        showNow(opts);
        break;

      case 'format':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: datetime format <date> [format]`);
          process.exit(1);
        }
        const fmt = opts.positional[1] || opts.format || 'YYYY-MM-DD HH:mm:ss';
        console.log(`  ${formatDate(opts.positional[0], fmt)}`);
        break;

      case 'parse':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: datetime parse <string>`);
          process.exit(1);
        }
        const parsed = parseDate(opts.positional[0]);
        console.log(`  ${C.bold}Parsed:${C.reset} ${parsed.toISOString()}`);
        console.log(`  ${C.bold}Local:${C.reset}  ${parsed.toLocaleString()}`);
        console.log(`  ${C.bold}Unix:${C.reset}   ${Math.floor(parsed.getTime() / 1000)}`);
        break;

      case 'add':
        if (opts.positional.length < 3) {
          console.error(`  ${C.red}Error:${C.reset} Usage: datetime add <date> <amount> <unit>`);
          process.exit(1);
        }
        const added = addToDate(opts.positional[0], opts.positional[1], opts.positional[2]);
        console.log(`  ${formatDate(added, opts.format || 'YYYY-MM-DD HH:mm:ss')}`);
        break;

      case 'diff':
        if (opts.positional.length < 2) {
          console.error(`  ${C.red}Error:${C.reset} Usage: datetime diff <date1> <date2>`);
          process.exit(1);
        }
        const diff = diffDates(opts.positional[0], opts.positional[1]);
        console.log();
        console.log(`  ${C.bold}Difference${C.reset}`);
        console.log(`  ${C.dim}${'─'.repeat(30)}${C.reset}`);
        console.log(`  ${C.cyan}Days:${C.reset}        ${diff.days}`);
        console.log(`  ${C.cyan}Hours:${C.reset}       ${diff.hours}`);
        console.log(`  ${C.cyan}Minutes:${C.reset}     ${diff.minutes}`);
        console.log(`  ${C.cyan}Seconds:${C.reset}     ${diff.seconds}`);
        console.log(`  ${C.cyan}Milliseconds:${C.reset} ${diff.milliseconds}`);
        console.log();
        break;

      case 'tz':
      case 'timezone':
        if (opts.positional.length < 2) {
          console.error(`  ${C.red}Error:${C.reset} Usage: datetime tz <date> <timezone>`);
          process.exit(1);
        }
        const converted = convertTimezone(opts.positional[0], opts.positional[1]);
        console.log(`  ${converted}`);
        break;

      case 'ago':
        if (opts.positional.length < 1) {
          console.error(`  ${C.red}Error:${C.reset} Usage: datetime ago <date>`);
          process.exit(1);
        }
        console.log(`  ${relativeTime(opts.positional[0])}`);
        break;

      default:
        // Try to format as date
        try {
          const d = new Date(opts.command);
          if (!isNaN(d.getTime())) {
            console.log(`  ${formatDate(d, opts.format || 'YYYY-MM-DD HH:mm:ss')}`);
          } else {
            console.error(`  ${C.red}Error:${C.reset} Unknown command: ${opts.command}`);
            showHelp();
            process.exit(1);
          }
        } catch {
          console.error(`  ${C.red}Error:${C.reset} Unknown command: ${opts.command}`);
          showHelp();
          process.exit(1);
        }
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }
}

main();
