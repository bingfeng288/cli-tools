#!/usr/bin/env node

import { readFileSync } from 'node:fs';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mqrcode\x1b[0m - QR code generator for terminal

  \x1b[1mUsage:\x1b[0m
    qrcode <text>
    echo "<text>" | qrcode

  \x1b[1mOptions:\x1b[0m
    -s, --size <n>     Module size (default: 1)
    --invert           Invert colors (white on black)
    --no-border        Hide quiet zone border
    -h, --help         Show this help

  \x1b[1mExamples:\x1b[0m
    qrcode "Hello World"
    qrcode "https://example.com"
    echo "test" | qrcode
`);
}

// --- GF(256) arithmetic for Reed-Solomon ---
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(function initGF256() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) {
    GF256_EXP[i] = GF256_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF256_EXP[GF256_LOG[a] + GF256_LOG[b]];
}

// --- Reed-Solomon encoder ---
function rsEncode(data, nsym) {
  const gen = rsGeneratorPoly(nsym);
  const res = new Uint8Array(data.length + nsym);
  res.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }

  return res.slice(data.length);
}

function rsGeneratorPoly(nsym) {
  let gen = new Uint8Array([1]);
  for (let i = 0; i < nsym; i++) {
    const newGen = new Uint8Array(gen.length + 1);
    const root = GF256_EXP[i];
    for (let j = gen.length - 1; j >= 0; j--) {
      newGen[j + 1] ^= gen[j];
      newGen[j] ^= gfMul(gen[j], root);
    }
    gen = newGen;
  }
  return gen;
}

// --- QR Code version info ---
// [total codewords, ec codewords per block, num blocks group1, data cw group1, num blocks group2, data cw group2]
const VERSION_INFO = [
  null, // 0-indexed
  { total: 26, ecPerBlock: 7, g1Blocks: 1, g1Data: 19, g2Blocks: 0, g2Data: 0 },   // V1
  { total: 44, ecPerBlock: 10, g1Blocks: 1, g1Data: 34, g2Blocks: 0, g2Data: 0 },  // V2
  { total: 70, ecPerBlock: 15, g1Blocks: 1, g1Data: 55, g2Blocks: 0, g2Data: 0 },  // V3
  { total: 100, ecPerBlock: 20, g1Blocks: 1, g1Data: 80, g2Blocks: 0, g2Data: 0 }, // V4
  { total: 134, ecPerBlock: 26, g1Blocks: 1, g1Data: 108, g2Blocks: 0, g2Data: 0 },// V5
  { total: 172, ecPerBlock: 18, g1Blocks: 2, g1Data: 68, g2Blocks: 0, g2Data: 0 }, // V6
  { total: 196, ecPerBlock: 20, g1Blocks: 2, g1Data: 78, g2Blocks: 0, g2Data: 0 }, // V7
  { total: 242, ecPerBlock: 24, g1Blocks: 2, g1Data: 97, g2Blocks: 0, g2Data: 0 }, // V8
  { total: 292, ecPerBlock: 30, g1Blocks: 2, g1Data: 116, g2Blocks: 0, g2Data: 0 },// V9
  { total: 346, ecPerBlock: 18, g1Blocks: 2, g1Data: 68, g2Blocks: 2, g2Data: 69 },// V10
];

// Character capacity for byte mode at EC level L
const BYTE_CAPACITY = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];

// --- Determine QR version ---
function getVersion(dataLen) {
  for (let v = 1; v <= 10; v++) {
    if (dataLen <= BYTE_CAPACITY[v]) return v;
  }
  throw new Error('Data too long for QR code (max ~271 bytes for V10-L)');
}

// --- Encode data in byte mode ---
function encodeData(text, version) {
  const info = VERSION_INFO[version];
  const totalDataCW = info.g1Blocks * info.g1Data + info.g2Blocks * info.g2Data;
  const totalBits = totalDataCW * 8;

  const bytes = new TextEncoder().encode(text);
  const bits = [];

  // Mode indicator: 0100 (byte mode)
  bits.push(0, 1, 0, 0);

  // Character count indicator (8 bits for V1-9, 16 bits for V10+)
  const countBits = version >= 10 ? 16 : 8;
  for (let i = countBits - 1; i >= 0; i--) {
    bits.push((bytes.length >> i) & 1);
  }

  // Data
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }

  // Terminator (up to 4 zeros)
  const termLen = Math.min(4, totalBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes (alternating 0xEC, 0x11)
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < totalBits) {
    const pb = padBytes[padIdx % 2];
    for (let i = 7; i >= 0; i--) bits.push((pb >> i) & 1);
    padIdx++;
  }

  // Convert to codewords
  const codewords = new Uint8Array(totalDataCW);
  for (let i = 0; i < totalDataCW; i++) {
    let val = 0;
    for (let j = 0; j < 8; j++) {
      val = (val << 1) | (bits[i * 8 + j] || 0);
    }
    codewords[i] = val;
  }

  return codewords;
}

// --- Generate error correction codewords ---
function generateEC(data, version) {
  const info = VERSION_INFO[version];
  const ec = [];

  let offset = 0;
  const blockSizes = [];

  // Group 1 blocks
  for (let i = 0; i < info.g1Blocks; i++) {
    blockSizes.push(info.g1Data);
  }
  // Group 2 blocks
  for (let i = 0; i < info.g2Blocks; i++) {
    blockSizes.push(info.g2Data);
  }

  for (const size of blockSizes) {
    const blockData = data.slice(offset, offset + size);
    const blockEC = rsEncode(blockData, info.ecPerBlock);
    ec.push(blockEC);
    offset += size;
  }

  return ec;
}

// --- Interleave data and EC codewords ---
function interleave(data, ecBlocks, version) {
  const info = VERSION_INFO[version];
  const result = [];

  const g1Count = info.g1Blocks;
  const g2Count = info.g2Blocks;
  const g1Data = info.g1Data;
  const g2Data = info.g2Data;

  // Interleave data codewords
  const maxData = Math.max(g1Data, g2Data || 0);
  for (let i = 0; i < maxData; i++) {
    for (let j = 0; j < g1Count + g2Count; j++) {
      const blockSize = j < g1Count ? g1Data : g2Data;
      if (i < blockSize) {
        const blockOffset = j < g1Count ? j * g1Data : g1Count * g1Data + (j - g1Count) * g2Data;
        result.push(data[blockOffset + i]);
      }
    }
  }

  // Interleave EC codewords
  for (let i = 0; i < info.ecPerBlock; i++) {
    for (let j = 0; j < ecBlocks.length; j++) {
      result.push(ecBlocks[j][i]);
    }
  }

  return result;
}

// --- Create QR matrix ---
function createMatrix(version) {
  const size = version * 4 + 17;
  // null = unset, true = dark, false = light
  const matrix = Array.from({ length: size }, () => Array(size).fill(null));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  return { matrix, reserved, size };
}

// --- Place finder pattern ---
function placeFinder(m, row, col) {
  const { matrix, reserved, size } = m;
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;

      let dark;
      if (r === -1 || r === 7 || c === -1 || c === 7) {
        dark = false; // separator
      } else if (r === 0 || r === 6 || c === 0 || c === 6) {
        dark = true;
      } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
        dark = true;
      } else {
        dark = false;
      }

      matrix[rr][cc] = dark;
      reserved[rr][cc] = true;
    }
  }
}

// --- Place alignment pattern ---
function placeAlignment(m, row, col) {
  const { matrix, reserved } = m;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const dark = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
      matrix[row + r][col + c] = dark;
      reserved[row + r][col + c] = true;
    }
  }
}

// --- Place function patterns ---
function placeFunctionPatterns(m, version) {
  const { matrix, reserved, size } = m;

  // Finder patterns
  placeFinder(m, 0, 0);
  placeFinder(m, 0, size - 7);
  placeFinder(m, size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) {
      matrix[6][i] = i % 2 === 0;
      reserved[6][i] = true;
    }
    if (!reserved[i][6]) {
      matrix[i][6] = i % 2 === 0;
      reserved[i][6] = true;
    }
  }

  // Alignment patterns (for V2+)
  if (version >= 2) {
    const alignPositions = getAlignmentPositions(version);
    for (const row of alignPositions) {
      for (const col of alignPositions) {
        // Skip if overlapping with finder patterns
        if (reserved[row][col]) continue;
        placeAlignment(m, row, col);
      }
    }
  }

  // Dark module
  matrix[size - 8][8] = true;
  reserved[size - 8][8] = true;

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    // Around top-left finder
    reserved[8][i] = true;
    reserved[i][8] = true;
    // Around top-right finder
    reserved[8][size - 1 - i] = true;
    // Around bottom-left finder
    reserved[size - 1 - i][8] = true;
  }
  reserved[8][8] = true;
}

function getAlignmentPositions(version) {
  if (version === 1) return [];
  const first = 6;
  const last = version * 4 + 10;
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((last - first) / (count - 1));
  const positions = [first];
  for (let i = 1; i < count - 1; i++) {
    positions.push(first + step * i);
  }
  positions.push(last);
  return positions;
}

// --- Place data bits ---
function placeData(m, codewords) {
  const { matrix, reserved, size } = m;
  const bits = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) {
      bits.push((cw >> i) & 1);
    }
  }

  let bitIdx = 0;
  let upward = true;

  for (let col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5; // skip timing column

    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (cc < 0 || cc >= size) continue;
        if (reserved[row][cc]) continue;

        matrix[row][cc] = bitIdx < bits.length ? bits[bitIdx] === 1 : false;
        bitIdx++;
      }
    }

    upward = !upward;
  }
}

// --- Mask patterns ---
const MASK_FNS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
  (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];

// --- Apply mask ---
function applyMask(m, maskIdx) {
  const { matrix, reserved, size } = m;
  const result = matrix.map(row => [...row]);
  const fn = MASK_FNS[maskIdx];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && fn(r, c)) {
        result[r][c] = !result[r][c];
      }
    }
  }

  return result;
}

// --- Format info ---
const FORMAT_INFO = [
  0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0,
  0x77C4, 0x72F3, 0x7DAA, 0x789D, 0x662F, 0x6318, 0x6C41, 0x6976,
  0x1689, 0x13BE, 0x1CE7, 0x19D0, 0x0762, 0x0255, 0x0D0C, 0x083B,
  0x355F, 0x3068, 0x3F31, 0x3A06, 0x24B4, 0x2183, 0x2EDA, 0x2BED,
];

function placeFormatInfo(m, maskIdx) {
  const { matrix, size } = m;

  // EC level L = 01, mask pattern = maskIdx
  const formatIdx = (0b01 << 3) | maskIdx;
  const formatBits = FORMAT_INFO[formatIdx];

  // Place around top-left
  const positions1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];

  // Place around top-right and bottom-left
  const positions2 = [
    [8, size - 1], [8, size - 2], [8, size - 3], [8, size - 4], [8, size - 5], [8, size - 6], [8, size - 7], [8, size - 8],
    [size - 7, 8], [size - 6, 8], [size - 5, 8], [size - 4, 8], [size - 3, 8], [size - 2, 8], [size - 1, 8],
  ];

  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >> (14 - i)) & 1;
    const dark = bit === 1;

    if (i < positions1.length) {
      matrix[positions1[i][0]][positions1[i][1]] = dark;
    }

    if (i < positions2.length) {
      matrix[positions2[i][0]][positions2[i][1]] = dark;
    }
  }
}

// --- Calculate penalty score ---
function penaltyScore(matrix, size) {
  let score = 0;

  // Rule 1: consecutive same-color modules in row/col
  for (let r = 0; r < size; r++) {
    let count = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) {
        count++;
        if (count === 5) score += 3;
        else if (count > 5) score += 1;
      } else {
        count = 1;
      }
    }
  }
  for (let c = 0; c < size; c++) {
    let count = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) {
        count++;
        if (count === 5) score += 3;
        else if (count > 5) score += 1;
      } else {
        count = 1;
      }
    }
  }

  // Rule 2: 2x2 same-color blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const val = matrix[r][c];
      if (val === matrix[r][c + 1] && val === matrix[r + 1][c] && val === matrix[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  return score;
}

// --- Generate QR code ---
function generateQR(text) {
  const bytes = new TextEncoder().encode(text);
  const version = getVersion(bytes.length);
  const info = VERSION_INFO[version];
  const size = version * 4 + 17;

  // Encode data
  const data = encodeData(text, version);

  // Generate EC
  const ecBlocks = generateEC(data, version);

  // Interleave
  const codewords = interleave(data, ecBlocks, version);

  // Create matrix
  const m = createMatrix(version);
  placeFunctionPatterns(m, version);
  placeData(m, codewords);

  // Try all 8 mask patterns and pick the best
  let bestMask = 0;
  let bestScore = Infinity;
  let bestMatrix = null;

  for (let mask = 0; mask < 8; mask++) {
    const masked = applyMask(m, mask);
    placeFormatInfo({ matrix: masked, size }, mask);

    const score = penaltyScore(masked, size);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestMatrix = masked;
    }
  }

  return { matrix: bestMatrix, size, version };
}

// --- Render QR code in terminal ---
function renderQR(qr, options = {}) {
  const { moduleSize = 1, invert = false, showBorder = true } = options;
  const { matrix, size, version } = qr;

  // Add quiet zone (4 modules)
  const border = showBorder ? 4 : 0;
  const fullSize = size + border * 2;

  // Use Unicode half-block characters for compact rendering
  // Each character represents 2 vertical modules
  const lines = [];

  for (let r = 0; r < fullSize; r += 2) {
    let line = '';
    for (let c = 0; c < fullSize; c++) {
      const mr = r - border;
      const mc = c - border;
      const mr2 = r + 1 - border;

      const top = mr >= 0 && mr < size && mc >= 0 && mc < size ? matrix[mr][mc] : false;
      const bottom = mr2 >= 0 && mr2 < size && mc >= 0 && mc < size ? matrix[mr2][mc] : false;

      const topDark = invert ? !top : top;
      const bottomDark = invert ? !bottom : bottom;

      if (topDark && bottomDark) {
        line += '\u2588'; // full block
      } else if (topDark && !bottomDark) {
        line += '\u2580'; // upper half block
      } else if (!topDark && bottomDark) {
        line += '\u2584'; // lower half block
      } else {
        line += ' ';
      }
    }
    lines.push(line);
  }

  return lines.join('\n');
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let text = null;
  let moduleSize = 1;
  let invert = false;
  let showBorder = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-s' || arg === '--size') {
      moduleSize = parseInt(args[++i]) || 1;
    } else if (arg === '--invert') {
      invert = true;
    } else if (arg === '--no-border') {
      showBorder = false;
    } else if (!arg.startsWith('-')) {
      text = arg;
    }
  }

  return { text, moduleSize, invert, showBorder };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  // Read text
  let text = opts.text;
  if (!text && !process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    text = Buffer.concat(chunks).toString('utf-8').trim();
  }

  if (!text) {
    showHelp();
    process.exit(1);
  }

  try {
    const qr = generateQR(text);
    const output = renderQR(qr, {
      moduleSize: opts.moduleSize,
      invert: opts.invert,
      showBorder: opts.showBorder,
    });
    console.log(output);
    console.log();
    console.log(`  ${C.dim}Version: ${qr.version} | Size: ${qr.size}x${qr.size} | Data: ${text.length} bytes${C.reset}`);
    console.log();
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    console.error(`  ${C.dim}${err.stack}${C.reset}`);
    process.exit(1);
  }
}

main();
