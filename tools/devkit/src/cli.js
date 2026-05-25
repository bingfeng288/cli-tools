#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { commands } from './commands/index.js';

const HELP = `
  devkit - Developer CLI Toolkit

  Usage: devkit <command> [options]

  Commands:
    commit          Interactive conventional commit
    stats           Code statistics for current project
    env             Environment variable manager
    license         Generate LICENSE file
    serve           Quick static file server
    hash            Hash strings or files (md5/sha256/sha512)
    uuid            Generate UUIDs
    time            Timestamp & date utilities
    ip              Show local/public IP addresses
    ports           Check which ports are in use
    json            Validate & pretty-print JSON
    base64          Encode/decode base64
    qr              Generate QR code in terminal

  Options:
    -h, --help      Show this help
    -v, --version   Show version

  Examples:
    devkit commit
    devkit stats
    devkit serve 8080
    devkit uuid -n 5
    devkit hash -a sha256 "hello"
    devkit time
    devkit ports
`;

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log(HELP);
    return;
  }

  if (cmd === '-v' || cmd === '--version') {
    console.log('1.0.0');
    return;
  }

  const handler = commands[cmd];
  if (!handler) {
    console.error(`  Unknown command: ${cmd}`);
    console.error(`  Run 'devkit --help' for available commands.`);
    process.exit(1);
  }

  await handler(args.slice(1));
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
