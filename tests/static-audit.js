const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.vercel'].includes(entry.name)) return [];
      return walk(full);
    }
    return [full];
  });
}

const htmlFiles = walk(root).filter((file) => file.endsWith('.html'));
assert(htmlFiles.length >= 20, 'expected full multi-page site');

const failures = [];

function fail(file, message) {
  failures.push(`${path.relative(root, file)}: ${message}`);
}

for (const file of htmlFiles) {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  const html = fs.readFileSync(file, 'utf8');

  const doctypes = (html.match(/<!doctype html>/gi) || []).length;
  if (doctypes !== 1) fail(file, `expected one doctype, found ${doctypes}`);
  if (!/<html[^>]+lang=["']en["']/i.test(html)) fail(file, 'missing lang=en');
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(file, 'missing title');
  if (!/<meta[^>]+name=["']description["']/i.test(html)) fail(file, 'missing description');
  if (!/<h1[\s>]/i.test(html)) fail(file, 'missing H1');
  if (!/class=["'][^"']*skip-link/i.test(html)) fail(file, 'missing skip link');
  if (/href=["']#["']/i.test(html)) fail(file, 'contains dead href="#"');
  if (/<img(?![^>]*\balt=)[^>]*>/i.test(html)) fail(file, 'image missing alt');
  if (!['dashboard.html', 'war-room.html', '404.html'].includes(rel) &&
      !/<link[^>]+rel=["']canonical["']/i.test(html)) {
    fail(file, 'missing canonical');
  }
  if (['dashboard.html', 'war-room.html', '404.html'].includes(rel)) {
    const robotsMeta = (html.match(/<meta[^>]+>/gi) || []).find((tag) => /name=["']robots["']/i.test(tag));
    if (!robotsMeta || !/noindex/i.test(robotsMeta)) {
      fail(file, 'prototype/error page must be noindex');
    }
  }

  const attributeRegex = /\b(?:href|src)=["']([^"'#?]+)(?:[?#][^"']*)?["']/gi;
  let match;
  while ((match = attributeRegex.exec(html))) {
    const target = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(target)) continue;
    if (target.startsWith('/api/')) continue;
    if (target.startsWith('/')) {
      const absolute = path.join(root, target.slice(1));
      if (!fs.existsSync(absolute)) fail(file, `missing root target ${target}`);
      continue;
    }
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) fail(file, `missing linked file ${target}`);
  }
}

const required = [
  'index.html',
  'privacy.html',
  'terms.html',
  'disclaimer.html',
  'donate.html',
  'volunteer-expert-support.html',
  'site.webmanifest',
  'robots.txt',
  'sitemap.xml',
  'vercel.json',
  '.env.example',
  'api/submit-report.js',
  'api/health.js',
  'api/public-config.js',
  'SECURITY.md',
  '.well-known/security.txt'
];

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`missing required file: ${rel}`);
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!/data-type=["']consumer-report["']/.test(index)) failures.push('index.html: missing consumer report form');
if (!/data-turnstile-slot/.test(index)) failures.push('index.html: missing Turnstile slot');
if (!/consentAttorney/.test(index) || !/consentMedia/.test(index)) failures.push('index.html: missing expanded consent matrix');

const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const headers = JSON.stringify(vercel.headers || []);
for (const requiredHeader of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Frame-Options']) {
  if (!headers.includes(requiredHeader)) failures.push(`vercel.json: missing ${requiredHeader}`);
}

if (failures.length) {
  console.error('Static audit failed:\n' + failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`Static audit passed for ${htmlFiles.length} HTML files.`);
