#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dataFile = process.argv[2] || join(__dirname, 'data.json');
const template = process.argv[3] || 'modern';
const outputFile = join(__dirname, 'output', 'resume.html');

if (!existsSync(dataFile)) {
  console.error(`Data file not found: ${dataFile}`);
  console.error('Usage: node generate.js [data.json] [template]');
  process.exit(1);
}

const data = JSON.parse(readFileSync(dataFile, 'utf-8'));

// --- Templates ---
const templates = {
  modern: generateModern,
  classic: generateClassic,
  minimal: generateMinimal,
};

const generator = templates[template];
if (!generator) {
  console.error(`Unknown template: ${template}. Available: ${Object.keys(templates).join(', ')}`);
  process.exit(1);
}

const html = generator(data);
writeFileSync(outputFile, html);
console.log(`\n  Resume generated: ${outputFile}`);
console.log(`  Template: ${template}\n`);

// --- Modern Template ---
function generateModern(d) {
  const b = d.basics || {};
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${b.name || 'Resume'} - Resume</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #2d3748; line-height: 1.6; background: #f7fafc; }
  .container { max-width: 800px; margin: 40px auto; background: white; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 40px; }
  .header h1 { font-size: 32px; font-weight: 700; margin-bottom: 4px; }
  .header .title { font-size: 18px; opacity: 0.9; margin-bottom: 16px; }
  .header .contact { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; opacity: 0.85; }
  .header .contact span { display: flex; align-items: center; gap: 6px; }
  .body { padding: 40px; }
  .section { margin-bottom: 32px; }
  .section:last-child { margin-bottom: 0; }
  .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-bottom: 16px; }
  .summary { color: #4a5568; font-size: 15px; line-height: 1.7; }
  .entry { margin-bottom: 20px; }
  .entry:last-child { margin-bottom: 0; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .entry-title { font-size: 16px; font-weight: 600; color: #2d3748; }
  .entry-subtitle { font-size: 14px; color: #718096; }
  .entry-period { font-size: 13px; color: #a0aec0; white-space: nowrap; }
  .entry-location { font-size: 12px; color: #a0aec0; }
  .highlights { margin-top: 8px; padding-left: 20px; }
  .highlights li { font-size: 14px; color: #4a5568; margin-bottom: 4px; }
  .skills-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .skill-category h4 { font-size: 13px; font-weight: 600; color: #2d3748; margin-bottom: 6px; }
  .skill-items { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill-tag { background: #edf2f7; color: #4a5568; padding: 3px 10px; border-radius: 12px; font-size: 12px; }
  .project { margin-bottom: 12px; }
  .project-name { font-weight: 600; color: #2d3748; }
  .project-desc { font-size: 14px; color: #4a5568; }
  .project-tech { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .project-tech span { background: #667eea; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
  .cert-list { list-style: none; }
  .cert-list li { padding: 6px 0; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #4a5568; }
  .cert-list li:last-child { border-bottom: none; }
  @media print { body { background: white; } .container { box-shadow: none; margin: 0; } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${b.name || ''}</h1>
    <div class="title">${b.title || ''}</div>
    <div class="contact">
      ${b.email ? `<span>📧 ${b.email}</span>` : ''}
      ${b.phone ? `<span>📱 ${b.phone}</span>` : ''}
      ${b.location ? `<span>📍 ${b.location}</span>` : ''}
      ${b.website ? `<span>🌐 ${b.website}</span>` : ''}
      ${b.github ? `<span>💻 ${b.github}</span>` : ''}
    </div>
  </div>
  <div class="body">
    ${b.summary ? `<div class="section">
      <div class="section-title">Summary</div>
      <div class="summary">${b.summary}</div>
    </div>` : ''}

    ${(d.experience || []).length > 0 ? `<div class="section">
      <div class="section-title">Experience</div>
      ${d.experience.map(e => `<div class="entry">
        <div class="entry-header">
          <div>
            <div class="entry-title">${e.title}</div>
            <div class="entry-subtitle">${e.company}${e.location ? ` · ${e.location}` : ''}</div>
          </div>
          <div class="entry-period">${e.period}</div>
        </div>
        ${(e.highlights || []).length > 0 ? `<ul class="highlights">
          ${e.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>` : ''}
      </div>`).join('')}
    </div>` : ''}

    ${(d.skills || []).length > 0 ? `<div class="section">
      <div class="section-title">Skills</div>
      <div class="skills-grid">
        ${d.skills.map(s => `<div class="skill-category">
          <h4>${s.category}</h4>
          <div class="skill-items">
            ${s.items.map(i => `<span class="skill-tag">${i}</span>`).join('')}
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    ${(d.education || []).length > 0 ? `<div class="section">
      <div class="section-title">Education</div>
      ${d.education.map(e => `<div class="entry">
        <div class="entry-header">
          <div>
            <div class="entry-title">${e.degree}</div>
            <div class="entry-subtitle">${e.institution}</div>
          </div>
          <div class="entry-period">${e.period}</div>
        </div>
        ${e.gpa ? `<div style="font-size:13px;color:#718096;margin-top:4px">GPA: ${e.gpa}</div>` : ''}
      </div>`).join('')}
    </div>` : ''}

    ${(d.projects || []).length > 0 ? `<div class="section">
      <div class="section-title">Projects</div>
      ${d.projects.map(p => `<div class="project">
        <div class="project-name">${p.url ? `<a href="https://${p.url}" style="color:#667eea;text-decoration:none">${p.name}</a>` : p.name}</div>
        <div class="project-desc">${p.description}</div>
        <div class="project-tech">${(p.tech || []).map(t => `<span>${t}</span>`).join('')}</div>
      </div>`).join('')}
    </div>` : ''}

    ${(d.certifications || []).length > 0 ? `<div class="section">
      <div class="section-title">Certifications</div>
      <ul class="cert-list">
        ${d.certifications.map(c => `<li>${c}</li>`).join('')}
      </ul>
    </div>` : ''}
  </div>
</div>
</body>
</html>`;
}

// --- Classic Template ---
function generateClassic(d) {
  const b = d.basics || {};
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${b.name || 'Resume'} - Resume</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #333; line-height: 1.6; background: #fff; }
  .container { max-width: 750px; margin: 40px auto; padding: 0 40px; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 28px; font-weight: 400; letter-spacing: 4px; text-transform: uppercase; }
  .header .title { font-size: 16px; color: #666; font-style: italic; margin-top: 4px; }
  .header .contact { margin-top: 12px; font-size: 13px; color: #666; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; border-bottom: 1px solid #333; padding-bottom: 6px; margin-bottom: 14px; }
  .entry { margin-bottom: 16px; }
  .entry-header { display: flex; justify-content: space-between; }
  .entry-title { font-weight: 700; font-size: 15px; }
  .entry-subtitle { font-style: italic; color: #666; font-size: 14px; }
  .entry-period { color: #888; font-size: 13px; }
  .highlights { margin-top: 6px; padding-left: 18px; font-size: 14px; color: #555; }
  .highlights li { margin-bottom: 3px; }
  .skills { font-size: 14px; color: #555; }
  .skills strong { color: #333; }
  @media print { .container { margin: 0; padding: 20px; } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${b.name || ''}</h1>
    <div class="title">${b.title || ''}</div>
    <div class="contact">
      ${[b.email, b.phone, b.location].filter(Boolean).join(' · ')}
      ${b.website ? `<br>${b.website}` : ''}
    </div>
  </div>

  ${b.summary ? `<div class="section">
    <div class="section-title">Summary</div>
    <p style="font-size:14px;color:#555">${b.summary}</p>
  </div>` : ''}

  ${(d.experience || []).length > 0 ? `<div class="section">
    <div class="section-title">Experience</div>
    ${d.experience.map(e => `<div class="entry">
      <div class="entry-header">
        <div><span class="entry-title">${e.title}</span> — <span class="entry-subtitle">${e.company}</span></div>
        <span class="entry-period">${e.period}</span>
      </div>
      ${(e.highlights || []).length > 0 ? `<ul class="highlights">${e.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
    </div>`).join('')}
  </div>` : ''}

  ${(d.skills || []).length > 0 ? `<div class="section">
    <div class="section-title">Skills</div>
    <div class="skills">
      ${d.skills.map(s => `<div><strong>${s.category}:</strong> ${s.items.join(', ')}</div>`).join('')}
    </div>
  </div>` : ''}

  ${(d.education || []).length > 0 ? `<div class="section">
    <div class="section-title">Education</div>
    ${d.education.map(e => `<div class="entry">
      <div class="entry-header">
        <div><span class="entry-title">${e.degree}</span> — <span class="entry-subtitle">${e.institution}</span></div>
        <span class="entry-period">${e.period}</span>
      </div>
    </div>`).join('')}
  </div>` : ''}
</div>
</body>
</html>`;
}

// --- Minimal Template ---
function generateMinimal(d) {
  const b = d.basics || {};
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${b.name || 'Resume'} - Resume</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #222; line-height: 1.5; background: #fff; }
  .container { max-width: 700px; margin: 60px auto; padding: 0 24px; }
  h1 { font-size: 36px; font-weight: 300; letter-spacing: -1px; }
  .subtitle { font-size: 16px; color: #888; margin-top: 4px; }
  .contact { margin-top: 8px; font-size: 13px; color: #aaa; }
  hr { border: none; border-top: 1px solid #eee; margin: 32px 0; }
  .section { margin-bottom: 28px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: #aaa; margin-bottom: 12px; }
  .entry { margin-bottom: 14px; }
  .entry-row { display: flex; justify-content: space-between; font-size: 14px; }
  .entry-main { font-weight: 500; }
  .entry-sub { color: #888; font-size: 13px; }
  .entry-date { color: #aaa; font-size: 13px; }
  ul { padding-left: 18px; font-size: 13px; color: #555; }
  li { margin-bottom: 3px; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .tag { font-size: 11px; color: #888; background: #f5f5f5; padding: 2px 8px; border-radius: 3px; }
  @media print { .container { margin: 20px auto; } }
</style>
</head>
<body>
<div class="container">
  <h1>${b.name || ''}</h1>
  <div class="subtitle">${b.title || ''}</div>
  <div class="contact">${[b.email, b.phone, b.location, b.website].filter(Boolean).join(' · ')}</div>
  <hr>

  ${b.summary ? `<div class="section">
    <h2>About</h2>
    <p style="font-size:14px;color:#555">${b.summary}</p>
  </div>` : ''}

  ${(d.experience || []).length > 0 ? `<div class="section">
    <h2>Experience</h2>
    ${d.experience.map(e => `<div class="entry">
      <div class="entry-row">
        <span class="entry-main">${e.title} at ${e.company}</span>
        <span class="entry-date">${e.period}</span>
      </div>
      ${(e.highlights || []).length > 0 ? `<ul>${e.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
    </div>`).join('')}
  </div>` : ''}

  ${(d.skills || []).length > 0 ? `<div class="section">
    <h2>Skills</h2>
    ${d.skills.map(s => `<div style="margin-bottom:8px">
      <span style="font-size:13px;font-weight:500">${s.category}:</span>
      <span style="font-size:13px;color:#555">${s.items.join(' · ')}</span>
    </div>`).join('')}
  </div>` : ''}

  ${(d.education || []).length > 0 ? `<div class="section">
    <h2>Education</h2>
    ${d.education.map(e => `<div class="entry">
      <div class="entry-row">
        <span class="entry-main">${e.degree} — ${e.institution}</span>
        <span class="entry-date">${e.period}</span>
      </div>
    </div>`).join('')}
  </div>` : ''}

  ${(d.projects || []).length > 0 ? `<div class="section">
    <h2>Projects</h2>
    ${d.projects.map(p => `<div class="entry">
      <div style="font-weight:500;font-size:14px">${p.name}</div>
      <div style="font-size:13px;color:#888">${p.description}</div>
      <div class="tags">${(p.tech || []).map(t => `<span class="tag">${t}</span>`).join('')}</div>
    </div>`).join('')}
  </div>` : ''}

  ${(d.certifications || []).length > 0 ? `<div class="section">
    <h2>Certifications</h2>
    <ul>${d.certifications.map(c => `<li>${c}</li>`).join('')}</ul>
  </div>` : ''}
</div>
</body>
</html>`;
}
