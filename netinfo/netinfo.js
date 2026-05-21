#!/usr/bin/env node

import { networkInterfaces } from 'node:os';
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
  \x1b[1mnetinfo\x1b[0m - Network information tool

  \x1b[1mUsage:\x1b[0m
    netinfo [options]
    netinfo <command>

  \x1b[1mCommands:\x1b[0m
    interfaces          List network interfaces
    connections         Show active connections
    ports               Show listening ports
    dns                 Show DNS information
    routes              Show routing table

  \x1b[1mOptions:\x1b[0m
    -i, --interface <name>  Show specific interface
    -4, --ipv4              Show only IPv4
    -6, --ipv6              Show only IPv6
    -v, --verbose           Show detailed information
    -h, --help              Show this help

  \x1b[1mExamples:\x1b[0m
    netinfo
    netinfo interfaces
    netinfo connections
    netinfo ports
    netinfo -i en0
    netinfo -4
`);
}

// --- Get network interfaces ---
function getInterfaces(options = {}) {
  const { interfaceName = null, ipv4 = false, ipv6 = false, verbose = false } = options;

  const interfaces = networkInterfaces();
  const results = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    // Filter by interface name
    if (interfaceName && name !== interfaceName) continue;

    for (const addr of addrs) {
      // Filter by IP version
      if (ipv4 && addr.family !== 'IPv4') continue;
      if (ipv6 && addr.family !== 'IPv6') continue;

      results.push({
        name,
        address: addr.address,
        family: addr.family,
        internal: addr.internal,
        mac: addr.mac,
        netmask: addr.netmask,
        cidr: addr.cidr,
        scopeid: addr.scopeid,
      });
    }
  }

  return results;
}

// --- Get active connections ---
function getConnections() {
  try {
    const output = execSync('netstat -an 2>/dev/null || ss -tuln 2>/dev/null', { encoding: 'utf-8' });
    return output;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

// --- Get listening ports ---
function getListeningPorts() {
  try {
    const output = execSync('lsof -i -P -n 2>/dev/null | grep LISTEN 2>/dev/null || ss -tuln 2>/dev/null', { encoding: 'utf-8' });
    return output;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

// --- Get DNS info ---
function getDnsInfo() {
  try {
    const output = execSync('cat /etc/resolv.conf 2>/dev/null', { encoding: 'utf-8' });
    return output;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

// --- Get routing table ---
function getRoutes() {
  try {
    const output = execSync('netstat -rn 2>/dev/null || ip route 2>/dev/null', { encoding: 'utf-8' });
    return output;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

// --- Display interfaces ---
function displayInterfaces(interfaces, verbose = false) {
  if (interfaces.length === 0) {
    console.log(`  ${C.dim}No interfaces found${C.reset}`);
    return;
  }

  // Group by interface name
  const grouped = new Map();
  for (const iface of interfaces) {
    if (!grouped.has(iface.name)) {
      grouped.set(iface.name, []);
    }
    grouped.get(iface.name).push(iface);
  }

  console.log();
  for (const [name, addrs] of grouped) {
    const isUp = addrs.some(a => !a.internal);
    const status = isUp ? `${C.green}●${C.reset}` : `${C.dim}○${C.reset}`;

    console.log(`  ${status} ${C.bold}${name}${C.reset}`);

    for (const addr of addrs) {
      const type = addr.family === 'IPv4' ? 'IPv4' : 'IPv6';
      const internal = addr.internal ? ` ${C.dim}(internal)${C.reset}` : '';

      console.log(`    ${C.cyan}${type}${C.reset}: ${addr.address}${internal}`);

      if (verbose) {
        if (addr.mac) console.log(`    ${C.dim}MAC: ${addr.mac}${C.reset}`);
        if (addr.netmask) console.log(`    ${C.dim}Netmask: ${addr.netmask}${C.reset}`);
        if (addr.cidr) console.log(`    ${C.dim}CIDR: ${addr.cidr}${C.reset}`);
      }
    }
  }

  console.log(`\n  ${C.bold}Total:${C.reset} ${grouped.size} interfaces`);
  console.log();
}

// --- Display command output ---
function displayOutput(output) {
  console.log();
  const lines = output.trim().split('\n');
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let command = 'interfaces';
  let interfaceName = null;
  let ipv4 = false;
  let ipv6 = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-i' || arg === '--interface') {
      interfaceName = args[++i];
    } else if (arg === '-4' || arg === '--ipv4') {
      ipv4 = true;
    } else if (arg === '-6' || arg === '--ipv6') {
      ipv6 = true;
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (!arg.startsWith('-')) {
      command = arg;
    }
  }

  return { command, interfaceName, ipv4, ipv6, verbose };
}

// --- Main ---
function main() {
  const opts = parseArgs(process.argv);

  switch (opts.command) {
    case 'interfaces':
    case 'if':
      const interfaces = getInterfaces({
        interfaceName: opts.interfaceName,
        ipv4: opts.ipv4,
        ipv6: opts.ipv6,
        verbose: opts.verbose,
      });
      displayInterfaces(interfaces, opts.verbose);
      break;

    case 'connections':
    case 'conn':
      const connections = getConnections();
      displayOutput(connections);
      break;

    case 'ports':
      const ports = getListeningPorts();
      displayOutput(ports);
      break;

    case 'dns':
      const dns = getDnsInfo();
      displayOutput(dns);
      break;

    case 'routes':
    case 'route':
      const routes = getRoutes();
      displayOutput(routes);
      break;

    default:
      console.error(`  ${C.red}Error:${C.reset} Unknown command: ${opts.command}`);
      showHelp();
      process.exit(1);
  }
}

main();
