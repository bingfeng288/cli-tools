import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.txt': 'text/plain', '.md': 'text/markdown',
  '.xml': 'application/xml', '.pdf': 'application/pdf',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function generateIndex(dir, urlPath) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const items = entries.map(e => {
    const name = e.isDirectory() ? `${e.name}/` : e.name;
    const href = urlPath === '/' ? `/${name}` : `${urlPath}/${name}`;
    const stat = statSync(join(dir, e.name));
    const size = e.isDirectory() ? '-' : formatSize(stat.size);
    return `<tr><td><a href="${href}">${name}</a></td><td>${size}</td><td>${stat.mtime.toLocaleDateString()}</td></tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Index of ${urlPath}</title>
<style>body{font-family:monospace;padding:20px;background:#1a1a2e;color:#e0e0e0}
a{color:#7c6df7}table{width:100%;border-collapse:collapse}td,th{padding:6px 12px;text-align:left;border-bottom:1px solid #333}
tr:hover{background:#222244}</style></head>
<body><h2>Index of ${urlPath}</h2><table><tr><th>Name</th><th>Size</th><th>Modified</th></tr>${items}</table></body></html>`;
}

export async function serve(args) {
  const port = parseInt(args[0]) || 3000;
  const root = process.cwd();

  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = join(root, urlPath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      const index = join(filePath, 'index.html');
      if (existsSync(index)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(readFileSync(index));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(generateIndex(filePath, urlPath));
      return;
    }

    if (existsSync(filePath)) {
      const ext = extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(readFileSync(filePath));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 Not Found</h1>');
  });

  server.listen(port, () => {
    console.log(`\n  Static server running at http://localhost:${port}`);
    console.log(`  Serving: ${root}\n`);
  });
}
