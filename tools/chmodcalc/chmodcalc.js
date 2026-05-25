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
  \x1b[1mchmodcalc\x1b[0m - Chmod permission calculator

  \x1b[1mUsage:\x1b[0m
    chmodcalc <octal>
    chmodcalc <symbolic>
    chmodcalc --show <octal>
    chmodcalc --perms <user> <group> <other>

  \x1b[1mInput Formats:\x1b[0m
    Octal:      755, 644, 777, 600
    Symbolic:   rwxr-xr-x, rw-r--r--, u+rwx,g+rx,o+r

  \x1b[1mOptions:\x1b[0m
    --show <octal>        Show detailed permission breakdown
    --perms <u> <g> <o>   Set permissions for user, group, other
                          (each as octal digit 0-7)
    --symbolic            Output symbolic notation
    --octal               Output octal notation
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    chmodcalc 755
    chmodcalc rwxr-xr-x
    chmodcalc --show 644
    chmodcalc --perms 7 5 5
    chmodcalc --symbolic 644
`);
}

// --- Permission bits ---
const PERM_BITS = {
  read: 4,
  write: 2,
  execute: 1,
};

// --- Parse octal to permissions ---
function octalToPerms(octal) {
  const str = String(octal);
  if (!/^[0-7]{3,4}$/.test(str)) {
    throw new Error(`Invalid octal: ${octal}`);
  }

  // Handle 4-digit octal (with special bits)
  let digits = str;
  let special = 0;
  if (str.length === 4) {
    special = parseInt(str[0], 10);
    digits = str.slice(1);
  }

  const user = parseInt(digits[0], 10);
  const group = parseInt(digits[1], 10);
  const other = parseInt(digits[2], 10);

  return {
    special,
    user: digitToPerms(user),
    group: digitToPerms(group),
    other: digitToPerms(other),
    octal: digits,
    symbolic: permsToSymbolic(user, group, other),
  };
}

// --- Convert digit to permissions ---
function digitToPerms(digit) {
  return {
    read: (digit & 4) !== 0,
    write: (digit & 2) !== 0,
    execute: (digit & 1) !== 0,
  };
}

// --- Convert permissions to symbolic ---
function permsToSymbolic(user, group, other) {
  const toStr = (digit) => {
    let s = '';
    s += (digit & 4) ? 'r' : '-';
    s += (digit & 2) ? 'w' : '-';
    s += (digit & 1) ? 'x' : '-';
    return s;
  };

  return toStr(user) + toStr(group) + toStr(other);
}

// --- Parse symbolic to permissions ---
function symbolicToPerms(symbolic) {
  if (symbolic.length === 9) {
    // Full symbolic like rwxr-xr-x
    const user = parseTriplet(symbolic.slice(0, 3));
    const group = parseTriplet(symbolic.slice(3, 6));
    const other = parseTriplet(symbolic.slice(6, 9));

    return {
      user: digitToPerms(user),
      group: digitToPerms(group),
      other: digitToPerms(other),
      octal: `${user}${group}${other}`,
      symbolic,
    };
  } else if (symbolic.includes('+') || symbolic.includes('-') || symbolic.includes('=')) {
    // Symbolic like u+rwx,g+rx,o+r
    return parseSymbolicExpression(symbolic);
  } else {
    throw new Error(`Invalid symbolic: ${symbolic}`);
  }
}

// --- Parse triplet ---
function parseTriplet(triplet) {
  let digit = 0;
  if (triplet[0] === 'r') digit += 4;
  if (triplet[1] === 'w') digit += 2;
  if (triplet[2] === 'x' || triplet[2] === 's' || triplet[2] === 't') digit += 1;
  return digit;
}

// --- Parse symbolic expression ---
function parseSymbolicExpression(expr) {
  const perms = {
    user: { read: false, write: false, execute: false },
    group: { read: false, write: false, execute: false },
    other: { read: false, write: false, execute: false },
  };

  const parts = expr.split(',');
  for (const part of parts) {
    const match = part.match(/^([ugoa]+)([+\-=])([rwx]+)$/);
    if (!match) {
      throw new Error(`Invalid symbolic expression: ${part}`);
    }

    const [, who, op, permsStr] = match;
    const targets = [];

    for (const w of who) {
      switch (w) {
        case 'u': targets.push('user'); break;
        case 'g': targets.push('group'); break;
        case 'o': targets.push('other'); break;
        case 'a': targets.push('user', 'group', 'other'); break;
      }
    }

    const permBits = { read: false, write: false, execute: false };
    for (const p of permsStr) {
      switch (p) {
        case 'r': permBits.read = true; break;
        case 'w': permBits.write = true; break;
        case 'x': permBits.execute = true; break;
      }
    }

    for (const target of targets) {
      switch (op) {
        case '+':
          if (permBits.read) perms[target].read = true;
          if (permBits.write) perms[target].write = true;
          if (permBits.execute) perms[target].execute = true;
          break;
        case '-':
          if (permBits.read) perms[target].read = false;
          if (permBits.write) perms[target].write = false;
          if (permBits.execute) perms[target].execute = false;
          break;
        case '=':
          perms[target] = { ...permBits };
          break;
      }
    }
  }

  const user = permsToDigit(perms.user);
  const group = permsToDigit(perms.group);
  const other = permsToDigit(perms.other);

  return {
    user: perms.user,
    group: perms.group,
    other: perms.other,
    octal: `${user}${group}${other}`,
    symbolic: permsToSymbolic(user, group, other),
  };
}

// --- Convert permissions to digit ---
function permsToDigit(perms) {
  let digit = 0;
  if (perms.read) digit += 4;
  if (perms.write) digit += 2;
  if (perms.execute) digit += 1;
  return digit;
}

// --- Display permission breakdown ---
function showBreakdown(octal) {
  const perms = octalToPerms(octal);

  console.log(`\n  ${C.bold}Permission Breakdown:${C.reset} ${octal}\n`);

  console.log(`  ${C.bold}Octal:${C.reset}      ${perms.octal}`);
  console.log(`  ${C.bold}Symbolic:${C.reset}   ${perms.symbolic}\n`);

  // Permission matrix
  console.log(`  ${C.bold}Permission Matrix:${C.reset}\n`);
  console.log(`  ${C.dim}         Read  Write Exec${C.reset}`);
  console.log(`  ${C.dim}         ────  ───── ────${C.reset}`);

  const groups = ['user', 'group', 'other'];
  for (const group of groups) {
    const p = perms[group];
    const r = p.read ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    const w = p.write ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    const x = p.execute ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
    console.log(`  ${C.bold}${group.padEnd(6)}${C.reset}   ${r}     ${w}     ${x}`);
  }

  // Common uses
  console.log(`\n  ${C.bold}Common Uses:${C.reset}`);
  const commonUses = getCommonUses(octal);
  if (commonUses.length > 0) {
    for (const use of commonUses) {
      console.log(`  ${C.cyan}•${C.reset} ${use}`);
    }
  } else {
    console.log(`  ${C.dim}No common use${C.reset}`);
  }

  console.log();
}

// --- Get common uses ---
function getCommonUses(octal) {
  const uses = [];
  const str = String(octal);

  if (str === '755') uses.push('Executable files, scripts, directories');
  if (str === '644') uses.push('Regular files (readable by all, writable by owner)');
  if (str === '777') uses.push('Full permissions (use with caution!)');
  if (str === '600') uses.push('Private files (only owner can read/write)');
  if (str === '700') uses.push('Private executables/directories');
  if (str === '640') uses.push('Group-readable files');
  if (str === '750') uses.push('Group-accessible directories');
  if (str === '400') uses.push('Read-only private files');
  if (str === '444') uses.push('Read-only for everyone');

  return uses;
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let show = false;
  let symbolic = false;
  let octal = false;
  let perms = null;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--show') {
      show = true;
    } else if (arg === '--symbolic') {
      symbolic = true;
    } else if (arg === '--octal') {
      octal = true;
    } else if (arg === '--perms') {
      perms = [args[++i], args[++i], args[++i]];
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return { show, symbolic, octal, perms, positional };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  if (opts.perms) {
    // --perms mode
    const [user, group, other] = opts.perms.map(d => parseInt(d, 10));
    if (isNaN(user) || isNaN(group) || isNaN(other) || user < 0 || user > 7 || group < 0 || group > 7 || other < 0 || other > 7) {
      console.error(`  ${C.red}Error:${C.reset} Permissions must be digits 0-7`);
      process.exit(1);
    }
    const octal = `${user}${group}${other}`;
    if (opts.show) {
      showBreakdown(octal);
    } else {
      console.log(`  ${octal} -> ${permsToSymbolic(user, group, other)}`);
    }
    return;
  }

  if (opts.positional.length === 0) {
    showHelp();
    process.exit(1);
  }

  const input = opts.positional[0];

  if (opts.show) {
    showBreakdown(input);
    return;
  }

  // Detect input format
  if (/^[0-7]{3,4}$/.test(input)) {
    // Octal input
    const perms = octalToPerms(input);
    if (opts.symbolic) {
      console.log(`  ${perms.symbolic}`);
    } else {
      console.log(`  ${input} -> ${perms.symbolic}`);
    }
  } else if (/^[rwx\-sStT]{9}$/.test(input) || input.includes('+') || input.includes('-') || input.includes('=')) {
    // Symbolic input
    const perms = symbolicToPerms(input);
    if (opts.octal) {
      console.log(`  ${perms.octal}`);
    } else {
      console.log(`  ${input} -> ${perms.octal}`);
    }
  } else {
    console.error(`  ${C.red}Error:${C.reset} Invalid permission format: ${input}`);
    console.error(`  Use octal (755) or symbolic (rwxr-xr-x) format`);
    process.exit(1);
  }
}

main();
