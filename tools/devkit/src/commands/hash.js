import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

export async function hash(args) {
  let algorithm = 'sha256';
  let input = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-a' || args[i] === '--algorithm') {
      algorithm = args[++i];
    } else if (args[i] === '-f' || args[i] === '--file') {
      const file = args[++i];
      if (!existsSync(file)) {
        console.error(`  File not found: ${file}`);
        return;
      }
      input = readFileSync(file);
    } else {
      input = args[i];
    }
  }

  if (!input) {
    console.error('  Usage: devkit hash [-a algo] <string> or devkit hash -f <file>');
    console.error('  Algorithms: md5, sha1, sha256, sha512');
    return;
  }

  const h = createHash(algorithm);
  h.update(input);
  console.log(`\n  ${algorithm}: ${h.digest('hex')}\n`);
}
