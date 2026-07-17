'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const required = [
  'index.html', 'admin.html', 'styles.css', 'script.js', 'admin.js',
  'api/submit-report.js', 'api/health.js', 'api/public-config.js',
  'robots.txt', '.env.example', 'package.json', 'docs/DEPLOY-VERCEL.md'
];
for (const file of required) assert(fs.existsSync(path.join(root, file)), `missing required patch file: ${file}`);

function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
const index = read('index.html');
const admin = read('admin.html');
const script = read('script.js');
const adminScript = read('admin.js');
const robots = read('robots.txt');
const api = read('api/submit-report.js');
const health = read('api/health.js');
const env = read('.env.example');

// Public intake and consent UX.
for (const phrase of [
  'Build My Evidence Packet', 'Find My Regulator', 'Request Reviewed Support', 'Support Consumer Tools',
  'consentSupport', 'consentDeclaration', 'consentPublic', 'consentAttorney', 'consentMedia', 'consentAccuracy',
  'not legal advice', 'No public story is published without consent'
]) assert(index.includes(phrase), `index.html missing: ${phrase}`);
assert((index.match(/data-step=/g) || []).length === 4, 'intake wizard must contain four steps');
assert(/Do not include SSNs|Do not enter account|full DOB/i.test(index), 'index must warn against sensitive identifiers');

// Admin prototype safeguards and required sections.
assert(/noindex/i.test(admin), 'admin page must be noindex');
assert(admin.includes('Admin Studio is a prototype until real authentication and database storage are added.'), 'exact prototype warning missing');
for (const section of [
  'Intake Inbox', 'Evidence Ready', 'Regulator Ready', 'Support Match Eligible',
  'Declaration Ready', 'Donation/Support Notes', 'Volunteer Expert Applicants', 'Risk Queue'
]) assert(adminScript.includes(section) || admin.includes(section), `admin section missing: ${section}`);
for (const field of ['Report ID','Submitted','Name/Alias','Email','Institution','Category','State','Approx. Amount','Evidence','Remedy','Support','Consent','Risk','Status']) {
  assert(admin.includes(field), `admin field missing: ${field}`);
}
assert(admin.includes('exportJson') && admin.includes('exportCsv'), 'admin export buttons missing');
assert(/authentication|encrypted database|role-based/i.test(admin), 'admin must contain real auth/database implementation warning');

// Browser storage must contain receipt metadata only.
assert(script.includes("const RECEIPTS_KEY = 'bhr_submission_receipts_v4'"), 'safe receipt key missing');
const receiptMatch = script.match(/saveReceipt\(\{([\s\S]*?)\}\);/);
assert(receiptMatch, 'saveReceipt object not found');
const receiptObject = receiptMatch[1];
for (const forbidden of ['name:', 'email:', 'amount:', 'story:', 'evidence:', 'timeline:', 'remedy:', 'credentials:', 'documents:']) {
  assert(!receiptObject.includes(forbidden), `private field stored in receipt: ${forbidden}`);
}
assert((script.match(/localStorage\.setItem/g) || []).length === 1, 'unexpected localStorage writes found');
assert(!/localStorage\.setItem\([^\n]*(story|email|name|evidence|amount)/i.test(script), 'private content may be stored in localStorage');
assert(!/story|email|name|amount|evidence narrative|documents/i.test(JSON.stringify([])), 'sanity');
assert(adminScript.includes('Protected—requires authenticated database'), 'admin must not fabricate private fields');

// API and health controls.
for (const token of [
  'MAX_BODY_BYTES', 'sensitiveFinding', 'consentAccuracy', 'consentMatrix',
  'remedyScore', 'supportMatchReadinessScore', 'riskFlags', 'suggestedRegulators',
  'GITHUB_INTAKE_ENABLED', 'DEMO_ACCEPT_WITHOUT_DELIVERY', 'ALLOWED_ORIGINS', 'TURNSTILE_REQUIRED'
]) assert(api.includes(token), `submit API control missing: ${token}`);
for (const token of ['deploymentEnvironment','githubIntakeEnabled','githubPrivateIssueHandoff','turnstileRequired','demoMode']) {
  assert(health.includes(token), `health configuration field missing: ${token}`);
}

// Robots and environment documentation.
assert(/Disallow:\s*\/admin\.html/i.test(robots), 'robots.txt must disallow admin.html');
for (const variable of [
  'RESEND_API_KEY','REPORT_TO_EMAIL','GITHUB_INTAKE_ENABLED','GITHUB_TOKEN','GITHUB_OWNER','GITHUB_REPO',
  'GITHUB_REPO_PRIVATE_CONFIRMED','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY','TURNSTILE_REQUIRED',
  'SITE_ORIGIN','ALLOWED_ORIGINS','DEMO_ACCEPT_WITHOUT_DELIVERY'
]) assert(env.includes(variable), `.env.example missing ${variable}`);

// Syntax checks.
for (const file of ['script.js','admin.js','api/submit-report.js','api/health.js','api/public-config.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} syntax error:\n${result.stderr}`);
}

console.log('Static privacy and architecture audit passed.');
