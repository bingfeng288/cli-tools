#!/usr/bin/env node

import { execSync } from 'node:child_process';

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
  \x1b[1mprocessinfo\x1b[0m - Process information tool

  \x1b[1mUsage:\x1b[0m
    processinfo [options]
    processinfo <name>

  \x1b[1mOptions:\x1b[0m
    -n, --top <n>         Show top N processes (default: 20)
    -s, --sort <field>    Sort by: cpu, mem, pid, name (default: cpu)
    -f, --filter <name>   Filter by process name
    -u, --user <user>     Filter by user
    --tree                Show process tree
    --details <pid>       Show process details
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    processinfo
    processinfo -n 10
    processinfo -s mem
    processinfo -f node
    processinfo --details 1234
    processinfo --tree
`);
}

// --- Get process list ---
function getProcesses() {
  try {
    // Use ps command to get process info
    const output = execSync('ps aux', { encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    const header = lines[0];
    const processes = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 11) {
        processes.push({
          user: parts[0],
          pid: parseInt(parts[1]),
          cpu: parseFloat(parts[2]),
          mem: parseFloat(parts[3]),
          vsz: parseInt(parts[4]),
          rss: parseInt(parts[5]),
          tt: parts[6],
          stat: parts[7],
          started: parts[8],
          time: parts[9],
          command: parts.slice(10).join(' '),
        });
      }
    }

    return processes;
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    return [];
  }
}

// --- Get process tree ---
function getProcessTree() {
  try {
    const output = execSync('ps aux --forest 2>/dev/null || ps aux', { encoding: 'utf-8' });
    return output;
  } catch (err) {
    console.error(`  ${C.red}Error:${C.reset} ${err.message}`);
    return '';
  }
}

// --- Get process details ---
function getProcessDetails(pid) {
  try {
    const output = execSync(`ps -p ${pid} -o pid,ppid,user,%cpu,%mem,vsz,rss,stat,start,time,command`, { encoding: 'utf-8' });
    return output;
  } catch (err) {
    return null;
  }
}

// --- Format memory ---
function formatMemory(kb) {
  if (kb >= 1024 * 1024) {
    return (kb / (1024 * 1024)).toFixed(2) + ' GB';
  } else if (kb >= 1024) {
    return (kb / 1024).toFixed(2) + ' MB';
  } else {
    return kb + ' KB';
  }
}

// --- Display processes ---
function displayProcesses(processes, options = {}) {
  const { sort = 'cpu', top = 20 } = options;

  // Sort
  const sorted = [...processes].sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.command.localeCompare(b.command);
      case 'pid':
        return a.pid - b.pid;
      case 'mem':
        return b.mem - a.mem;
      case 'cpu':
      default:
        return b.cpu - a.cpu;
    }
  });

  // Limit
  const limited = sorted.slice(0, top);

  if (limited.length === 0) {
    console.log(`  ${C.dim}No processes found${C.reset}`);
    return;
  }

  // Calculate max widths
  const maxPid = Math.max(...limited.map(p => String(p.pid).length));
  const maxCpu = Math.max(...limited.map(p => String(p.cpu).length));
  const maxMem = Math.max(...limited.map(p => String(p.mem).length));

  // Header
  console.log();
  console.log(`  ${C.bold}${'PID'.padStart(maxPid)}  ${'CPU%'.padStart(maxCpu)}  ${'MEM%'.padStart(maxMem)}  ${'RSS'.padStart(10)}  USER         COMMAND${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(maxPid)}  ${'─'.repeat(maxCpu)}  ${'─'.repeat(maxMem)}  ${'─'.repeat(10)}  ${'─'.repeat(12)}  ${'─'.repeat(30)}${C.reset}`);

  // Display
  for (const proc of limited) {
    const pid = String(proc.pid).padStart(maxPid);
    const cpu = String(proc.cpu).padStart(maxCpu);
    const mem = String(proc.mem).padStart(maxMem);
    const rss = formatMemory(proc.rss).padStart(10);
    const user = proc.user.padEnd(12);
    const cmd = proc.command.length > 50 ? proc.command.slice(0, 47) + '...' : proc.command;

    // Color based on CPU/Memory usage
    const cpuColor = proc.cpu > 50 ? C.red : proc.cpu > 10 ? C.yellow : C.green;
    const memColor = proc.mem > 50 ? C.red : proc.mem > 10 ? C.yellow : C.green;

    console.log(`  ${pid}  ${cpuColor}${cpu}${C.reset}  ${memColor}${mem}${C.reset}  ${rss}  ${user}  ${cmd}`);
  }

  // Summary
  const totalCpu = processes.reduce((s, p) => s + p.cpu, 0);
  const totalMem = processes.reduce((s, p) => s + p.mem, 0);
  console.log(`\n  ${C.bold}Total:${C.reset} ${processes.length} processes, ${totalCpu.toFixed(1)}% CPU, ${totalMem.toFixed(1)}% MEM`);
  console.log();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let top = 20;
  let sort = 'cpu';
  let filter = null;
  let user = null;
  let tree = false;
  let details = null;
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--top') {
      top = parseInt(args[++i]) || 20;
    } else if (arg === '-s' || arg === '--sort') {
      sort = args[++i];
    } else if (arg === '-f' || arg === '--filter') {
      filter = args[++i];
    } else if (arg === '-u' || arg === '--user') {
      user = args[++i];
    } else if (arg === '--tree') {
      tree = true;
    } else if (arg === '--details') {
      details = parseInt(args[++i]);
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return { top, sort, filter, user, tree, details, positional };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  // Process tree
  if (opts.tree) {
    const tree = getProcessTree();
    console.log(tree);
    return;
  }

  // Process details
  if (opts.details) {
    const details = getProcessDetails(opts.details);
    if (details) {
      console.log(details);
    } else {
      console.error(`  ${C.red}Error:${C.reset} Process not found: ${opts.details}`);
      process.exit(1);
    }
    return;
  }

  // Get processes
  let processes = getProcesses();

  // Filter by name
  if (opts.filter) {
    processes = processes.filter(p =>
      p.command.toLowerCase().includes(opts.filter.toLowerCase())
    );
  }

  // Filter by user
  if (opts.user) {
    processes = processes.filter(p => p.user === opts.user);
  }

  // Filter by positional argument (process name)
  if (opts.positional.length > 0) {
    const name = opts.positional[0];
    processes = processes.filter(p =>
      p.command.toLowerCase().includes(name.toLowerCase())
    );
  }

  // Display
  displayProcesses(processes, {
    sort: opts.sort,
    top: opts.top,
  });
}

main();
