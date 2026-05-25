#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, statSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// --- Help ---
function showHelp() {
  console.log(`
  ${C.bold}filehash${C.reset} - File hashing and checksum tool

  ${C.bold}Usage:${C.reset}
    filehash <file...> [options]
    filehash --check <checksum-file>
    filehash --compare <file1> <file2>

  ${C.bold}Options:${C.reset}
    -a, --algorithm <algo>    Hash algorithm: md5, sha1, sha256 (default), sha512
    -c, --check <file>        Verify checksums from file
    --compare <f1> <f2>       Compare two files
    -r, --recursive           Hash files recursively
    -o, --output <file>       Save checksums to file
    -q, --quiet               Output hash only
    --tag                     Use BSD-style output
    -h, --help                Show this help

  ${C.bold}Supported Algorithms:${C.reset}
    md5, sha1, sha224, sha256, sha384, sha512

  ${C.bold}Examples:${C.reset}
    filehash file.txt
    filehash *.js -a md5
    filehash . -r -a sha256
    filehash --compare a.txt b.txt
    filehash -c checksums.sha256
    filehash *.txt -o checksums.sha256
`);
}

// --- Hash file ---
function hashFile(filePath, algorithm = 'sha256') {
  const data = readFileSync(filePath);
  return createHash(algorithm).update(data).digest('hex');
}

// --- Hash string (for stdin) ---
function hashString(str, algorithm = 'sha256') {
  return createHash(algorithm).update(str).digest('hex');
}

// --- Get all files recursively ---
function getFiles(dir, recursive = true) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isFile()) {
      files.push(fullPath);
    } else if (entry.isDirectory() && recursive) {
      files.push(...getFiles(fullPath, recursive));
    }
  }

  return files;
}

// --- Display hash ---
function displayHash(filePath, hash, algorithm, quiet = false, tag = false) {
  if (quiet) {
    console.log(hash);
  } else if (tag) {
    console.log(`${algorithm.toUpperCase()} (${filePath}) = ${hash}`);
  } else {
    console.log(`${hash}  ${filePath}`);
  }
}

// --- Save checksums ---
function saveChecksums(results, algorithm, outputFile) {
  const lines = results.map(({ file, hash }) => `${hash}  ${file}`);
  writeFileSync(outputFile, lines.join('\n') + '\n');
  console.log(`\n  ${C.green}✓${C.reset} Saved ${results.length} checksums to ${outputFile}\n`);
}

// --- Verify checksums ---
function verifyChecksums(checksumFile, algorithm) {
  const content = readFileSync(checksumFile, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l.trim());

  let passed = 0;
  let failed = 0;
  let errors = 0;

  console.log();

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) {
      console.log(`  ${C.yellow}⚠${C.reset} Invalid line: ${line}`);
      errors++;
      continue;
    }

    const [expectedHash, file] = parts;
    try {
      const actualHash = hashFile(file, algorithm);
      if (actualHash === expectedHash) {
        console.log(`  ${C.green}✓${C.reset} ${file}: OK`);
        passed++;
      } else {
        console.log(`  ${C.red}✗${C.reset} ${file}: FAILED`);
        failed++;
      }
    } catch (err) {
      console.log(`  ${C.red}✗${C.reset} ${file}: ${err.message}`);
      errors++;
    }
  }

  console.log();
  console.log(`  ${C.bold}Results:${C.reset} ${C.green}${passed} passed${C.reset}, ${C.red}${failed} failed${C.reset}, ${C.yellow}${errors} errors${C.reset}`);
  console.log();

  return failed === 0 && errors === 0;
}

// --- Compare files ---
function compareFiles(file1, file2, algorithm = 'sha256') {
  const hash1 = hashFile(file1, algorithm);
  const hash2 = hashFile(file2, algorithm);
  const match = hash1 === hash2;

  console.log();
  console.log(`  ${C.bold}File 1:${C.reset} ${file1}`);
  console.log(`  ${C.bold}Hash:${C.reset}   ${hash1}`);
  console.log();
  console.log(`  ${C.bold}File 2:${C.reset} ${file2}`);
  console.log(`  ${C.bold}Hash:${C.reset}   ${hash2}`);
  console.log();

  if (match) {
    console.log(`  ${C.green}✓ Files are identical${C.reset}`);
  } else {
    console.log(`  ${C.red}✗ Files are different${C.reset}`);
  }
  console.log();

  return match;
}

// --- Format size ---
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let algorithm = 'sha256';
  let checkFile = null;
  let compareFiles = null;
  let recursive = false;
  let outputFile = null;
  let quiet = false;
  let tag = false;
  const files = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-a' || arg === '--algorithm') {
      algorithm = args[++i]?.toLowerCase() || 'sha256';
    } else if (arg === '-c' || arg === '--check') {
      checkFile = args[++i];
    } else if (arg === '--compare') {
      compareFiles = [args[++i], args[++i]];
    } else if (arg === '-r' || arg === '--recursive') {
      recursive = true;
    } else if (arg === '-o' || arg === '--output') {
      outputFile = args[++i];
    } else if (arg === '-q' || arg === '--quiet') {
      quiet = true;
    } else if (arg === '--tag') {
      tag = true;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    }
  }

  return { algorithm, checkFile, compareFiles, recursive, outputFile, quiet, tag, files };
}

// --- Validate algorithm ---
const VALID_ALGORITHMS = ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512'];

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  // Validate algorithm
  if (!VALID_ALGORITHMS.includes(opts.algorithm)) {
    console.error(`  ${C.red}Error:${C.reset} Invalid algorithm: ${opts.algorithm}`);
    console.error(`  ${C.dim}Supported: ${VALID_ALGORITHMS.join(', ')}${C.reset}`);
    process.exit(1);
  }

  // Check mode
  if (opts.checkFile) {
    const success = verifyChecksums(opts.checkFile, opts.algorithm);
    process.exit(success ? 0 : 1);
  }

  // Compare mode
  if (opts.compareFiles) {
    const [f1, f2] = opts.compareFiles;
    const match = compareFiles(f1, f2, opts.algorithm);
    process.exit(match ? 0 : 1);
  }

  // Hash mode
  if (opts.files.length === 0) {
    console.error('  Error: No files specified');
    process.exit(1);
  }

  const allFiles = [];
  for (const file of opts.files) {
    try {
      const stat = statSync(file);
      if (stat.isFile()) {
        allFiles.push(file);
      } else if (stat.isDirectory()) {
        if (opts.recursive) {
          allFiles.push(...getFiles(file));
        } else {
          console.error(`  ${C.yellow}Skipping directory:${C.reset} ${file} (use -r for recursive)`);
        }
      }
    } catch (err) {
      console.error(`  ${C.red}Error:${C.reset} ${file}: ${err.message}`);
    }
  }

  if (allFiles.length === 0) {
    console.error('  No files to hash');
    process.exit(1);
  }

  const results = [];
  console.log();

  for (const file of allFiles) {
    try {
      const hash = hashFile(file, opts.algorithm);
      results.push({ file, hash });
      displayHash(file, hash, opts.algorithm, opts.quiet, opts.tag);
    } catch (err) {
      console.error(`  ${C.red}Error:${C.reset} ${file}: ${err.message}`);
    }
  }

  console.log();

  // Save to file
  if (opts.outputFile) {
    saveChecksums(results, opts.algorithm, opts.outputFile);
  }
}

main();
