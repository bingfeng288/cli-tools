import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const IGNORE = new Set(['node_modules', '.git', '.DS_Store', 'dist', 'build', '__pycache__', '.venv', 'venv', '.next', '.nuxt']);

const LANG_MAP = {
  '.js': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.jsx': 'JavaScript',
  '.py': 'Python', '.rb': 'Ruby', '.go': 'Go', '.rs': 'Rust',
  '.java': 'Java', '.kt': 'Kotlin', '.swift': 'Swift',
  '.c': 'C', '.cpp': 'C++', '.h': 'C/C++', '.hpp': 'C++',
  '.cs': 'C#', '.php': 'PHP', '.lua': 'Lua', '.zig': 'Zig',
  '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.less': 'LESS',
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
  '.xml': 'XML', '.svg': 'SVG',
  '.md': 'Markdown', '.txt': 'Text', '.rst': 'reStructuredText',
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell', '.fish': 'Shell',
  '.sql': 'SQL', '.graphql': 'GraphQL', '.proto': 'Protobuf',
  '.dockerfile': 'Docker', '.docker': 'Docker',
  '.vue': 'Vue', '.svelte': 'Svelte',
};

function walk(dir, results = { files: 0, lines: 0, bytes: 0, byLang: {}, byExt: {} }) {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORE.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, results);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase() || entry.name;
        const stat = statSync(full);
        results.files++;
        results.bytes += stat.size;
        const lang = LANG_MAP[ext] || 'Other';
        results.byLang[lang] = (results.byLang[lang] || 0) + 1;
        results.byExt[ext] = (results.byExt[ext] || 0) + 1;
        try {
          const content = readFileSync(full, 'utf-8');
          results.lines += content.split('\n').length;
        } catch {}
      }
    }
  } catch {}
  return results;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export async function stats(args) {
  const dir = args[0] || '.';
  console.log(`\n  Scanning: ${dir}\n`);

  const r = walk(dir);

  console.log(`  Files:  ${r.files.toLocaleString()}`);
  console.log(`  Lines:  ${r.lines.toLocaleString()}`);
  console.log(`  Size:   ${formatBytes(r.bytes)}\n`);

  // Languages
  const langs = Object.entries(r.byLang).sort((a, b) => b[1] - a[1]);
  const maxFiles = langs[0]?.[1] || 1;
  console.log('  Languages:');
  langs.slice(0, 15).forEach(([lang, count]) => {
    const bar = '█'.repeat(Math.ceil((count / maxFiles) * 20));
    console.log(`    ${lang.padEnd(14)} ${String(count).padStart(6)}  ${bar}`);
  });

  // Extensions
  console.log('\n  Top extensions:');
  const exts = Object.entries(r.byExt).sort((a, b) => b[1] - a[1]).slice(0, 10);
  exts.forEach(([ext, count]) => {
    console.log(`    ${ext.padEnd(10)} ${count}`);
  });
  console.log();
}
