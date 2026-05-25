import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ENV_FILE = '.env';

function parseEnv(content) {
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

function serializeEnv(vars, comments = {}) {
  return Object.entries(vars)
    .map(([k, v]) => {
      const comment = comments[k] ? ` # ${comments[k]}` : '';
      const needsQuote = v.includes(' ') || v.includes('#') || v.includes('=');
      return `${k}=${needsQuote ? `"${v}"` : v}${comment}`;
    })
    .join('\n') + '\n';
}

export async function env(args) {
  const sub = args[0] || 'list';

  if (sub === 'list') {
    if (!existsSync(ENV_FILE)) {
      console.log('  No .env file found.');
      return;
    }
    const vars = parseEnv(readFileSync(ENV_FILE, 'utf-8'));
    console.log('\n  Environment variables:\n');
    const maxLen = Math.max(...Object.keys(vars).map(k => k.length));
    for (const [k, v] of Object.entries(vars)) {
      const masked = v.length > 4 ? v.slice(0, 2) + '*'.repeat(v.length - 4) + v.slice(-2) : '****';
      console.log(`    ${k.padEnd(maxLen + 2)} = ${masked}`);
    }
    console.log(`\n  Total: ${Object.keys(vars).length} variables\n`);
    return;
  }

  if (sub === 'get') {
    const key = args[1];
    if (!key) { console.error('  Usage: devkit env get <KEY>'); return; }
    if (!existsSync(ENV_FILE)) { console.log('  No .env file found.'); return; }
    const vars = parseEnv(readFileSync(ENV_FILE, 'utf-8'));
    if (key in vars) {
      console.log(`\n  ${key}=${vars[key]}\n`);
    } else {
      console.log(`  ${key} not found.`);
    }
    return;
  }

  if (sub === 'set') {
    const key = args[1];
    const val = args[2];
    if (!key || !val) { console.error('  Usage: devkit env set <KEY> <VALUE>'); return; }
    const vars = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf-8')) : {};
    vars[key] = val;
    writeFileSync(ENV_FILE, serializeEnv(vars));
    console.log(`  Set ${key}=${val}`);
    return;
  }

  if (sub === 'unset') {
    const key = args[1];
    if (!key) { console.error('  Usage: devkit env unset <KEY>'); return; }
    if (!existsSync(ENV_FILE)) { console.log('  No .env file found.'); return; }
    const vars = parseEnv(readFileSync(ENV_FILE, 'utf-8'));
    if (!(key in vars)) { console.log(`  ${key} not found.`); return; }
    delete vars[key];
    writeFileSync(ENV_FILE, serializeEnv(vars));
    console.log(`  Removed ${key}`);
    return;
  }

  if (sub === 'export') {
    if (!existsSync(ENV_FILE)) { console.log('  No .env file found.'); return; }
    const vars = parseEnv(readFileSync(ENV_FILE, 'utf-8'));
    for (const [k, v] of Object.entries(vars)) {
      console.log(`export ${k}="${v}"`);
    }
    return;
  }

  console.log('  Usage: devkit env [list|get|set|unset|export]');
}
