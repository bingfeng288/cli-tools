#!/usr/bin/env node

import { lstatSync, readlinkSync, symlinkSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';

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
  \x1b[1msymlinks\x1b[0m - Symbolic link manager

  \x1b[1mUsage:\x1b[0m
    symlinks create <target> <link>
    symlinks check <path>
    symlinks find <directory>
    symlinks broken <directory>
    symlinks fix <directory>
    symlinks remove <link>

  \x1b[1mCommands:\x1b[0m
    create <target> <link>    Create a symbolic link
    check <path>              Check if path is a symlink
    find <directory>          Find all symlinks in directory
    broken <directory>        Find broken symlinks
    fix <directory>           Fix broken symlinks (remove them)
    remove <link>             Remove a symbolic link

  \x1b[1mOptions:\x1b[0m
    -r, --relative    Create relative symlink
    -f, --force       Force overwrite existing link
    -v, --verbose     Show detailed information
    -h, --help        Show this help

  \x1b[1mExamples:\x1b[0m
    symlinks create /usr/local/bin/node /usr/bin/node
    symlinks create -r ../file.txt link.txt
    symlinks check /usr/bin/node
    symlinks find /usr/local/bin
    symlinks broken /usr/local/bin
    symlinks fix /usr/local/bin
`);
}

// --- Check if path is symlink ---
function isSymlink(path) {
  try {
    const stat = lstatSync(path);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

// --- Get symlink info ---
function getSymlinkInfo(path) {
  try {
    const stat = lstatSync(path);
    if (!stat.isSymbolicLink()) {
      return null;
    }

    const target = readlinkSync(path);
    const resolvedTarget = resolve(dirname(path), target);
    const exists = existsSync(resolvedTarget);

    return {
      path,
      target,
      resolvedTarget,
      exists,
      isRelative: !isAbsolute(target),
    };
  } catch (err) {
    return null;
  }
}

// --- Create symlink ---
function createSymlink(target, link, options = {}) {
  const { relative: useRelative = false, force = false } = options;

  // Check if link already exists
  if (existsSync(link) || isSymlink(link)) {
    if (!force) {
      console.error(`  ${C.red}Error:${C.reset} Link already exists: ${link}`);
      console.error(`  Use --force to overwrite`);
      return false;
    }
    unlinkSync(link);
  }

  // Resolve target path
  let targetPath = target;
  if (useRelative) {
    targetPath = relative(dirname(resolve(link)), resolve(target));
  }

  try {
    symlinkSync(targetPath, link);
    console.log(`  ${C.green}Created:${C.reset} ${link} -> ${targetPath}`);
    return true;
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    return false;
  }
}

// --- Check symlink ---
function checkSymlink(path, verbose = false) {
  const info = getSymlinkInfo(path);

  if (!info) {
    if (isSymlink(path)) {
      console.log(`  ${C.red}Broken:${C.reset} ${path}`);
    } else if (existsSync(path)) {
      console.log(`  ${C.dim}Not a symlink:${C.reset} ${path}`);
    } else {
      console.log(`  ${C.red}Not found:${C.reset} ${path}`);
    }
    return;
  }

  const status = info.exists ? `${C.green}OK${C.reset}` : `${C.red}Broken${C.reset}`;
  console.log(`  ${C.bold}${path}${C.reset}`);
  console.log(`    Target: ${info.target}`);
  console.log(`    Status: ${status}`);

  if (verbose) {
    console.log(`    Resolved: ${info.resolvedTarget}`);
    console.log(`    Relative: ${info.isRelative ? 'yes' : 'no'}`);
  }
}

// --- Find symlinks ---
function findSymlinks(dir, options = {}) {
  const { broken = false, verbose = false } = options;

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    return [];
  }

  const results = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      const info = getSymlinkInfo(fullPath);
      if (info) {
        if (broken && info.exists) continue;
        if (!broken && !info.exists) continue;
        results.push(info);
      }
    }
  }

  return results;
}

// --- Display symlinks ---
function displaySymlinks(symlinks, verbose = false) {
  if (symlinks.length === 0) {
    console.log(`  ${C.dim}No symlinks found${C.reset}`);
    return;
  }

  for (const info of symlinks) {
    const status = info.exists ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    console.log(`  ${status} ${info.path} -> ${info.target}`);

    if (verbose) {
      console.log(`    ${C.dim}Resolved: ${info.resolvedTarget}${C.reset}`);
    }
  }

  console.log(`\n  ${C.bold}Total:${C.reset} ${symlinks.length}`);
}

// --- Fix broken symlinks ---
function fixBrokenSymlinks(dir, verbose = false) {
  const broken = findSymlinks(dir, { broken: true });

  if (broken.length === 0) {
    console.log(`  ${C.green}No broken symlinks found${C.reset}`);
    return;
  }

  console.log(`  ${C.yellow}Found ${broken.length} broken symlink${broken.length !== 1 ? 's' : ''}:${C.reset}\n`);

  let fixed = 0;
  for (const info of broken) {
    try {
      unlinkSync(info.path);
      console.log(`  ${C.green}Removed:${C.reset} ${info.path}`);
      fixed++;
    } catch (err) {
      console.error(`  ${C.red}Error removing ${info.path}:${C.reset} ${err.message}`);
    }
  }

  console.log(`\n  ${C.bold}Fixed:${C.reset} ${fixed} of ${broken.length}`);
}

// --- Remove symlink ---
function removeSymlink(path) {
  if (!isSymlink(path)) {
    console.error(`  ${C.red}Error:${C.reset} Not a symlink: ${path}`);
    return false;
  }

  try {
    unlinkSync(path);
    console.log(`  ${C.green}Removed:${C.reset} ${path}`);
    return true;
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    return false;
  }
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let command = null;
  let relative = false;
  let force = false;
  let verbose = false;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-r' || arg === '--relative') {
      relative = true;
    } else if (arg === '-f' || arg === '--force') {
      force = true;
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

  return { command, relative, force, verbose, positional };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (!opts.command) {
    showHelp();
    process.exit(1);
  }

  switch (opts.command) {
    case 'create':
      if (opts.positional.length < 2) {
        console.error(`  ${C.red}Error:${C.reset} Usage: symlinks create <target> <link>`);
        process.exit(1);
      }
      createSymlink(opts.positional[0], opts.positional[1], {
        relative: opts.relative,
        force: opts.force,
      });
      break;

    case 'check':
      if (opts.positional.length < 1) {
        console.error(`  ${C.red}Error:${C.reset} Usage: symlinks check <path>`);
        process.exit(1);
      }
      checkSymlink(opts.positional[0], opts.verbose);
      break;

    case 'find':
      if (opts.positional.length < 1) {
        console.error(`  ${C.red}Error:${C.reset} Usage: symlinks find <directory>`);
        process.exit(1);
      }
      const found = findSymlinks(opts.positional[0], { broken: false });
      displaySymlinks(found, opts.verbose);
      break;

    case 'broken':
      if (opts.positional.length < 1) {
        console.error(`  ${C.red}Error:${C.reset} Usage: symlinks broken <directory>`);
        process.exit(1);
      }
      const broken = findSymlinks(opts.positional[0], { broken: true });
      displaySymlinks(broken, opts.verbose);
      break;

    case 'fix':
      if (opts.positional.length < 1) {
        console.error(`  ${C.red}Error:${C.reset} Usage: symlinks fix <directory>`);
        process.exit(1);
      }
      fixBrokenSymlinks(opts.positional[0], opts.verbose);
      break;

    case 'remove':
      if (opts.positional.length < 1) {
        console.error(`  ${C.red}Error:${C.reset} Usage: symlinks remove <link>`);
        process.exit(1);
      }
      removeSymlink(opts.positional[0]);
      break;

    default:
      console.error(`  ${C.red}Error:${C.reset} Unknown command: ${opts.command}`);
      showHelp();
      process.exit(1);
  }
}

main();
