'use strict';

const assert = require('assert');
const submit = require('../api/submit-report.js');
const health = require('../api/health.js');
const publicConfig = require('../api/public-config.js');

function mockReq({ body = {}, method = 'POST', headers = {} } = {}) {
  return { body, method, headers };
}

function mockRes() {
  return {
    headers: {},
    statusCode: 0,
    payload: '',
    body: null,
    setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
    end(payload = '') {
      this.payload = payload;
      if (payload) {
        try { this.body = JSON.parse(payload); }
        catch { this.body = payload; }
      }
    }
  };
}

const MANAGED_ENV = [
  'RESEND_API_KEY', 'REPORT_TO_EMAIL', 'REPORT_FROM_EMAIL',
  'GITHUB_INTAKE_ENABLED', 'GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO',
  'GITHUB_REPO_PRIVATE_CONFIRMED', 'GITHUB_INTAKE_MODE', 'GITHUB_LABELS',
  'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_REQUIRED',
  'DEMO_ACCEPT_WITHOUT_DELIVERY', 'SITE_ORIGIN', 'ALLOWED_ORIGINS',
  'VERCEL_ENV', 'NODE_ENV'
];

function snapshotEnv() {
  return Object.fromEntries(MANAGED_ENV.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot) {
  for (const key of MANAGED_ENV) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
}

function clearManagedEnv() {
  for (const key of MANAGED_ENV) delete process.env[key];
}

const strongReport = {
  type: 'consumer-report',
  name: 'Test Consumer',
  email: 'TEST@example.com',
  institution: 'Example National Bank',
  category: 'Account freeze or closure',
  issue: 'Account access was restricted without a clear written explanation.',
  state: 'FL',
  amount: '$2,500',
  timeline: 'January 2: access stopped. January 3: called the bank. January 8: submitted a written complaint.',
  evidence: 'Restriction notice, account statement, call log, complaint receipt, and screenshots showing access denial.',
  story: 'The account was restricted. I contacted the institution, requested a written explanation, and preserved the notices and call details. Access remains unavailable.',
  remedy: 'Restore account access within 10 business days and provide a written explanation and complete account records.',
  priorContact: true,
  consentContact: true,
  consentSupport: true,
  consentDeclaration: false,
  consentPublic: false,
  consentAttorney: false,
  consentMedia: false,
  consentAccuracy: true,
  website: ''
};

async function run() {
  const env = snapshotEnv();
  const originalFetch = global.fetch;
  try {
    clearManagedEnv();

    assert.equal(typeof submit, 'function');
    assert.equal(typeof health, 'function');
    assert.equal(typeof publicConfig, 'function');

    const normalized = submit._test.normalizePayload({
      ...strongReport,
      email: ' USER@EXAMPLE.COM ',
      consentAccuracy: 'on',
      consentSupport: 'true'
    });
    assert.equal(normalized.email, 'user@example.com');
    assert.equal(normalized.consentAccuracy, true);
    assert.equal(normalized.consentSupport, true);
    assert.equal(submit._test.validatePayload(normalized), '');

    const built = submit._test.buildReport(normalized);
    assert.match(built.reportId, /^BHR-\d{8}-[A-F0-9]{10}$/);
    assert(Number.isInteger(built.evidenceScore));
    assert(Number.isInteger(built.remedyScore));
    assert(Number.isInteger(built.supportMatchReadinessScore));
    assert(Array.isArray(built.riskFlags));
    assert(Array.isArray(built.suggestedRegulators));
    assert.equal(typeof built.consentMatrix, 'object');
    assert.equal(built.consentMatrix.consumerSupportMatching, true);
    assert.equal(typeof built.status, 'string');

    // Valid report accepted in explicit demo mode with no delivery provider.
    process.env.DEMO_ACCEPT_WITHOUT_DELIVERY = 'true';
    let req = mockReq({ body: strongReport, headers: { 'content-type': 'application/json' } });
    let res = mockRes();
    await submit(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.delivery.demo, 'accepted-without-delivery');
    assert.equal(res.body.consentMatrix.accuracy, true);
    assert.equal(res.body.consentMatrix.consumerSupportMatching, true);
    assert(!JSON.stringify(res.body).includes('RESEND_API_KEY'));
    assert(!JSON.stringify(res.body).includes('GITHUB_TOKEN'));

    // Missing accuracy consent is rejected.
    req = mockReq({ body: { ...strongReport, consentAccuracy: false }, headers: { 'content-type': 'application/json' } });
    res = mockRes();
    await submit(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /accuracy/i);

    // Sensitive identifiers are rejected.
    req = mockReq({ body: { ...strongReport, story: 'My SSN is 123-45-6789.' }, headers: { 'content-type': 'application/json' } });
    res = mockRes();
    await submit(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /SSN|identifier|account|card/i);

    req = mockReq({ body: { ...strongReport, story: 'Account number: 123456789012.' }, headers: { 'content-type': 'application/json' } });
    res = mockRes();
    await submit(req, res);
    assert.equal(res.statusCode, 400);

    // Honeypot is rejected.
    req = mockReq({ body: { ...strongReport, website: 'spam.example' }, headers: { 'content-type': 'application/json' } });
    res = mockRes();
    await submit(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /spam/i);

    // GET is blocked.
    req = mockReq({ method: 'GET' });
    res = mockRes();
    await submit(req, res);
    assert.equal(res.statusCode, 405);

    // Oversized payload is blocked.
    req = mockReq({ body: { ...strongReport, story: 'x'.repeat(submit._test.MAX_BODY_BYTES + 1000) }, headers: { 'content-type': 'application/json' } });
    res = mockRes();
    await submit(req, res);
    assert.equal(res.statusCode, 413);

    // Cross-origin request is rejected when not listed.
    process.env.SITE_ORIGIN = 'https://bank-harm-registry.vercel.app';
    process.env.ALLOWED_ORIGINS = 'https://bank-harm-registry.vercel.app';
    req = mockReq({
      body: strongReport,
      headers: { origin: 'https://evil.example', host: 'bank-harm-registry.vercel.app', 'content-type': 'application/json' }
    });
    res = mockRes();
    await submit(req, res);
    assert.equal(res.statusCode, 403);

    // Health returns configuration booleans and environment, never values.
    process.env.RESEND_API_KEY = 'super-secret-resend';
    process.env.REPORT_TO_EMAIL = 'intake@example.com';
    process.env.GITHUB_INTAKE_ENABLED = 'true';
    process.env.GITHUB_TOKEN = 'super-secret-github';
    process.env.GITHUB_OWNER = 'owner';
    process.env.GITHUB_REPO = 'private-intake';
    process.env.GITHUB_REPO_PRIVATE_CONFIRMED = 'true';
    process.env.TURNSTILE_SITE_KEY = 'site-key';
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret';
    process.env.TURNSTILE_REQUIRED = 'true';
    process.env.VERCEL_ENV = 'preview';

    req = mockReq({ method: 'GET' });
    res = mockRes();
    await health(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.configured, {
      resend: true,
      githubIntakeEnabled: true,
      githubPrivateIssueHandoff: true,
      turnstile: true,
      turnstileRequired: true,
      demoMode: true
    });
    assert.equal(res.body.deploymentEnvironment, 'preview');
    assert.match(res.body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    const healthJson = JSON.stringify(res.body);
    for (const secret of ['super-secret-resend', 'super-secret-github', 'turnstile-secret']) {
      assert(!healthJson.includes(secret));
    }

    req = mockReq({ method: 'GET' });
    res = mockRes();
    await publicConfig(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.turnstileSiteKey, 'site-key');
    assert.equal(res.body.turnstileRequired, true);
    assert(!JSON.stringify(res.body).includes('turnstile-secret'));

    // Resend delivery path succeeds and demo is not required.
    process.env.DEMO_ACCEPT_WITHOUT_DELIVERY = 'false';
    process.env.GITHUB_INTAKE_ENABLED = 'false';
    process.env.TURNSTILE_REQUIRED = 'false';
    delete process.env.TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    global.fetch = async (url) => {
      assert(String(url).includes('api.resend.com'));
      return { ok: true, status: 200, async json() { return { id: 'email-test-id' }; } };
    };
    req = mockReq({ body: strongReport, headers: { 'content-type': 'application/json' } });
    res = mockRes();
    await submit(req, res);
    assert.equal(res.statusCode, 202);
    assert.equal(res.body.delivery.email, 'delivered');
    assert.equal(res.body.delivery.demo, 'not-used');

    console.log('API smoke tests passed.');
  } finally {
    global.fetch = originalFetch;
    restoreEnv(env);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
