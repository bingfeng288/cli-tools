import { randomUUID, randomBytes } from 'node:crypto';

export async function uuid(args) {
  let count = 1;
  let format = 'v4';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n') count = parseInt(args[++i]) || 1;
    if (args[i] === '-f' || args[i] === '--format') format = args[++i];
  }

  console.log();
  for (let i = 0; i < count; i++) {
    const id = randomUUID();
    if (format === 'short') {
      console.log(`  ${randomBytes(8).toString('hex')}`);
    } else if (format === 'no-dash') {
      console.log(`  ${id.replace(/-/g, '')}`);
    } else {
      console.log(`  ${id}`);
    }
  }
  console.log();
}
