const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { httpsUrl, localAsset, eventDateLabel, validConfig } = require('../class.js');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'site-config.js'), 'utf8'), context);
const config = context.window.BHR_CONFIG.classEvent;

test('class offer matches the contract and optional configuration is empty or valid', () => {
  assert(validConfig(config));
  for (const [key, value] of Object.entries({ donationAmount: 20, portfolioAddOnAmount: 10, minimumConfirmed: 25, targetConfirmed: 50, plannedDurationHours: 3, maximumDurationHours: 5 })) assert.equal(config[key], value);
  assert.equal(config.cashAppUrl, 'https://cash.app/$dginktattoos');
  assert.equal(config.contactEmail, 'garzadanny0101@gmail.com');
  assert(!config.telegramUrl || httpsUrl(config.telegramUrl, ['t.me', 'telegram.me']));
  assert(!config.tiktokProofUrl || httpsUrl(config.tiktokProofUrl, ['tiktok.com']));
  assert(!config.eventDate || eventDateLabel(config.eventDate, config.eventTimeZone));
});

test('malformed links cannot enable external actions', () => {
  for (const value of ['javascript:alert(1)', 'http://cash.app/test', 'https://cash.app@evil.example/test', 'https://cash.app.evil.example/test', 'https://cash.app:444/test']) assert.equal(httpsUrl(value, ['cash.app']), '');
  assert.equal(httpsUrl(config.cashAppUrl, ['cash.app']), config.cashAppUrl);
  assert.equal(httpsUrl('https://t.me/valid_channel', ['t.me']), 'https://t.me/valid_channel');
  assert.equal(httpsUrl('https://t.me.evil.example/channel', ['t.me']), '');
});

test('media stays inside public assets and uses accepted file types', () => {
  const origin = 'https://bankharmregistry.org';
  for (const value of ['/assets/../site-config.js', '//evil.example/a.jpg', 'https://evil.example/a.jpg', 'data:image/png;base64,abc', '/assets/a.svg', '/assets/a.jpg?token=secret', 'assets\\a.jpg']) assert.equal(localAsset(value, ['.jpg'], origin), '');
  assert.equal(localAsset('assets/proof.jpg', ['.jpg'], origin), `${origin}/assets/proof.jpg`);
});

test('event dates require a valid explicit time offset and timezone', () => {
  for (const value of ['', 'not-a-date', '2026-11-03', '2026-11-03T18:00:00', '2026-99-99T18:00:00Z']) assert.equal(eventDateLabel(value, 'America/New_York'), '');
  assert.match(eventDateLabel('2026-11-03T18:00:00-05:00', 'America/New_York'), /6:00 PM/);
  assert.equal(eventDateLabel('2026-11-03T18:00:00Z', 'invalid/timezone'), '');
});

test('invalid or inconsistent cohort and price configuration fails closed', () => {
  assert(!validConfig(null));
  assert(!validConfig({ ...config, donationAmount: NaN }));
  assert(!validConfig({ ...config, donationAmount: -1 }));
  assert(!validConfig({ ...config, minimumConfirmed: 60 }));
  assert(!validConfig({ ...config, minimumConfirmed: 1.5 }));
  assert(!validConfig({ ...config, maximumDurationHours: 1 }));
});

test('selected proof has real local source files and privacy-reviewed descriptions', () => {
  assert.equal(config.proofItems.length, 3);
  for (const item of config.proofItems) {
    assert.equal(item.reviewed, true);
    assert(fs.existsSync(path.join(root, item.image.src)));
    assert.equal(item.sourceUrl, item.image.src);
    assert(item.image.alt && item.image.width > 0 && item.image.height > 0);
    assert(!/guarantee|seven.account|7.account/i.test(item.title));
  }
});

test('class routing is scoped and security headers are still present', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.deepEqual(vercel.rewrites, [{ source: '/class/', destination: '/class/index.html' }]);
  assert.deepEqual(vercel.redirects, [{ source: '/class', destination: '/class/', permanent: true }, { source: '/class.html', destination: '/class/', permanent: true }]);
  const headers = vercel.headers.find(rule => rule.source === '/(.*)').headers;
  const csp = headers.find(header => header.key === 'Content-Security-Policy').value;
  for (const rule of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "style-src 'self'"]) assert(csp.includes(rule));
  assert(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').includes('https://bankharmregistry.org/class/</loc>'));
});

test('page stays static, has no payment API or fabricated Event schema', () => {
  const html = fs.readFileSync(path.join(root, 'class/index.html'), 'utf8');
  assert(!/<iframe|<form|https:\/\/.*(?:stripe|checkout)/i.test(html));
  assert(!/"@type"\s*:\s*"Event"/.test(html));
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  assert(html.includes('CLASS + YOUR EMAIL'));
  assert.equal((html.match(/<li>/g) || []).length, 23); // 7 framework + 13 documents + 3 access steps.
});
