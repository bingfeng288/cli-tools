#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const toolsDir = join(process.cwd(), 'tools');

console.log('\n  Installing CLI Tools...\n');

let installed = 0;
let failed = 0;

const tools = readdirSync(toolsDir).filter(dir => {
  return statSync(join(toolsDir, dir)).isDirectory();
}).sort();

for (const tool of tools) {
  const toolPath = join(toolsDir, tool);
  try {
    execSync('npm link', { cwd: toolPath, stdio: 'pipe' });
    console.log(`    ✓ ${tool}`);
    installed++;
  } catch (err) {
    console.log(`    ✗ ${tool} (failed)`);
    failed++;
  }
}

console.log(`\n  Summary:`);
console.log(`  ─────────────────────────────`);
console.log(`  Total:     ${tools.length}`);
console.log(`  Installed: ${installed}`);
if (failed > 0) {
  console.log(`  Failed:    ${failed}`);
}
console.log(`\n  Done!\n`);
