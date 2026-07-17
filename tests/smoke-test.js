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
    setHeader(key, value) { this.headers[key] = value; },
    end(payload = '') {
      this.payload = payload;
      if (payload) {
        try { this.body = JSON.parse(payload); } catch { this.body = payload; }
      }
    }
  };
}

async function run() {
  assert.equal(typeof submit, 'function');
  assert.equal(typeof health, 'function');
  assert.equal(typeof publicConfig, 'function');

  assert.equal(submit._test.hasSensitiveData({ story: '123-45-6789' }), true);
  assert.equal(submit._test.hasSensitiveData({ story: 'facts without private numbers' }), false);

  const normalized = submit._test.normalizePayload({
    type: 'consumer-report',
    email: ' USER@EXAMPLE.COM ',
    consentContact: 'on',
    accuracy: true
  });
  assert.equal(normalized.email, 'USER@EXAMPLE.COM');
  assert.equal(normalized.consentContact, true);
  assert.equal(normalized.accuracy, true);

  const strong = {
    type: 'consumer-report',
    name: 'Test User',
    email: 'test@example.com',
    institution: 'Bank of America, N.A.',
    issue: 'Account freeze or closure',
    state: 'FL',
    amount: '$500',
    timeline: 'January 1 account restricted; January 2 contacted company.',
    evidence: 'Statement, restriction notice, call log, complaint receipt.',
    story: 'The account was restricted and access remained unavailable after contact.',
    remedy: 'Unfreeze/reopen account',
    priorContact: true,
    consentContact: true,
    accuracy: true,
    website: ''
  };
  assert.equal(submit._test.validatePayload(strong), '');
  assert(submit._test.evidenceScore(strong) >= 90);

  let req = mockReq({ body: strong });
  let res = mockRes();
  delete process.env.RESEND_API_KEY;
  delete process.env.REPORT_TO_EMAIL;
  delete process.env.GITHUB_TOKEN;
  await submit(req, res);
  assert.equal(res.statusCode, 503, 'must not claim success without delivery');

  const originalFetch = global.fetch;
  process.env.RESEND_API_KEY = 'test-key';
  process.env.REPORT_TO_EMAIL = 'owner@example.com';
  global.fetch = async (url) => {
    assert(String(url).includes('api.resend.com'));
    return {
      ok: true,
      status: 200,
      async json() { return { id: 'email-test-id' }; }
    };
  };

  req = mockReq({ body: strong });
  res = mockRes();
  await submit(req, res);
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.ok, true);
  assert.match(res.body.reportId, /^BHR-\d{8}-[A-F0-9]{10}$/);
  assert.equal(res.body.delivery.email, 'delivered');

  req = mockReq({
    body: strong,
    headers: { origin: 'https://evil.example', host: 'bankharmregistry.example' }
  });
  res = mockRes();
  await submit(req, res);
  assert.equal(res.statusCode, 403, 'cross-origin post should be rejected');

  req = mockReq({ body: { ...strong, story: 'My SSN is 123-45-6789' } });
  res = mockRes();
  await submit(req, res);
  assert.equal(res.statusCode, 400);

  req = mockReq({ body: { ...strong, email: 'not-an-email' } });
  res = mockRes();
  await submit(req, res);
  assert.equal(res.statusCode, 400);

  req = mockReq({ body: { ...strong, website: 'spam-link.example' } });
  res = mockRes();
  await submit(req, res);
  assert.equal(res.statusCode, 400);

  req = mockReq({ method: 'GET' });
  res = mockRes();
  await submit(req, res);
  assert.equal(res.statusCode, 405);

  req = mockReq({ method: 'GET' });
  res = mockRes();
  await health(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.readyToAcceptPrivateIntake, true);

  req = mockReq({ method: 'GET' });
  res = mockRes();
  await publicConfig(req, res);
  assert.equal(res.statusCode, 200);

  global.fetch = originalFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.REPORT_TO_EMAIL;

  console.log('API smoke tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
