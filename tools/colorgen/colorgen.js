#!/usr/bin/env node

import { randomInt } from 'node:crypto';

// --- Color conversion ---
function hexToHsl(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

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

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
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

  const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

// --- Palette generation ---
function complementary(hex) {
  const hsl = hexToHsl(hex);
  return [
    hex,
    hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l),
  ];
}

function analogous(hex) {
  const hsl = hexToHsl(hex);
  return [
    hslToHex(hsl.h - 30, hsl.s, hsl.l),
    hex,
    hslToHex(hsl.h + 30, hsl.s, hsl.l),
  ];
}

function triadic(hex) {
  const hsl = hexToHsl(hex);
  return [
    hex,
    hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l),
    hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l),
  ];
}

function tetradic(hex) {
  const hsl = hexToHsl(hex);
  return [
    hex,
    hslToHex((hsl.h + 90) % 360, hsl.s, hsl.l),
    hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l),
    hslToHex((hsl.h + 270) % 360, hsl.s, hsl.l),
  ];
}

function splitComplementary(hex) {
  const hsl = hexToHsl(hex);
  return [
    hex,
    hslToHex((hsl.h + 150) % 360, hsl.s, hsl.l),
    hslToHex((hsl.h + 210) % 360, hsl.s, hsl.l),
  ];
}

function monochromatic(hex, count = 5) {
  const hsl = hexToHsl(hex);
  const palette = [];
  for (let i = 0; i < count; i++) {
    const l = Math.round(20 + (60 / (count - 1)) * i);
    palette.push(hslToHex(hsl.h, hsl.s, l));
  }
  return palette;
}

function random(count = 5) {
  const palette = [];
  for (let i = 0; i < count; i++) {
    const h = randomInt(360);
    const s = 50 + randomInt(40);
    const l = 40 + randomInt(30);
    palette.push(hslToHex(h, s, l));
  }
  return palette;
}

function warm(count = 5) {
  const palette = [];
  for (let i = 0; i < count; i++) {
    const h = randomInt(60); // Red to yellow
    const s = 60 + randomInt(30);
    const l = 45 + randomInt(25);
    palette.push(hslToHex(h, s, l));
  }
  return palette;
}

function cool(count = 5) {
  const palette = [];
  for (let i = 0; i < count; i++) {
    const h = 180 + randomInt(60); // Cyan to blue
    const s = 50 + randomInt(40);
    const l = 45 + randomInt(25);
    palette.push(hslToHex(h, s, l));
  }
  return palette;
}

// --- Display ---
function displayPalette(name, palette) {
  console.log(`\n  ${name}:\n`);
  palette.forEach((hex, i) => {
    const rgb = hexToRgb(hex);
    const hsl = hexToHsl(hex);
    const colorBlock = `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}m      \x1b[0m`;
    console.log(`    ${colorBlock}  ${hex.toUpperCase().padEnd(8)}  RGB(${rgb.r}, ${rgb.g}, ${rgb.b})  HSL(${hsl.h}°, ${hsl.s}%, ${hsl.l}%)`);
  });
  console.log();
}

function displayCss(name, palette) {
  console.log(`  /* ${name} */`);
  console.log(`  :root {`);
  palette.forEach((hex, i) => {
    console.log(`    --color-${i + 1}: ${hex};`);
  });
  console.log(`  }\n`);
}

// --- CLI ---
const args = process.argv.slice(2);

function showHelp() {
  console.log(`
  colorgen - Color Palette Generator

  Usage: colorgen [command] [options]

  Commands:
    complementary <hex>     Complementary palette (2 colors)
    analogous <hex>         Analogous palette (3 colors)
    triadic <hex>           Triadic palette (3 colors)
    tetradic <hex>          Tetradic palette (4 colors)
    split <hex>             Split-complementary palette (3 colors)
    mono <hex> [n]          Monochromatic palette (n shades)
    random [n]              Random palette (n colors)
    warm [n]                Warm color palette
    cool [n]                Cool color palette

  Options:
    --css                   Output as CSS variables
    --json                  Output as JSON
    -h, --help              Show this help

  Examples:
    colorgen complementary #3b82f6
    colorgen analogous #10b981
    colorgen mono #8b5cf6 8
    colorgen random 6
    colorgen warm --css
    colorgen cool --json
`);
}

if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
  showHelp();
  process.exit(0);
}

const cmd = args[0];
const css = args.includes('--css');
const json = args.includes('--json');
const hex = args.find(a => a.startsWith('#')) || args[1];
const count = parseInt(args.find(a => /^\d+$/.test(a))) || 5;

let palette;
let name;

switch (cmd) {
  case 'complementary':
    if (!hex) { console.error('  Please provide a hex color'); process.exit(1); }
    palette = complementary(hex);
    name = 'Complementary';
    break;
  case 'analogous':
    if (!hex) { console.error('  Please provide a hex color'); process.exit(1); }
    palette = analogous(hex);
    name = 'Analogous';
    break;
  case 'triadic':
    if (!hex) { console.error('  Please provide a hex color'); process.exit(1); }
    palette = triadic(hex);
    name = 'Triadic';
    break;
  case 'tetradic':
    if (!hex) { console.error('  Please provide a hex color'); process.exit(1); }
    palette = tetradic(hex);
    name = 'Tetradic';
    break;
  case 'split':
    if (!hex) { console.error('  Please provide a hex color'); process.exit(1); }
    palette = splitComplementary(hex);
    name = 'Split-Complementary';
    break;
  case 'mono':
    if (!hex) { console.error('  Please provide a hex color'); process.exit(1); }
    palette = monochromatic(hex, count);
    name = 'Monochromatic';
    break;
  case 'random':
    palette = random(count);
    name = 'Random';
    break;
  case 'warm':
    palette = warm(count);
    name = 'Warm';
    break;
  case 'cool':
    palette = cool(count);
    name = 'Cool';
    break;
  default:
    console.error(`  Unknown command: ${cmd}`);
    process.exit(1);
}

if (json) {
  console.log(JSON.stringify(palette, null, 2));
} else if (css) {
  displayCss(name, palette);
} else {
  displayPalette(name, palette);
}
