#!/usr/bin/env node

import { createConnection } from 'node:net';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// --- Common ports ---
const COMMON_PORTS = {
  20: 'FTP Data', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP',
  53: 'DNS', 67: 'DHCP', 68: 'DHCP', 80: 'HTTP', 110: 'POP3',
  119: 'NNTP', 123: 'NTP', 143: 'IMAP', 161: 'SNMP', 194: 'IRC',
  389: 'LDAP', 443: 'HTTPS', 445: 'SMB', 465: 'SMTPS', 514: 'Syslog',
  587: 'SMTP', 636: 'LDAPS', 993: 'IMAPS', 995: 'POP3S', 1080: 'SOCKS',
  1433: 'MSSQL', 1434: 'MSSQL', 1521: 'Oracle', 1723: 'PPTP', 2049: 'NFS',
  2082: 'cPanel', 2083: 'cPanel SSL', 2086: 'WHM', 2087: 'WHM SSL',
  2095: 'Webmail', 2096: 'Webmail SSL', 3000: 'Dev Server', 3306: 'MySQL',
  3389: 'RDP', 4443: 'HTTPS Alt', 5432: 'PostgreSQL', 5900: 'VNC',
  6379: 'Redis', 6667: 'IRC', 8000: 'HTTP Alt', 8080: 'HTTP Proxy',
  8443: 'HTTPS Alt', 8888: 'HTTP Alt', 9090: 'Web Console', 9200: 'Elasticsearch',
  9300: 'Elasticsearch', 11211: 'Memcached', 27017: 'MongoDB',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mportscan\x1b[0m - Port scanner

  \x1b[1mUsage:\x1b[0m
    portscan <host> [ports] [options]

  \x1b[1mPorts:\x1b[0m
    80                    Single port
    80,443,8080           Multiple ports
    1-1024                Port range
    common                Top 100 common ports
    all                   All ports (1-65535)

  \x1b[1mOptions:\x1b[0m
    -t, --timeout <ms>    Connection timeout (default: 1000)
    -c, --concurrent <n>  Max concurrent scans (default: 50)
    --no-service          Don't show service names
    -h, --help            Show this help

  \x1b[1mExamples:\x1b[0m
    portscan localhost
    portscan localhost 80,443,3000
    portscan 192.168.1.1 1-1024
    portscan example.com common
    portscan localhost -t 500
`);
}

// --- Parse port range ---
function parsePorts(input) {
  if (input === 'common') {
    return Object.keys(COMMON_PORTS).map(Number);
  }
  if (input === 'all') {
    return Array.from({ length: 65535 }, (_, i) => i + 1);
  }

  const ports = new Set();
  for (const part of input.split(',')) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) ports.add(i);
    } else {
      ports.add(Number(part));
    }
  }
  return [...ports].sort((a, b) => a - b);
}

// --- Scan single port ---
function scanPort(host, port, timeout = 1000) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout });
    let resolved = false;

    socket.on('connect', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ port, open: true });
      }
    });

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ port, open: false });
      }
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ port, open: false });
      }
    });
  });
}

// --- Scan with concurrency control ---
async function scanPorts(host, ports, timeout = 1000, concurrent = 50) {
  const results = [];
  const queue = [...ports];
  const running = new Set();

  const processNext = async () => {
    if (queue.length === 0) return;
    const port = queue.shift();
    const promise = scanPort(host, port, timeout).then(result => {
      results.push(result);
      running.delete(promise);
    });
    running.add(promise);
    await processNext();
  };

  // Start initial batch
  for (let i = 0; i < Math.min(concurrent, ports.length); i++) {
    await processNext();
  }

  // Wait for all to complete
  while (running.size > 0) {
    await Promise.race(running);
    if (queue.length > 0) {
      await processNext();
    }
  }

  return results.sort((a, b) => a.port - b.port);
}

// --- Display ---
function displayResults(host, results, showService = true) {
  const openPorts = results.filter(r => r.open);
  const closedCount = results.length - openPorts.length;

  console.log();
  console.log(`  ${C.bold}Port Scan Results${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);
  console.log(`  ${C.bold}Host:${C.reset} ${C.cyan}${host}${C.reset}`);
  console.log(`  ${C.bold}Scanned:${C.reset} ${results.length} ports`);
  console.log(`  ${C.green}Open:${C.reset} ${openPorts.length}`);
  console.log(`  ${C.red}Closed:${C.reset} ${closedCount}`);
  console.log();

  if (openPorts.length > 0) {
    console.log(`  ${C.bold}Open Ports:${C.reset}\n`);
    console.log(`  ${C.dim}PORT     STATE  SERVICE${C.reset}`);
    console.log(`  ${C.dim}${'─'.repeat(30)}${C.reset}`);

    openPorts.forEach(({ port }) => {
      const service = showService ? (COMMON_PORTS[port] || '') : '';
      console.log(`  ${C.green}${String(port).padEnd(8)}${C.reset} open   ${C.dim}${service}${C.reset}`);
    });
  } else {
    console.log(`  ${C.yellow}No open ports found${C.reset}`);
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

  let host = null;
  let ports = 'common';
  let timeout = 1000;
  let concurrent = 50;
  let showService = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-t' || arg === '--timeout') {
      timeout = parseInt(args[++i]) || 1000;
    } else if (arg === '-c' || arg === '--concurrent') {
      concurrent = parseInt(args[++i]) || 50;
    } else if (arg === '--no-service') {
      showService = false;
    } else if (!arg.startsWith('-')) {
      if (!host) {
        host = arg;
      } else {
        ports = arg;
      }
    }
  }

  return { host, ports, timeout, concurrent, showService };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.host) {
    showHelp();
    return;
  }

  const portList = parsePorts(opts.ports);

  console.log(`\n  Scanning ${opts.host} (${portList.length} ports)...\n`);

  const results = await scanPorts(opts.host, portList, opts.timeout, opts.concurrent);
  displayResults(opts.host, results, opts.showService);
}

main();
