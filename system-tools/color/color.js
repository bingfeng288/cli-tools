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
  \x1b[1mcolor\x1b[0m - Terminal color utility

  \x1b[1mUsage:\x1b[0m
    color <command> [options]

  \x1b[1mCommands:\x1b[0m
    ansi <code>             Show ANSI color code
    rgb <r> <g> <b>         Show RGB color
    hex <hex>               Show hex color
    preview <text>          Preview text with colors
    list                    List all ANSI colors
    theme <name>            Show color theme
    generate                Generate random color

  \x1b[1mOptions:\x1b[0m
    -b, --background    Use background color
    -t, --text <text>   Text to colorize
    -h, --help          Show this help

  \x1b[1mExamples:\x1b[0m
    color ansi 196
    color rgb 255 0 0
    color hex ff0000
    color preview "Hello World"
    color list
    color theme monokai
    color generate
`);
}

// --- ANSI color codes ---
const ANSI_COLORS = {
  // Standard colors (0-7)
  0: 'Black',
  1: 'Red',
  2: 'Green',
  3: 'Yellow',
  4: 'Blue',
  5: 'Magenta',
  6: 'Cyan',
  7: 'White',
  // Bright colors (8-15)
  8: 'Bright Black',
  9: 'Bright Red',
  10: 'Bright Green',
  11: 'Bright Yellow',
  12: 'Bright Blue',
  13: 'Bright Magenta',
  14: 'Bright Cyan',
  15: 'Bright White',
};

// --- Show ANSI color ---
function showAnsiColor(code, options = {}) {
  const { background = false, text = null } = options;
  const num = parseInt(code);

  if (isNaN(num) || num < 0 || num > 255) {
    console.error(`  ${C.red}Error:${C.reset} Invalid ANSI code: ${code} (must be 0-255)`);
    process.exit(1);
  }

  const prefix = background ? '\x1b[48;5;' : '\x1b[38;5;';
  const suffix = 'm';
  const reset = '\x1b[0m';

  const colorCode = `${prefix}${num}${suffix}`;
  const name = ANSI_COLORS[num] || `Color ${num}`;

  console.log();
  console.log(`  ${C.bold}ANSI Color: ${num}${C.reset}`);
  console.log(`  ${C.dim}Name:${C.reset} ${name}`);
  console.log(`  ${C.dim}Code:${C.reset} ${colorCode}`);
  console.log(`  ${C.dim}Escape:${C.reset} \\x1b[38;5;${num}m`);

  if (text) {
    console.log(`  ${C.dim}Preview:${C.reset} ${colorCode}${text}${reset}`);
  } else {
    console.log(`  ${C.dim}Preview:${C.reset} ${colorCode}████████${reset}`);
  }

  console.log();
}

// --- Show RGB color ---
function showRgbColor(r, g, b, options = {}) {
  const { background = false, text = null } = options;

  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    console.error(`  ${C.red}Error:${C.reset} RGB values must be 0-255`);
    process.exit(1);
  }

  const prefix = background ? '\x1b[48;2;' : '\x1b[38;2;';
  const suffix = 'm';
  const reset = '\x1b[0m';

  const colorCode = `${prefix}${r};${g};${b}${suffix}`;
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  console.log();
  console.log(`  ${C.bold}RGB Color: ${r}, ${g}, ${b}${C.reset}`);
  console.log(`  ${C.dim}Hex:${C.reset} ${hex}`);
  console.log(`  ${C.dim}Code:${C.reset} ${colorCode}`);
  console.log(`  ${C.dim}Escape:${C.reset} \\x1b[38;2;${r};${g};${b}m`);

  if (text) {
    console.log(`  ${C.dim}Preview:${C.reset} ${colorCode}${text}${reset}`);
  } else {
    console.log(`  ${C.dim}Preview:${C.reset} ${colorCode}████████${reset}`);
  }

  console.log();
}

// --- Show hex color ---
function showHexColor(hex, options = {}) {
  const { background = false, text = null } = options;

  // Remove # if present
  hex = hex.replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    console.error(`  ${C.red}Error:${C.reset} Invalid hex color: ${hex}`);
    process.exit(1);
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  showRgbColor(r, g, b, { background, text });
}

// --- Preview text with colors ---
function previewText(text) {
  console.log();
  console.log(`  ${C.bold}Color Preview:${C.reset} "${text}"\n`);

  // Standard colors
  console.log(`  ${C.dim}Standard Colors:${C.reset}`);
  for (let i = 0; i < 8; i++) {
    const code = `\x1b[38;5;${i}m`;
    const reset = '\x1b[0m';
    process.stdout.write(`  ${code}${text}${reset} `);
  }
  console.log('\n');

  // Bright colors
  console.log(`  ${C.dim}Bright Colors:${C.reset}`);
  for (let i = 8; i < 16; i++) {
    const code = `\x1b[38;5;${i}m`;
    const reset = '\x1b[0m';
    process.stdout.write(`  ${code}${text}${reset} `);
  }
  console.log('\n');

  // 256 colors (first 32)
  console.log(`  ${C.dim}256 Colors (first 32):${C.reset}`);
  for (let i = 16; i < 48; i++) {
    const code = `\x1b[38;5;${i}m`;
    const reset = '\x1b[0m';
    process.stdout.write(`  ${code}${text}${reset} `);
    if ((i - 16) % 8 === 7) console.log();
  }
  console.log();
}

// --- List all colors ---
function listColors() {
  console.log();
  console.log(`  ${C.bold}ANSI Colors${C.reset}\n`);

  // Standard colors
  console.log(`  ${C.dim}Standard Colors (0-7):${C.reset}`);
  for (let i = 0; i < 8; i++) {
    const code = `\x1b[38;5;${i}m`;
    const reset = '\x1b[0m';
    const name = ANSI_COLORS[i] || `Color ${i}`;
    process.stdout.write(`  ${code}██${reset} ${String(i).padStart(3)} ${name.padEnd(15)}`);
    if ((i + 1) % 4 === 0) console.log();
  }
  console.log('\n');

  // Bright colors
  console.log(`  ${C.dim}Bright Colors (8-15):${C.reset}`);
  for (let i = 8; i < 16; i++) {
    const code = `\x1b[38;5;${i}m`;
    const reset = '\x1b[0m';
    const name = ANSI_COLORS[i] || `Color ${i}`;
    process.stdout.write(`  ${code}██${reset} ${String(i).padStart(3)} ${name.padEnd(15)}`);
    if ((i - 8 + 1) % 4 === 0) console.log();
  }
  console.log('\n');

  // 256 colors
  console.log(`  ${C.dim}256 Colors (16-255):${C.reset}`);
  for (let i = 16; i < 256; i++) {
    const code = `\x1b[38;5;${i}m`;
    const reset = '\x1b[0m';
    process.stdout.write(`  ${code}██${reset}`);
    if ((i - 16 + 1) % 16 === 0) console.log();
  }
  console.log();
}

// --- Show color theme ---
function showTheme(name) {
  const themes = {
    monokai: {
      background: '#272822',
      foreground: '#F8F8F2',
      red: '#F92672',
      green: '#A6E22E',
      yellow: '#F4BF75',
      blue: '#66D9EF',
      magenta: '#AE81FF',
      cyan: '#A1EFE4',
    },
    dracula: {
      background: '#282A36',
      foreground: '#F8F8F2',
      red: '#FF5555',
      green: '#50FA7B',
      yellow: '#F1FA8C',
      blue: '#6272A4',
      magenta: '#FF79C6',
      cyan: '#8BE9FD',
    },
    solarized: {
      background: '#002B36',
      foreground: '#839496',
      red: '#DC322F',
      green: '#859900',
      yellow: '#B58900',
      blue: '#268BD2',
      magenta: '#D33682',
      cyan: '#2AA198',
    },
  };

  const theme = themes[name.toLowerCase()];
  if (!theme) {
    console.error(`  ${C.red}Error:${C.reset} Unknown theme: ${name}`);
    console.error(`  Available themes: ${Object.keys(themes).join(', ')}`);
    process.exit(1);
  }

  console.log();
  console.log(`  ${C.bold}Theme: ${name}${C.reset}\n`);

  for (const [key, value] of Object.entries(theme)) {
    const hex = value.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    const code = `\x1b[38;2;${r};${g};${b}m`;
    const reset = '\x1b[0m';

    console.log(`  ${code}████${reset} ${key.padEnd(12)} ${value}`);
  }

  console.log();
}

// --- Generate random color ---
function generateColor() {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);

  showRgbColor(r, g, b);
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let command = null;
  let background = false;
  let text = null;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-b' || arg === '--background') {
      background = true;
    } else if (arg === '-t' || arg === '--text') {
      text = args[++i];
    } else if (!arg.startsWith('-')) {
      if (!command) {
        command = arg;
      } else {
        positional.push(arg);
      }
    }
  }

  return { command, background, text, positional };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (!opts.command) {
    showHelp();
    process.exit(1);
  }

  switch (opts.command) {
    case 'ansi':
      if (opts.positional.length < 1) {
        console.error(`  ${C.red}Error:${C.reset} Usage: color ansi <code>`);
        process.exit(1);
      }
      showAnsiColor(opts.positional[0], {
        background: opts.background,
        text: opts.text,
      });
      break;

    case 'rgb':
      if (opts.positional.length < 3) {
        console.error(`  ${C.red}Error:${C.reset} Usage: color rgb <r> <g> <b>`);
        process.exit(1);
      }
      showRgbColor(
        parseInt(opts.positional[0]),
        parseInt(opts.positional[1]),
        parseInt(opts.positional[2]),
        { background: opts.background, text: opts.text }
      );
      break;

    case 'hex':
      if (opts.positional.length < 1) {
        console.error(`  ${C.red}Error:${C.reset} Usage: color hex <hex>`);
        process.exit(1);
      }
      showHexColor(opts.positional[0], {
        background: opts.background,
        text: opts.text,
      });
      break;

    case 'preview':
      if (opts.positional.length < 1 && !opts.text) {
        console.error(`  ${C.red}Error:${C.reset} Usage: color preview <text>`);
        process.exit(1);
      }
      previewText(opts.positional[0] || opts.text);
      break;

    case 'list':
      listColors();
      break;

    case 'theme':
      if (opts.positional.length < 1) {
        console.error(`  ${C.red}Error:${C.reset} Usage: color theme <name>`);
        process.exit(1);
      }
      showTheme(opts.positional[0]);
      break;

    case 'generate':
      generateColor();
      break;

    default:
      console.error(`  ${C.red}Error:${C.reset} Unknown command: ${opts.command}`);
      showHelp();
      process.exit(1);
  }
}

main();
