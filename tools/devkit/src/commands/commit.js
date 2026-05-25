import { createInterface } from 'node:readline';
import { execSync } from 'node:child_process';

const TYPES = [
  { value: 'feat', label: 'feat', desc: 'A new feature' },
  { value: 'fix', label: 'fix', desc: 'A bug fix' },
  { value: 'docs', label: 'docs', desc: 'Documentation only' },
  { value: 'style', label: 'style', desc: 'Code style (formatting, etc)' },
  { value: 'refactor', label: 'refactor', desc: 'Code change that neither fixes a bug nor adds a feature' },
  { value: 'perf', label: 'perf', desc: 'Performance improvement' },
  { value: 'test', label: 'test', description: 'Adding or fixing tests' },
  { value: 'build', label: 'build', desc: 'Build system or external dependencies' },
  { value: 'ci', label: 'ci', desc: 'CI configuration' },
  { value: 'chore', label: 'chore', desc: 'Other changes that don\'t modify src or test' },
  { value: 'revert', label: 'revert', desc: 'Reverts a previous commit' },
];

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

export async function commit(args) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n  Conventional Commit Helper\n');

  // Show types
  TYPES.forEach((t, i) => {
    console.log(`    ${String(i + 1).padStart(2)}). ${t.label.padEnd(10)} ${t.desc}`);
  });
  console.log();

  const typeIdx = await ask(rl, '  Select type (1-11): ');
  const type = TYPES[parseInt(typeIdx) - 1]?.value || 'feat';

  const scope = await ask(rl, '  Scope (optional): ');
  const subject = await ask(rl, '  Subject: ');

  if (!subject.trim()) {
    console.error('  Subject is required.');
    rl.close();
    return;
  }

  const breaking = await ask(rl, '  Breaking change? (y/N): ');
  let message = type;
  if (scope.trim()) message += `(${scope.trim()})`;
  if (breaking.toLowerCase() === 'y') message += '!';
  message += `: ${subject.trim()}`;

  const body = await ask(rl, '  Body (optional): ');
  if (body.trim()) message += `\n\n${body.trim()}`;

  console.log(`\n  Commit message:\n  ${message.replace(/\n/g, '\n  ')}\n`);

  const confirm = await ask(rl, '  Commit? (Y/n): ');
  rl.close();

  if (confirm.toLowerCase() === 'n') {
    console.log('  Aborted.');
    return;
  }

  try {
    // Stage all changes
    execSync('git add -A', { stdio: 'pipe' });
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    console.log('\n  Committed successfully!');
  } catch (err) {
    console.error(`\n  Git error: ${err.message}`);
  }
}
