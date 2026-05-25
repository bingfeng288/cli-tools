import { readFileSync, existsSync } from 'node:fs';

export async function json(args) {
  let input = '';

  // Read from file or argument
  if (args[0] === '-f' || args[0] === '--file') {
    const file = args[1];
    if (!file || !existsSync(file)) {
      console.error('  File not found');
      return;
    }
    input = readFileSync(file, 'utf-8');
  } else if (args[0]) {
    input = args.join(' ');
  } else {
    // Read from stdin
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    input = Buffer.concat(chunks).toString();
  }

  if (!input.trim()) {
    console.error('  Usage: devkit json <string> or devkit json -f <file>');
    return;
  }

  try {
    const parsed = JSON.parse(input);
    console.log(JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error(`  Invalid JSON: ${err.message}`);
    process.exit(1);
  }
}
