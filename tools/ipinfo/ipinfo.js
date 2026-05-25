#!/usr/bin/env node

import { networkInterfaces } from 'node:os';
import { request } from 'node:http';

// --- Colors ---
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

// --- Help ---
function showHelp() {
  console.log(`
  \x1b[1mipinfo\x1b[0m - IP address information

  \x1b[1mUsage:\x1b[0m
    ipinfo [ip] [options]

  \x1b[1mOptions:\x1b[0m
    --local           Show local IP addresses
    --public          Show public IP address
    --validate <ip>   Validate an IP address
    --subnet <ip/mask> Calculate subnet info
    --all             Show all information (default)
    -h, --help        Show this help

  \x1b[1mExamples:\x1b[0m
    ipinfo
    ipinfo 192.168.1.1
    ipinfo --local
    ipinfo --public
    ipinfo --validate 10.0.0.1
    ipinfo --subnet 192.168.1.0/24
`);
}

// --- Get local IPs ---
function getLocalIPs() {
  const interfaces = networkInterfaces();
  const results = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (!addr.internal) {
        results.push({
          interface: name,
          address: addr.address,
          family: addr.family,
          mac: addr.mac,
        });
      }
    }
  }

  return results;
}

// --- Get public IP ---
function getPublicIP() {
  return new Promise((resolve, reject) => {
    const req = request('http://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).ip);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// --- Validate IP ---
function validateIP(ip) {
  // IPv4
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);

  if (match) {
    const octets = match.slice(1).map(Number);
    const valid = octets.every(o => o >= 0 && o <= 255);

    return {
      valid,
      version: 'IPv4',
      binary: octets.map(o => o.toString(2).padStart(8, '0')).join('.'),
      hex: octets.map(o => o.toString(16).padStart(2, '0')).join(':'),
      isPrivate: isPrivateIP(octets),
      isLoopback: octets[0] === 127,
    };
  }

  // IPv6 (basic check)
  if (ip.includes(':')) {
    return {
      valid: /^[\da-f:]+$/i.test(ip),
      version: 'IPv6',
      isPrivate: false,
      isLoopback: ip === '::1',
    };
  }

  return { valid: false };
}

// --- Check if private IP ---
function isPrivateIP(octets) {
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

// --- Subnet calculation ---
function calculateSubnet(cidr) {
  const [ip, maskStr] = cidr.split('/');
  const mask = parseInt(maskStr);

  if (mask < 0 || mask > 32) {
    return { valid: false, error: 'Invalid mask' };
  }

  const ipParts = ip.split('.').map(Number);
  if (ipParts.length !== 4 || ipParts.some(p => p < 0 || p > 255)) {
    return { valid: false, error: 'Invalid IP' };
  }

  // Calculate subnet mask
  const maskBinary = (0xffffffff << (32 - mask)) >>> 0;
  const maskParts = [
    (maskBinary >>> 24) & 0xff,
    (maskBinary >>> 16) & 0xff,
    (maskBinary >>> 8) & 0xff,
    maskBinary & 0xff,
  ];

  // Network address
  const networkParts = ipParts.map((p, i) => p & maskParts[i]);

  // Broadcast address
  const broadcastParts = networkParts.map((p, i) => p | (~maskParts[i] & 0xff));

  // First and last host
  const firstHost = [...networkParts];
  firstHost[3] += 1;

  const lastHost = [...broadcastParts];
  lastHost[3] -= 1;

  // Total hosts
  const totalHosts = Math.pow(2, 32 - mask) - 2;

  return {
    valid: true,
    cidr: cidr,
    network: networkParts.join('.'),
    broadcast: broadcastParts.join('.'),
    mask: maskParts.join('.'),
    maskBinary: maskParts.map(p => p.toString(2).padStart(8, '0')).join('.'),
    firstHost: firstHost.join('.'),
    lastHost: lastHost.join('.'),
    totalHosts: Math.max(0, totalHosts),
    wildcard: maskParts.map(p => (~p & 0xff).toString()).join('.'),
  };
}

// --- IP class ---
function getIPClass(octets) {
  if (octets[0] >= 1 && octets[0] <= 126) return 'A';
  if (octets[0] >= 128 && octets[0] <= 191) return 'B';
  if (octets[0] >= 192 && octets[0] <= 223) return 'C';
  if (octets[0] >= 224 && octets[0] <= 239) return 'D (Multicast)';
  return 'E (Reserved)';
}

// --- Display ---
function displayLocalIPs() {
  const ips = getLocalIPs();

  console.log(`\n  ${C.bold}Local IP Addresses${C.reset}\n`);

  if (ips.length === 0) {
    console.log(`  ${C.dim}No external interfaces found${C.reset}\n`);
    return;
  }

  ips.forEach(ip => {
    console.log(`  ${C.bold}${ip.interface}${C.reset}`);
    console.log(`    ${C.cyan}${ip.address}${C.reset} (${ip.family})`);
    console.log(`    ${C.dim}MAC: ${ip.mac}${C.reset}`);
  });

  console.log();
}

async function displayPublicIP() {
  try {
    const ip = await getPublicIP();
    console.log(`\n  ${C.bold}Public IP:${C.reset} ${C.cyan}${ip}${C.reset}\n`);
  } catch (err) {
    console.error(`\n  ${C.red}Error:${C.reset} Could not fetch public IP\n`);
  }
}

function displayIPInfo(ip) {
  const validation = validateIP(ip);

  if (!validation.valid) {
    console.error(`\n  ${C.red}Error:${C.reset} Invalid IP address: ${ip}\n`);
    process.exit(1);
  }

  const octets = ip.split('.').map(Number);

  console.log(`\n  ${C.bold}IP Address Information${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);
  console.log(`  ${C.bold}Address:${C.reset}   ${C.cyan}${ip}${C.reset}`);
  console.log(`  ${C.bold}Version:${C.reset}   ${validation.version}`);

  if (validation.version === 'IPv4') {
    console.log(`  ${C.bold}Class:${C.reset}     ${getIPClass(octets)}`);
    console.log(`  ${C.bold}Binary:${C.reset}    ${validation.binary}`);
    console.log(`  ${C.bold}Hex:${C.reset}       ${validation.hex}`);
    console.log(`  ${C.bold}Type:${C.reset}      ${validation.isPrivate ? 'Private' : 'Public'}`);
    console.log(`  ${C.bold}Loopback:${C.reset}  ${validation.isLoopback ? 'Yes' : 'No'}`);
  }

  console.log();
}

function displaySubnet(cidr) {
  const result = calculateSubnet(cidr);

  if (!result.valid) {
    console.error(`\n  ${C.red}Error:${C.reset} ${result.error}\n`);
    process.exit(1);
  }

  console.log(`\n  ${C.bold}Subnet Information${C.reset}`);
  console.log(`  ${C.dim}${'─'.repeat(40)}${C.reset}`);
  console.log(`  ${C.bold}CIDR:${C.reset}        ${C.cyan}${result.cidr}${C.reset}`);
  console.log(`  ${C.bold}Network:${C.reset}     ${result.network}`);
  console.log(`  ${C.bold}Broadcast:${C.reset}   ${result.broadcast}`);
  console.log(`  ${C.bold}Subnet Mask:${C.reset} ${result.mask}`);
  console.log(`  ${C.bold}Wildcard:${C.reset}    ${result.wildcard}`);
  console.log(`  ${C.bold}First Host:${C.reset}  ${result.firstHost}`);
  console.log(`  ${C.bold}Last Host:${C.reset}   ${result.lastHost}`);
  console.log(`  ${C.bold}Total Hosts:${C.reset} ${result.totalHosts.toLocaleString()}`);
  console.log(`  ${C.bold}Mask Binary:${C.reset} ${result.maskBinary}`);
  console.log();
}

// --- Parse args ---
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  let ip = null;
  let mode = 'all';
  let subnet = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--local') mode = 'local';
    else if (arg === '--public') mode = 'public';
    else if (arg === '--validate') { mode = 'validate'; ip = args[++i]; }
    else if (arg === '--subnet') { mode = 'subnet'; subnet = args[++i]; }
    else if (arg === '--all') mode = 'all';
    else if (!arg.startsWith('-')) ip = arg;
  }

  return { ip, mode, subnet };
}

// --- Main ---
async function main() {
  const opts = parseArgs(process.argv);

  switch (opts.mode) {
    case 'local':
      displayLocalIPs();
      break;
    case 'public':
      await displayPublicIP();
      break;
    case 'validate':
      if (!opts.ip) {
        console.error('  Error: No IP address provided');
        process.exit(1);
      }
      const result = validateIP(opts.ip);
      console.log(`\n  ${opts.ip}: ${result.valid ? `${C.green}Valid${C.reset}` : `${C.red}Invalid${C.reset}`}\n`);
      break;
    case 'subnet':
      if (!opts.subnet) {
        console.error('  Error: No CIDR provided');
        process.exit(1);
      }
      displaySubnet(opts.subnet);
      break;
    case 'all':
      if (opts.ip) {
        displayIPInfo(opts.ip);
      } else {
        displayLocalIPs();
        await displayPublicIP();
      }
      break;
  }
}

main();
