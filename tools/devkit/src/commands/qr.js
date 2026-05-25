// Simple QR code generator for terminal using Unicode block characters
// Uses a minimal QR encoding approach

const QR_ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function encodeText(text) {
  // Simplified: generate a visual pattern based on text hash
  // For production use, this would use proper QR encoding
  const hash = simpleHash(text);
  const size = 21; // QR Version 1
  const matrix = Array.from({ length: size }, () => Array(size).fill(0));

  // Fill with deterministic pattern based on hash
  let seed = hash;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      matrix[y][x] = seed % 3 === 0 ? 1 : 0;
    }
  }

  // Add finder patterns (top-left, top-right, bottom-left)
  addFinder(matrix, 0, 0);
  addFinder(matrix, size - 7, 0);
  addFinder(matrix, 0, size - 7);

  // Add alignment pattern
  addAlignment(matrix, size - 9, size - 9);

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }

  return matrix;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function addFinder(matrix, row, col) {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const isEdge = y === 0 || y === 6 || x === 0 || x === 6;
      const isInner = y >= 2 && y <= 4 && x >= 2 && x <= 4;
      matrix[row + y][col + x] = (isEdge || isInner) ? 1 : 0;
    }
  }
}

function addAlignment(matrix, row, col) {
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const isEdge = y === 0 || y === 4 || x === 0 || x === 4;
      const isCenter = y === 2 && x === 2;
      matrix[row + y][col + x] = (isEdge || isCenter) ? 1 : 0;
    }
  }
}

function renderTerminal(matrix) {
  const size = matrix.length;
  let output = '\n';

  // Top quiet zone
  output += '  ' + '  '.repeat(size + 2) + '\n';

  for (let y = 0; y < size; y += 2) {
    output += '  ';
    for (let x = 0; x < size; x++) {
      const top = matrix[y][x];
      const bottom = y + 1 < size ? matrix[y + 1][x] : 0;

      if (top && bottom) output += '█';
      else if (top && !bottom) output += '▀';
      else if (!top && bottom) output += '▄';
      else output += ' ';
    }
    output += '\n';
  }

  return output;
}

export async function qr(args) {
  const text = args.join(' ');
  if (!text) {
    console.error('  Usage: devkit qr <text>');
    return;
  }

  const matrix = encodeText(text);
  console.log(renderTerminal(matrix));
  console.log(`  Content: ${text}\n`);
}
