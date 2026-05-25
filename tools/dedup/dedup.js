#!/usr/bin/env node

import { readdirSync, statSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { createHash } from 'node:crypto';

const IGNORE = new Set(['.git', 'node_modules', '.DS_Store', '__pycache__', '.venv', 'venv', 'dist', 'build', '.next']);

// --- File walking ---
function walk(dir, results = []) {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORE.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, results);
      } else if (entry.isFile()) {
        const stat = statSync(full);
        results.push({ path: full, size: stat.size, mtime: stat.mtime });
      }
    }
  } catch {}
  return results;
}

// --- Hashing ---
function hashFile(path) {
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}

function quickHash(path, size) {
  // Read first and last 4KB for quick comparison
  const content = readFileSync(path);
  const start = content.slice(0, 4096);
  const end = content.slice(-4096);
  return createHash('md5').update(start).update(end).digest('hex');
}

// --- Find duplicates ---
function findDuplicates(dir, options = {}) {
  const minSize = options.minSize || 0;
  const files = walk(dir);

  console.log(`\n  Scanning ${files.length} files...\n`);

  // Group by size first (fast filter)
  const bySize = {};
  for (const f of files) {
    if (f.size < minSize) continue;
    if (!bySize[f.size]) bySize[f.size] = [];
    bySize[f.size].push(f);
  }

  // Only keep groups with 2+ files
  const candidates = Object.values(bySize).filter(g => g.length >= 2);
  if (candidates.length === 0) {
    console.log('  No potential duplicates found by size.\n');
    return [];
  }

  const totalCandidates = candidates.reduce((s, g) => s + g.length, 0);
  console.log(`  ${totalCandidates} files with matching sizes...`);

  // Quick hash (first+last 4KB)
  const byQuickHash = {};
  for (const group of candidates) {
    for (const f of group) {
      try {
        const qh = quickHash(f.path, f.size);
        const key = `${f.size}-${qh}`;
        if (!byQuickHash[key]) byQuickHash[key] = [];
        byQuickHash[key].push(f);
      } catch {}
    }
  }

  const quickCandidates = Object.values(byQuickHash).filter(g => g.length >= 2);
  if (quickCandidates.length === 0) {
    console.log('  No duplicates found after quick hash.\n');
    return [];
  }

  console.log(`  ${quickCandidates.length} groups after quick hash, full hashing...`);

  // Full hash
  const byFullHash = {};
  for (const group of quickCandidates) {
    for (const f of group) {
      try {
        const fh = hashFile(f.path);
        if (!byFullHash[fh]) byFullHash[fh] = [];
        byFullHash[fh].push(f);
      } catch {}
    }
  }

  const duplicates = Object.entries(byFullHash)
    .filter(([, group]) => group.length >= 2)
    .map(([hash, group]) => ({
      hash,
      size: group[0].size,
      files: group.sort((a, b) => a.mtime - b.mtime), // Oldest first
      waste: group[0].size * (group.length - 1),
    }));

  return duplicates;
}

// --- Format bytes ---
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

// --- Commands ---
const commands = {
  scan(args) {
    const dir = args[0] || '.';
    const minSize = parseInt(args.find(a => a.startsWith('--min='))?.split('=')[1]) || 0;

    const duplicates = findDuplicates(dir, { minSize });

    if (duplicates.length === 0) {
      console.log('  No duplicates found!\n');
      return;
    }

    const totalWaste = duplicates.reduce((s, d) => s + d.waste, 0);
    const totalFiles = duplicates.reduce((s, d) => s + d.files.length, 0);

    console.log(`\n  Found ${duplicates.length} duplicate groups (${totalFiles} files)\n`);
    console.log(`  Potential savings: ${formatBytes(totalWaste)}\n`);

    duplicates.forEach((dup, i) => {
      console.log(`  Group ${i + 1} (${formatBytes(dup.size)} each, ${dup.files.length} files):`);
      dup.files.forEach((f, j) => {
        const marker = j === 0 ? '  [keep]' : '  [dup] ';
        console.log(`    ${marker} ${relative(dir, f.path)}`);
      });
      console.log();
    });
  },

  report(args) {
    const dir = args[0] || '.';
    const duplicates = findDuplicates(dir);

    if (duplicates.length === 0) {
      console.log('  No duplicates found!\n');
      return;
    }

    // Group by extension
    const byExt = {};
    duplicates.forEach(dup => {
      const ext = extname(dup.files[0].path).toLowerCase() || '(no ext)';
      if (!byExt[ext]) byExt[ext] = { count: 0, waste: 0 };
      byExt[ext].count += dup.files.length - 1;
      byExt[ext].waste += dup.waste;
    });

    console.log('\n  Duplicate Report by Extension:\n');
    Object.entries(byExt)
      .sort((a, b) => b[1].waste - a[1].waste)
      .forEach(([ext, data]) => {
        const bar = '█'.repeat(Math.ceil(data.waste / Math.max(...Object.values(byExt).map(v => v.waste)) * 30));
        console.log(`    ${ext.padEnd(12)} ${formatBytes(data.waste).padStart(10)}  ${bar}  (${data.count} dupes)`);
      });

    const totalWaste = duplicates.reduce((s, d) => s + d.waste, 0);
    console.log(`\n  Total potential savings: ${formatBytes(totalWaste)}\n`);
  },

  clean(args) {
    const dir = args[0] || '.';
    const dryRun = args.includes('--dry-run');

    const duplicates = findDuplicates(dir);
    if (duplicates.length === 0) {
      console.log('  No duplicates found!\n');
      return;
    }

    let removed = 0;
    let saved = 0;

    duplicates.forEach(dup => {
      // Keep the oldest file, remove the rest
      const [, ...toRemove] = dup.files;
      toRemove.forEach(f => {
        if (dryRun) {
          console.log(`  [dry-run] Would remove: ${f.path}`);
        } else {
          try {
            unlinkSync(f.path);
            console.log(`  Removed: ${f.path}`);
          } catch (err) {
            console.error(`  Error removing ${f.path}: ${err.message}`);
          }
        }
        removed++;
        saved += f.size;
      });
    });

    console.log(`\n  ${dryRun ? 'Would remove' : 'Removed'}: ${removed} files`);
    console.log(`  Space ${dryRun ? 'would be' : ''} saved: ${formatBytes(saved)}\n`);
  },

  help() {
    console.log(`
  dedup - Find and remove duplicate files

  Usage: dedup <command> [directory] [options]

  Commands:
    scan [dir]          Find duplicates and show results
    report [dir]        Show duplicate report by file type
    clean [dir]         Remove duplicates (keeps oldest)
    clean [dir] --dry-run  Preview what would be removed

  Options:
    --min=N             Minimum file size in bytes

  Examples:
    dedup scan ~/Downloads
    dedup report .
    dedup clean ~/Pictures --dry-run
    dedup scan . --min=1024
`);
  },
};

// --- Main ---
const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === '-h' || cmd === '--help') {
  commands.help();
} else if (commands[cmd]) {
  commands[cmd](args.slice(1));
} else {
  console.error(`  Unknown command: ${cmd}`);
  console.error(`  Run 'dedup --help' for usage.`);
  process.exit(1);
}
