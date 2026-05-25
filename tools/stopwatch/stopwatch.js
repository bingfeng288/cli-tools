#!/usr/bin/env node

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  clear: '\x1b[2J\x1b[H',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mstopwatch\x1b[0m - CLI stopwatch and timer

  \x1b[1mUsage:\x1b[0m
    stopwatch [options]
    stopwatch timer <duration>
    stopwatch pomodoro

  \x1b[1mStopwatch Controls:\x1b[0m
    Enter     Start/Stop
    l         Lap
    r         Reset
    q         Quit

  \x1b[1mOptions:\x1b[0m
    --countdown <duration>    Countdown timer (e.g., 5m, 1h30m, 30s)
    --pomodoro                Pomodoro timer (25m work, 5m break)
    --work <duration>         Work duration for pomodoro (default: 25m)
    --break <duration>        Break duration for pomodoro (default: 5m)
    -h, --help                Show this help

  \x1b[1mDuration Format:\x1b[0m
    30s     30 seconds
    5m      5 minutes
    1h      1 hour
    1h30m   1 hour 30 minutes
    90m     90 minutes

  \x1b[1mExamples:\x1b[0m
    stopwatch
    stopwatch --countdown 5m
    stopwatch --pomodoro
    stopwatch --pomodoro --work 30m --break 10m
`);
}

// --- Parse duration ---
function parseDuration(str) {
  let total = 0;
  const match = str.match(/(\d+)\s*h/);
  if (match) total += parseInt(match[1]) * 3600;
  const match2 = str.match(/(\d+)\s*m/);
  if (match2) total += parseInt(match2[1]) * 60;
  const match3 = str.match(/(\d+)\s*s/);
  if (match3) total += parseInt(match3[1]);
  if (total === 0 && /^\d+$/.test(str)) total = parseInt(str);
  return total;
}

// --- Format time ---
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

// --- Stopwatch ---
async function stopwatch() {
  let running = false;
  let startTime = 0;
  let elapsed = 0;
  let laps = [];

  const display = () => {
    const current = running ? elapsed + (Date.now() - startTime) : elapsed;
    const timeStr = formatTime(current);

    process.stdout.write(C.clear);
    console.log(`\n  ${C.bold}Stopwatch${C.reset}\n`);
    console.log(`  ${C.cyan}${C.bold}${timeStr}${C.reset}\n`);

    if (laps.length > 0) {
      console.log(`  ${C.bold}Laps:${C.reset}`);
      laps.forEach((lap, i) => {
        const lapTime = i === 0 ? lap : lap - laps[i - 1];
        console.log(`  ${C.dim}${i + 1}.${C.reset} ${formatTime(lap)}  ${C.dim}(+${formatTime(lapTime)})${C.reset}`);
      });
      console.log();
    }

    console.log(`  ${C.dim}Enter: Start/Stop | l: Lap | r: Reset | q: Quit${C.reset}`);
  };

  const handleInput = () => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', (key) => {
      if (key === 'q' || key === '\u0003') {
        console.log('\n  Goodbye!\n');
        process.exit(0);
      }

      if (key === '\r' || key === '\n') {
        if (running) {
          elapsed += Date.now() - startTime;
          running = false;
        } else {
          startTime = Date.now();
          running = true;
        }
      }

      if (key === 'l' && running) {
        const current = elapsed + (Date.now() - startTime);
        laps.push(current);
      }

      if (key === 'r') {
        running = false;
        elapsed = 0;
        laps = [];
      }

      display();
    });
  };

  display();
  handleInput();

  setInterval(display, 10);
}

// --- Countdown ---
async function countdown(duration) {
  const endTime = Date.now() + duration * 1000;
  let running = true;

  const display = () => {
    const remaining = Math.max(0, endTime - Date.now());
    const timeStr = formatTime(remaining);
    const progress = 1 - (remaining / (duration * 1000));

    const barWidth = 30;
    const filled = Math.round(progress * barWidth);
    const bar = C.green + '█'.repeat(filled) + C.dim + '░'.repeat(barWidth - filled) + C.reset;

    process.stdout.write(C.clear);
    console.log(`\n  ${C.bold}Countdown${C.reset}\n`);
    console.log(`  ${C.cyan}${C.bold}${timeStr}${C.reset}\n`);
    console.log(`  ${bar} ${Math.round(progress * 100)}%\n`);
    console.log(`  ${C.dim}Press Ctrl+C to cancel${C.reset}`);

    if (remaining <= 0) {
      running = false;
      console.log(`\n  ${C.green}${C.bold}Time's up!${C.reset}\n`);
      process.exit(0);
    }
  };

  const interval = setInterval(() => {
    if (running) display();
  }, 10);

  display();
}

// --- Pomodoro ---
async function pomodoro(workDuration, breakDuration) {
  let session = 1;
  let isWork = true;
  let endTime = Date.now() + workDuration * 1000;
  let running = true;

  const display = () => {
    const remaining = Math.max(0, endTime - Date.now());
    const timeStr = formatTime(remaining);
    const totalDuration = isWork ? workDuration : breakDuration;
    const progress = 1 - (remaining / (totalDuration * 1000));

    const barWidth = 30;
    const filled = Math.round(progress * barWidth);
    const color = isWork ? C.red : C.green;
    const bar = color + '█'.repeat(filled) + C.dim + '░'.repeat(barWidth - filled) + C.reset;

    const phase = isWork ? 'Work' : 'Break';
    const phaseColor = isWork ? C.red : C.green;

    process.stdout.write(C.clear);
    console.log(`\n  ${C.bold}Pomodoro${C.reset} ${C.dim}(Session ${session})${C.reset}\n`);
    console.log(`  ${phaseColor}${C.bold}${phase}${C.reset}\n`);
    console.log(`  ${C.cyan}${C.bold}${timeStr}${C.reset}\n`);
    console.log(`  ${bar} ${Math.round(progress * 100)}%\n`);
    console.log(`  ${C.dim}Press Ctrl+C to cancel${C.reset}`);

    if (remaining <= 0) {
      if (isWork) {
        console.log(`\n  ${C.green}Work session complete! Take a break.${C.reset}`);
        isWork = false;
        endTime = Date.now() + breakDuration * 1000;
      } else {
        console.log(`\n  ${C.yellow}Break over! Back to work.${C.reset}`);
        session++;
        isWork = true;
        endTime = Date.now() + workDuration * 1000;
      }
    }
  };

  const interval = setInterval(display, 10);
  display();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let mode = 'stopwatch';
  let countdownDuration = null;
  let workDuration = 25 * 60;
  let breakDuration = 5 * 60;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--countdown') {
      mode = 'countdown';
      countdownDuration = parseDuration(args[++i]);
    } else if (arg === '--pomodoro') {
      mode = 'pomodoro';
    } else if (arg === '--work') {
      workDuration = parseDuration(args[++i]);
    } else if (arg === '--break') {
      breakDuration = parseDuration(args[++i]);
    }
  }

  return { mode, countdownDuration, workDuration, breakDuration };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Clear screen
  process.stdout.write(C.clear);

  switch (opts.mode) {
    case 'stopwatch':
      await stopwatch();
      break;
    case 'countdown':
      if (!opts.countdownDuration) {
        console.error('  Error: No duration specified');
        process.exit(1);
      }
      await countdown(opts.countdownDuration);
      break;
    case 'pomodoro':
      await pomodoro(opts.workDuration, opts.breakDuration);
      break;
  }
}

main();
