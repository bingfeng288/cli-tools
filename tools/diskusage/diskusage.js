#!/usr/bin/env node

import { statSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

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
  \x1b[1mdiskusage\x1b[0m - Disk usage analyzer

  \x1b[1mUsage:\x1b[0m
    diskusage [path] [options]

  \x1b[1mOptions:\x1b[0m
    -d, --depth <n>       Max depth to scan (default: 1)
    -n, --top <n>         Show top N entries (default: 20)
    -s, --sort <field>    Sort by: size, name, count (default: size)
    -a, --all             Show hidden files
    -x, --exclude <pat>   Exclude pattern (glob)
    --dirs-only           Show only directories
    --files-only          Show only files
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    diskusage
    diskusage /home/user
    diskusage -d 2 -n 10
    diskusage -s name
    diskusage -x "node_modules"
    diskusage --files-only
`);
}

// --- Format bytes ---
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- Get directory size ---
function getDirSize(path, exclude = []) {
  let size = 0;
  let count = 0;

  try {
    const entries = readdirSync(path, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(path, entry.name);

      // Check exclude patterns
      if (exclude.some(pat => entry.name.includes(pat))) continue;

      try {
        if (entry.isFile()) {
          const stat = statSync(fullPath);
          size += stat.size;
          count++;
        } else if (entry.isDirectory()) {
          const result = getDirSize(fullPath, exclude);
          size += result.size;
          count += result.count;
        }
      } catch {
        // Skip files we can't access
      }
    }
  } catch {
    // Skip directories we can't access
  }

  return { size, count };
}

// --- Scan directory ---
function scanDirectory(path, options = {}) {
  const {
    depth = 1,
    maxDepth = 1,
    showHidden = false,
    exclude = [],
    dirsOnly = false,
    filesOnly = false,
  } = options;

  if (depth > maxDepth) return [];

  const results = [];

  try {
    const entries = readdirSync(path, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files unless --all
      if (!showHidden && entry.name.startsWith('.')) continue;

      const fullPath = join(path, entry.name);

      // Check exclude patterns
      if (exclude.some(pat => entry.name.includes(pat))) continue;

      try {
        if (entry.isFile()) {
          if (dirsOnly) continue;
          const stat = statSync(fullPath);
          results.push({
            name: entry.name,
            path: fullPath,
            size: stat.size,
            type: 'file',
            count: 1,
          });
        } else if (entry.isDirectory()) {
          if (filesOnly) continue;
          const { size, count } = getDirSize(fullPath, exclude);
          results.push({
            name: entry.name,
            path: fullPath,
            size,
            type: 'directory',
            count,
          });

          // Recurse if needed
          if (depth < maxDepth) {
            const children = scanDirectory(fullPath, {
              ...options,
              depth: depth + 1,
            });
            results.push(...children.map(c => ({
              ...c,
              name: `${entry.name}/${c.name}`,
            })));
          }
        }
      } catch {
        // Skip files we can't access
      }
    }
  } catch {
    // Skip directories we can't access
  }

  return results;
}

// --- Display results ---
function displayResults(results, options = {}) {
  const { sort = 'size', top = 20 } = options;

  // Sort
  const sorted = [...results].sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'count':
        return b.count - a.count;
      case 'size':
      default:
        return b.size - a.size;
    }
  });

  // Limit
  const limited = sorted.slice(0, top);

  if (limited.length === 0) {
    console.log(`  ${C.dim}No files found${C.reset}`);
    return;
  }

  // Calculate max widths
  const maxSize = Math.max(...limited.map(r => formatBytes(r.size).length));
  const maxCount = Math.max(...limited.map(r => String(r.count).length));

  // Display
  console.log();
  for (const item of limited) {
    const sizeStr = formatBytes(item.size).padStart(maxSize);
    const countStr = String(item.count).padStart(maxCount);
    const icon = item.type === 'directory' ? `${C.cyan}📁${C.reset}` : `${C.dim}📄${C.reset}`;
    const name = item.type === 'directory' ? `${C.bold}${item.name}${C.reset}` : item.name;

    console.log(`  ${icon} ${sizeStr}  ${C.dim}(${countStr})${C.reset}  ${name}`);
  }

  // Summary
  const totalSize = results.reduce((s, r) => s + r.size, 0);
  const totalCount = results.reduce((s, r) => s + r.count, 0);
  console.log(`\n  ${C.bold}Total:${C.reset} ${formatBytes(totalSize)} (${totalCount} items)`);
  console.log();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let path = '.';
  let depth = 1;
  let top = 20;
  let sort = 'size';
  let showHidden = false;
  let dirsOnly = false;
  let filesOnly = false;
  const exclude = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-d' || arg === '--depth') {
      depth = parseInt(args[++i]) || 1;
    } else if (arg === '-n' || arg === '--top') {
      top = parseInt(args[++i]) || 20;
    } else if (arg === '-s' || arg === '--sort') {
      sort = args[++i];
    } else if (arg === '-a' || arg === '--all') {
      showHidden = true;
    } else if (arg === '-x' || arg === '--exclude') {
      exclude.push(args[++i]);
    } else if (arg === '--dirs-only') {
      dirsOnly = true;
    } else if (arg === '--files-only') {
      filesOnly = true;
    } else if (!arg.startsWith('-')) {
      path = arg;
    }
  }

  return { path, depth, top, sort, showHidden, exclude, dirsOnly, filesOnly };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  // Resolve path
  const resolvedPath = resolve(opts.path);

  // Check if path exists
  try {
    const stat = statSync(resolvedPath);
    if (!stat.isDirectory()) {
      console.error(`  ${C.red}Error:${C.reset} Not a directory: ${resolvedPath}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    process.exit(1);
  }

  console.log(`\n  ${C.bold}Scanning:${C.reset} ${resolvedPath}`);

  // Scan
  const results = scanDirectory(resolvedPath, {
    maxDepth: opts.depth,
    showHidden: opts.showHidden,
    exclude: opts.exclude,
    dirsOnly: opts.dirsOnly,
    filesOnly: opts.filesOnly,
  });

  // Display
  displayResults(results, {
    sort: opts.sort,
    top: opts.top,
  });
}

main();
