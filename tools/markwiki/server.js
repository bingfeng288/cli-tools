#!/usr/bin/env node

import express from 'express';
import { marked } from 'marked';
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, extname, relative, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Wiki content directory
const WIKI_DIR = process.argv[2] || join(process.cwd(), 'wiki');
if (!existsSync(WIKI_DIR)) mkdirSync(WIKI_DIR, { recursive: true });

// --- Helpers ---
function walkMd(dir, base = dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMd(full, base));
    } else if (extname(entry.name) === '.md') {
      const rel = relative(base, full);
      const stat = statSync(full);
      const content = readFileSync(full, 'utf-8');
      const title = extractTitle(content, entry.name);
      results.push({ path: rel, title, size: stat.size, modified: stat.mtime.toISOString() });
    }
  }
  return results;
}

function extractTitle(content, filename) {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : basename(filename, '.md');
}

function buildTree(files) {
  const tree = { name: 'wiki', children: [], files: [] };
  for (const file of files) {
    const parts = file.path.split('/');
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children.find(c => c.name === parts[i]);
      if (!child) {
        child = { name: parts[i], children: [], files: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.files.push(file);
  }
  return tree;
}

function processWikiLinks(html, currentPath) {
  // Convert [[page]] links to proper wiki links
  return html.replace(/\[\[([^\]]+)\]\]/g, (match, target) => {
    const parts = target.split('|');
    const linkTarget = parts[0].trim();
    const linkText = (parts[1] || parts[0]).trim();
    // Try to find the file
    const currentDir = dirname(currentPath);
    const possiblePaths = [
      join(currentDir, linkTarget + '.md'),
      join(currentDir, linkTarget, 'index.md'),
      linkTarget + '.md',
    ];
    const href = `/wiki/${linkTarget.replace(/\s+/g, '-').toLowerCase()}`;
    return `<a href="${href}" class="wiki-link">${linkText}</a>`;
  });
}

// --- API Routes ---

// List all pages
app.get('/api/pages', (req, res) => {
  const files = walkMd(WIKI_DIR);
  const tree = buildTree(files);
  res.json({ files, tree });
});

// Get a page
app.get('/api/page/{*pagePath}', (req, res) => {
  const pagePath = Array.isArray(req.params.pagePath) ? req.params.pagePath[0] : req.params.pagePath;
  const fullPath = join(WIKI_DIR, pagePath);

  // Try exact path, then .md extension, then index.md
  let filePath = fullPath;
  if (!existsSync(filePath)) filePath = fullPath + '.md';
  if (!existsSync(filePath)) filePath = join(fullPath, 'index.md');

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'Page not found' });
  }

  const content = readFileSync(filePath, 'utf-8');
  let html = marked.parse(content);
  const relPath = relative(WIKI_DIR, filePath);
  html = processWikiLinks(html, relPath);

  const title = extractTitle(content, basename(filePath));
  res.json({ title, html, path: relPath, content });
});

// Save a page
app.put('/api/page/{*pagePath}', (req, res) => {
  const pagePath = Array.isArray(req.params.pagePath) ? req.params.pagePath[0] : req.params.pagePath;
  const fullPath = join(WIKI_DIR, pagePath);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(fullPath, req.body.content || '');
  res.json({ ok: true, path: pagePath });
});

// Create a page
app.post('/api/page', (req, res) => {
  const { path: pagePath, content } = req.body;
  if (!pagePath) return res.status(400).json({ error: 'Path required' });

  const fullPath = join(WIKI_DIR, pagePath.endsWith('.md') ? pagePath : pagePath + '.md');
  if (existsSync(fullPath)) return res.status(409).json({ error: 'Page already exists' });

  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content || `# ${basename(pagePath, '.md')}\n\n`);
  res.json({ ok: true, path: relative(WIKI_DIR, fullPath) });
});

// Delete a page
app.delete('/api/page/{*pagePath}', (req, res) => {
  const pagePath = Array.isArray(req.params.pagePath) ? req.params.pagePath[0] : req.params.pagePath;
  const fullPath = join(WIKI_DIR, pagePath);
  if (!existsSync(fullPath)) return res.status(404).json({ error: 'Not found' });
  unlinkSync(fullPath);
  res.json({ ok: true });
});

// Search
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ results: [] });

  const files = walkMd(WIKI_DIR);
  const results = files.filter(f => {
    const content = readFileSync(join(WIKI_DIR, f.path), 'utf-8').toLowerCase();
    return f.title.toLowerCase().includes(q) || content.includes(q);
  }).map(f => {
    const content = readFileSync(join(WIKI_DIR, f.path), 'utf-8');
    const idx = content.toLowerCase().indexOf(q);
    const snippet = idx >= 0 ? content.slice(Math.max(0, idx - 50), idx + 100) : '';
    return { ...f, snippet };
  });

  res.json({ results });
});

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3457;
app.listen(PORT, () => {
  console.log(`\n  MarkWiki is running at http://localhost:${PORT}`);
  console.log(`  Wiki directory: ${WIKI_DIR}\n`);
});
