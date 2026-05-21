#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const categories = ['csv-tools', 'json-tools', 'encoding-tools', 'system-tools'];

console.log('\n  Installing CLI Tools...\n');

let installed = 0;
let failed = 0;

for (const category of categories) {
  const categoryPath = join(process.cwd(), category);

  try {
    const tools = readdirSync(categoryPath).filter(dir => {
      const fullPath = join(categoryPath, dir);
      return statSync(fullPath).isDirectory();
    });

    console.log(`  ${category}:`);

    for (const tool of tools) {
      const toolPath = join(categoryPath, tool);
      try {
        execSync('npm link', { cwd: toolPath, stdio: 'pipe' });
        console.log(`    ✓ ${tool}`);
        installed++;
      } catch (err) {
        console.log(`    ✗ ${tool} (failed)`);
        failed++;
      }
    }
  } catch (err) {
    console.log(`  ${category}: not found`);
  }
}

console.log(`\n  Summary:`);
console.log(`  ─────────────────────────────`);
console.log(`  Installed: ${installed}`);
if (failed > 0) {
  console.log(`  Failed:    ${failed}`);
}
console.log(`\n  Done!\n`);
