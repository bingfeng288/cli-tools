#!/usr/bin/env node

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// --- Named colors ---
const NAMED_COLORS = {
  'black': '#000000', 'white': '#ffffff', 'red': '#ff0000', 'green': '#008000',
  'blue': '#0000ff', 'yellow': '#ffff00', 'cyan': '#00ffff', 'magenta': '#ff00ff',
  'orange': '#ffa500', 'purple': '#800080', 'pink': '#ffc0cb', 'brown': '#a52a2a',
  'gray': '#808080', 'grey': '#808080', 'lime': '#00ff00', 'navy': '#000080',
  'teal': '#008080', 'maroon': '#800000', 'olive': '#808000', 'aqua': '#00ffff',
  'silver': '#c0c0c0', 'coral': '#ff7f50', 'salmon': '#fa8072', 'tomato': '#ff6347',
  'gold': '#ffd700', 'indigo': '#4b0082', 'violet': '#ee82ee', 'khaki': '#f0e68c',
  'crimson': '#dc143c', 'turquoise': '#40e0d0', 'tan': '#d2b48c', 'wheat': '#f5deb3',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mcolorpick\x1b[0m - Color picker and converter

  \x1b[1mUsage:\x1b[0m
    colorpick <color> [options]
    colorpick --random [options]
    colorpick --list

  \x1b[1mColor Formats:\x1b[0m
    #RGB           #f00
    #RRGGBB        #ff0000
    rgb(r,g,b)     rgb(255,0,0)
    hsl(h,s%,l%)   hsl(0,100%,50%)
    name           red, blue, coral

  \x1b[1mOptions:\x1b[0m
    --hex             Show HEX value
    --rgb             Show RGB value
    --hsl             Show HSL value
    --all             Show all formats (default)
    --block           Show color block
    --mix <color2>    Mix with another color
    --contrast <bg>   Check contrast ratio
    --complementary   Show complementary color
    --analogous       Show analogous colors
    --triadic         Show triadic colors
    --random          Generate random color
    --list            List named colors
    -h, --help        Show this help

  \x1b[1mExamples:\x1b[0m
    colorpick "#ff6347"
    colorpick "rgb(255,99,71)"
    colorpick "hsl(16,100%,64%)"
    colorpick coral
    colorpick "#ff6347" --block
    colorpick "#ff6347" --complementary
    colorpick --random
    colorpick --list
`);
}

// --- Parse color ---
function parseColor(input) {
  const str = input.trim().toLowerCase();

  // Named color
  if (NAMED_COLORS[str]) {
    return hexToRgb(NAMED_COLORS[str]);
  }

  // #RGB
  if (/^#?[0-9a-f]{3}$/i.test(str)) {
    const hex = str.replace('#', '');
    return hexToRgb(`#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`);
  }

  // #RRGGBB
  if (/^#?[0-9a-f]{6}$/i.test(str)) {
    return hexToRgb(str.startsWith('#') ? str : `#${str}`);
  }

  // rgb(r,g,b)
  const rgbMatch = str.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
  }

  // hsl(h,s%,l%)
  const hslMatch = str.match(/hsl\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)/);
  if (hslMatch) {
    return hslToRgb(parseInt(hslMatch[1]), parseInt(hslMatch[2]), parseInt(hslMatch[3]));
  }

  return null;
}

// --- Color conversions ---
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

// --- Luminance and contrast ---
function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(rgb1, rgb2) {
  const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// --- Color operations ---
function complementary(rgb) {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return hslToRgb((hsl.h + 180) % 360, hsl.s, hsl.l);
}

function analogous(rgb) {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return [
    hslToRgb((hsl.h - 30 + 360) % 360, hsl.s, hsl.l),
    rgb,
    hslToRgb((hsl.h + 30) % 360, hsl.s, hsl.l),
  ];
}

function triadic(rgb) {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return [
    rgb,
    hslToRgb((hsl.h + 120) % 360, hsl.s, hsl.l),
    hslToRgb((hsl.h + 240) % 360, hsl.s, hsl.l),
  ];
}

function mixColors(rgb1, rgb2, ratio = 0.5) {
  return {
    r: Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio),
    g: Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio),
    b: Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio),
  };
}

// --- Display ---
function displayColorBlock(rgb) {
  const block = `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m        \x1b[0m`;
  return block;
}

function displayAll(rgb, showBlock = true) {
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  console.log();
  if (showBlock) {
    console.log(`  ${displayColorBlock(rgb)}`);
    console.log();
  }
  console.log(`  HEX: ${C.bold}${hex}${C.reset}`);
  console.log(`  RGB: ${C.bold}rgb(${rgb.r}, ${rgb.g}, ${rgb.b})${C.reset}`);
  console.log(`  HSL: ${C.bold}hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)${C.reset}`);
  console.log();
}

// --- Random color ---
function randomColor() {
  return {
    r: Math.floor(Math.random() * 256),
    g: Math.floor(Math.random() * 256),
    b: Math.floor(Math.random() * 256),
  };
}

// --- List named colors ---
function listColors() {
  console.log(`\n  ${C.bold}Named Colors:${C.reset}\n`);
  const colors = Object.entries(NAMED_COLORS).sort((a, b) => a[0].localeCompare(b[0]));

  colors.forEach(([name, hex]) => {
    const rgb = hexToRgb(hex);
    const block = displayColorBlock(rgb);
    console.log(`  ${block}  ${name.padEnd(12)} ${hex}`);
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

  let color = null;
  let mode = 'all';
  let showBlock = true;
  let mix = null;
  let contrast = null;
  let complementaryMode = false;
  let analogousMode = false;
  let triadicMode = false;
  let random = false;
  let list = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--hex') mode = 'hex';
    else if (arg === '--rgb') mode = 'rgb';
    else if (arg === '--hsl') mode = 'hsl';
    else if (arg === '--all') mode = 'all';
    else if (arg === '--block') showBlock = true;
    else if (arg === '--mix') mix = args[++i];
    else if (arg === '--contrast') contrast = args[++i];
    else if (arg === '--complementary') complementaryMode = true;
    else if (arg === '--analogous') analogousMode = true;
    else if (arg === '--triadic') triadicMode = true;
    else if (arg === '--random') random = true;
    else if (arg === '--list') list = true;
    else if (!arg.startsWith('-')) color = arg;
  }

  return { color, mode, showBlock, mix, contrast, complementaryMode, analogousMode, triadicMode, random, list };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (opts.list) {
    listColors();
    return;
  }

  if (opts.random) {
    const rgb = randomColor();
    displayAll(rgb, opts.showBlock);
    return;
  }

  if (!opts.color) {
    showHelp();
    return;
  }

  const rgb = parseColor(opts.color);
  if (!rgb) {
    console.error(`  Error: Invalid color: ${opts.color}`);
    process.exit(1);
  }

  // Simple output modes
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  if (opts.mode === 'hex') {
    console.log(`\n  ${hex}\n`);
    return;
  }
  if (opts.mode === 'rgb') {
    console.log(`\n  rgb(${rgb.r}, ${rgb.g}, ${rgb.b})\n`);
    return;
  }
  if (opts.mode === 'hsl') {
    console.log(`\n  hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)\n`);
    return;
  }

  // Full display
  displayAll(rgb, opts.showBlock);

  // Complementary
  if (opts.complementaryMode) {
    const comp = complementary(rgb);
    console.log(`  ${C.bold}Complementary:${C.reset}`);
    console.log(`  ${displayColorBlock(comp)}  ${rgbToHex(comp.r, comp.g, comp.b)}`);
    console.log();
  }

  // Analogous
  if (opts.analogousMode) {
    const colors = analogous(rgb);
    console.log(`  ${C.bold}Analogous:${C.reset}`);
    colors.forEach(c => {
      console.log(`  ${displayColorBlock(c)}  ${rgbToHex(c.r, c.g, c.b)}`);
    });
    console.log();
  }

  // Triadic
  if (opts.triadicMode) {
    const colors = triadic(rgb);
    console.log(`  ${C.bold}Triadic:${C.reset}`);
    colors.forEach(c => {
      console.log(`  ${displayColorBlock(c)}  ${rgbToHex(c.r, c.g, c.b)}`);
    });
    console.log();
  }

  // Mix
  if (opts.mix) {
    const rgb2 = parseColor(opts.mix);
    if (!rgb2) {
      console.error(`  Error: Invalid color to mix: ${opts.mix}`);
      process.exit(1);
    }
    const mixed = mixColors(rgb, rgb2, 0.5);
    console.log(`  ${C.bold}Mix (50/50):${C.reset}`);
    console.log(`  ${displayColorBlock(mixed)}  ${rgbToHex(mixed.r, mixed.g, mixed.b)}`);
    console.log();
  }

  // Contrast
  if (opts.contrast) {
    const rgb2 = parseColor(opts.contrast);
    if (!rgb2) {
      console.error(`  Error: Invalid background color: ${opts.contrast}`);
      process.exit(1);
    }
    const ratio = contrastRatio(rgb, rgb2);
    const aaLarge = ratio >= 3;
    const aa = ratio >= 4.5;
    const aaa = ratio >= 7;

    console.log(`  ${C.bold}Contrast Ratio:${C.reset} ${ratio.toFixed(2)}:1`);
    console.log(`  AA Large:  ${aaLarge ? '✓ Pass' : '✗ Fail'}`);
    console.log(`  AA:        ${aa ? '✓ Pass' : '✗ Fail'}`);
    console.log(`  AAA:       ${aaa ? '✓ Pass' : '✗ Fail'}`);
    console.log();
  }
}

main();
