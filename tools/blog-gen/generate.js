#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = process.argv[2] || join(__dirname, 'posts');
const OUTPUT_DIR = join(__dirname, 'output');

const SITE = {
  title: 'My Blog',
  description: 'A personal blog',
  url: 'https://example.com',
  author: 'Author',
};

// --- Markdown parser (reuse from md2html) ---
function parseMarkdown(md) {
  let html = md;
  html = html.replace(/\r\n/g, '\n');
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 id="$1">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 id="$1">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^(\s*)[-*+]\s+(.+)$/gm, '<li>$2</li>');
  html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>\n$1</ul>');
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, '<p>$1</p>');
  html = html.replace(/<p>\s*<\/p>/g, '');
  return html;
}

// --- Parse frontmatter ---
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, content };

  const meta = {};
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s => s.trim());
      }
      meta[key] = val;
    }
  });

  return { meta, content: match[2] };
}

// --- Read posts ---
function readPosts() {
  if (!existsSync(POSTS_DIR)) {
    mkdirSync(POSTS_DIR, { recursive: true });
    return [];
  }

  const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const raw = readFileSync(join(POSTS_DIR, file), 'utf-8');
    const { meta, content } = parseFrontmatter(raw);
    const slug = basename(file, '.md');
    const date = meta.date || slug.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().slice(0, 10);
    const title = meta.title || slug.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ');
    const tags = Array.isArray(meta.tags) ? meta.tags : (meta.tags || '').split(',').map(t => t.trim()).filter(Boolean);

    return {
      slug,
      title,
      date,
      tags,
      description: meta.description || '',
      content: parseMarkdown(content),
      rawContent: content,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

// --- Templates ---
function layout(title, content, extra = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - ${SITE.title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; color: #333; background: #fff; line-height: 1.7; }
  .container { max-width: 720px; margin: 0 auto; padding: 0 24px; }
  header { border-bottom: 1px solid #eee; padding: 20px 0; margin-bottom: 40px; }
  header h1 { font-size: 24px; }
  header h1 a { color: #333; text-decoration: none; }
  header nav { margin-top: 8px; }
  header nav a { color: #666; text-decoration: none; margin-right: 16px; font-size: 14px; }
  header nav a:hover { color: #333; }
  article { margin-bottom: 40px; }
  article h1 { font-size: 28px; margin-bottom: 8px; }
  article h1 a { color: #333; text-decoration: none; }
  article h2 { font-size: 22px; margin: 24px 0 12px; }
  article h3 { font-size: 18px; margin: 20px 0 8px; }
  .meta { color: #888; font-size: 14px; margin-bottom: 20px; }
  .meta .tag { background: #f0f0f0; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 8px; }
  .excerpt { color: #666; margin-bottom: 12px; }
  p { margin: 0 0 16px; }
  a { color: #3b82f6; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f5f5f5; border-radius: 6px; padding: 16px; overflow-x: auto; margin: 16px 0; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #3b82f6; padding: 8px 16px; margin: 16px 0; background: #f9f9f9; }
  ul, ol { padding-left: 24px; margin: 16px 0; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #eee; margin: 32px 0; }
  img { max-width: 100%; border-radius: 6px; }
  footer { border-top: 1px solid #eee; padding: 20px 0; margin-top: 40px; color: #888; font-size: 13px; }
  .post-list { list-style: none; padding: 0; }
  .post-list li { padding: 16px 0; border-bottom: 1px solid #eee; }
  .post-list li:last-child { border-bottom: none; }
  .post-list .post-title { font-size: 18px; font-weight: 600; }
  .post-list .post-title a { color: #333; }
  .post-list .post-date { color: #888; font-size: 13px; }
  .post-list .post-desc { color: #666; font-size: 14px; margin-top: 4px; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1><a href="/">${SITE.title}</a></h1>
    <nav>
      <a href="/">Home</a>
      <a href="/tags.html">Tags</a>
      <a href="/feed.xml">RSS</a>
    </nav>
  </header>
  ${content}
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${SITE.author}. Built with blog-gen.</p>
  </footer>
</div>
${extra}
</body>
</html>`;
}

// --- Generate pages ---
function generate(posts) {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  // Index page
  const indexHtml = posts.map(p => `
    <li>
      <div class="post-date">${p.date}</div>
      <div class="post-title"><a href="/${p.slug}.html">${p.title}</a></div>
      ${p.description ? `<div class="post-desc">${p.description}</div>` : ''}
      ${p.tags.length > 0 ? `<div class="meta">${p.tags.map(t => `<a class="tag" href="/tags.html#${t}">${t}</a>`).join('')}</div>` : ''}
    </li>
  `).join('');

  writeFileSync(join(OUTPUT_DIR, 'index.html'), layout(SITE.title, `
    <h2 style="margin-bottom:24px">Latest Posts</h2>
    <ul class="post-list">${indexHtml}</ul>
  `));

  // Individual posts
  posts.forEach(post => {
    writeFileSync(join(OUTPUT_DIR, `${post.slug}.html`), layout(post.title, `
      <article>
        <h1>${post.title}</h1>
        <div class="meta">
          ${post.date}
          ${post.tags.map(t => `<a class="tag" href="/tags.html#${t}">${t}</a>`).join('')}
        </div>
        ${post.content}
      </article>
    `));
  });

  // Tags page
  const tagMap = {};
  posts.forEach(p => p.tags.forEach(t => {
    if (!tagMap[t]) tagMap[t] = [];
    tagMap[t].push(p);
  }));

  const tagsHtml = Object.entries(tagMap).sort((a, b) => b[1].length - a[1].length).map(([tag, tagPosts]) => `
    <div id="${tag}" style="margin-bottom:24px">
      <h3>${tag} (${tagPosts.length})</h3>
      <ul class="post-list">
        ${tagPosts.map(p => `<li><div class="post-title"><a href="/${p.slug}.html">${p.title}</a></div><div class="post-date">${p.date}</div></li>`).join('')}
      </ul>
    </div>
  `).join('');

  writeFileSync(join(OUTPUT_DIR, 'tags.html'), layout('Tags', `<h2 style="margin-bottom:24px">Tags</h2>${tagsHtml}`));

  // RSS feed
  const rssItems = posts.slice(0, 20).map(p => `
    <item>
      <title>${p.title}</title>
      <link>${SITE.url}/${p.slug}.html</link>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${p.description || p.title}</description>
    </item>
  `).join('');

  writeFileSync(join(OUTPUT_DIR, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${SITE.title}</title>
  <link>${SITE.url}</link>
  <description>${SITE.description}</description>
  <language>en</language>
  ${rssItems}
</channel>
</rss>`);

  // Sitemap
  const sitemapUrls = posts.map(p => `
  <url>
    <loc>${SITE.url}/${p.slug}.html</loc>
    <lastmod>${p.date}</lastmod>
  </url>
  `).join('');

  writeFileSync(join(OUTPUT_DIR, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE.url}/</loc>
  </url>
  ${sitemapUrls}
</urlset>`);

  console.log(`\n  Blog generated: ${OUTPUT_DIR}`);
  console.log(`  Posts: ${posts.length}`);
  console.log(`  Tags: ${Object.keys(tagMap).length}`);
  console.log(`  Files: index.html, ${posts.length} posts, tags.html, feed.xml, sitemap.xml\n`);
}

// --- Main ---
const posts = readPosts();
if (posts.length === 0) {
  console.log('\n  No posts found. Create markdown files in the posts/ directory.\n');
  console.log('  Example: posts/2024-01-15-hello-world.md\n');
  console.log('  Frontmatter format:');
  console.log('  ---');
  console.log('  title: Hello World');
  console.log('  date: 2024-01-15');
  console.log('  tags: [intro, blog]');
  console.log('  description: My first post');
  console.log('  ---\n');
}

generate(posts);
