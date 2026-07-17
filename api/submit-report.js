const crypto = require('crypto');

const MAX_BODY_BYTES = 256_000;
const CONSENT_VERSION = process.env.CONSENT_VERSION || '2026-07-16-v1';
const ALLOWED_TYPES = new Set(['consumer-report', 'volunteer-application', 'media-inquiry']);

const SENSITIVE_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{9}\b/,
  /\b(?:\d[ -]*?){12,19}\b/
];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function asString(value, max = 5000) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

function normalizePayload(input) {
  const payload = {};
  const limits = {
    type: 50,
    name: 120,
    email: 254,
    institution: 200,
    issue: 200,
    state: 50,
    amount: 80,
    timeline: 4000,
    evidence: 5000,
    story: 12000,
    summary: 5000,
    remedy: 500,
    credentials: 5000,
    area: 500,
    volunteerRole: 200,
    conflictDisclosure: 3000,
    mediaOutlet: 200,
    website: 200,
    pageUrl: 500,
    turnstileToken: 3000,
    consentVersion: 100
  };

  for (const [key, max] of Object.entries(limits)) {
    payload[key] = asString(input?.[key], max);
  }

  const booleanFields = [
    'priorContact',
    'consentContact',
    'consentDeclaration',
    'consentPublic',
    'consentAttorney',
    'consentMedia',
    'accuracy'
  ];

  for (const key of booleanFields) {
    payload[key] = input?.[key] === true || input?.[key] === 'true' || input?.[key] === 'on';
  }

  return payload;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    const bytes = Buffer.byteLength(JSON.stringify(req.body));
    if (bytes > MAX_BODY_BYTES) {
      return Promise.reject(new Error('Request body too large'));
    }
    return Promise.resolve(req.body);
  }

  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > MAX_BODY_BYTES) {
      return Promise.reject(new Error('Request body too large'));
    }
    try {
      return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    } catch {
      return Promise.reject(new Error('Invalid JSON'));
    }
  }

  return new Promise((resolve, reject) => {
    let raw = '';
    let done = false;

    req.on('data', (chunk) => {
      if (done) return;
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
        done = true;
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      if (done) return;
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });

    req.on('error', reject);
  });
}

function hasSensitiveData(payload) {
  const fields = [
    'name', 'institution', 'issue', 'state', 'amount', 'timeline',
    'evidence', 'story', 'summary', 'remedy', 'credentials', 'area',
    'conflictDisclosure', 'mediaOutlet'
  ];
  const text = fields.map((field) => payload?.[field] || '').join('\n');
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email || '');
}

function validatePayload(data) {
  if (!ALLOWED_TYPES.has(data.type)) return 'Unsupported submission type';
  if (data.website) return 'Spam submission rejected';

  if (data.type === 'consumer-report') {
    if (!data.name || !data.email || !data.institution || !data.issue || !data.story) {
      return 'Name or alias, email, institution, issue, and story are required';
    }
    if (!data.consentContact) return 'Contact consent is required';
    if (!data.accuracy) return 'Accuracy confirmation is required';
  }

  if (data.type === 'volunteer-application') {
    if (!data.name || !data.email || !data.credentials) {
      return 'Name, email, and background or credentials are required';
    }
    if (!data.consentContact || !data.accuracy) {
      return 'Verification consent and acknowledgement are required';
    }
  }

  if (data.type === 'media-inquiry') {
    if (!data.name || !data.email || !data.summary) {
      return 'Name, email, and inquiry summary are required';
    }
  }

  if (!validEmail(data.email)) return 'Enter a valid email address';
  if (hasSensitiveData(data)) {
    return 'Remove SSNs, full account numbers, card numbers, or other long sensitive numbers before submitting';
  }

  return '';
}

function evidenceScore(data) {
  let score = 0;
  if (data.timeline.length > 10) score += 15;
  if (data.institution) score += 10;
  if (data.issue) score += 10;
  if (data.amount) score += 10;
  if (data.evidence.length > 15) score += 20;
  if (data.priorContact) score += 10;
  if (data.remedy) score += 15;
  if (!hasSensitiveData(data)) score += 10;
  return Math.min(100, score);
}

function requestOriginAllowed(req) {
  const origin = req.headers?.origin;
  if (!origin) return { ok: true, origin: '' };

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const sameOrigin = host && origin === `${proto}://${host}`;

  const configured = [
    process.env.SITE_ORIGIN,
    ...(process.env.ALLOWED_ORIGINS || '').split(',')
  ].map((value) => (value || '').trim()).filter(Boolean);

  return {
    ok: Boolean(sameOrigin || configured.includes(origin)),
    origin
  };
}

async function verifyTurnstile(token, ip) {
  const siteKeyConfigured = Boolean(process.env.TURNSTILE_SITE_KEY);
  const secretConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY);
  if (!siteKeyConfigured && !secretConfigured) {
    return { ok: true, skipped: true };
  }
  if (!siteKeyConfigured || !secretConfigured) {
    return { ok: false, error: 'Bot protection is partially configured. Add both Turnstile keys.' };
  }
  if (!token) return { ok: false, error: 'Complete the bot-protection check' };

  const form = new URLSearchParams();
  form.append('secret', process.env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  if (ip) form.append('remoteip', String(ip).split(',')[0].trim());

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: controller.signal
    });
    const result = await response.json();
    return { ok: Boolean(result.success), result };
  } catch {
    return { ok: false, error: 'Bot-protection service unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

function buildReport(data) {
  const reportId = `BHR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const report = {
    ...data,
    reportId,
    consentVersion: data.consentVersion || CONSENT_VERSION,
    consentAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  report.evidenceScore = evidenceScore(report);
  return report;
}

async function sendEmail(report) {
  if (!process.env.RESEND_API_KEY || !process.env.REPORT_TO_EMAIL) {
    return { skipped: true, reason: 'email-not-configured' };
  }

  const from = process.env.REPORT_FROM_EMAIL || 'Bank Harm Registry <onboarding@resend.dev>';
  const body = [
    'CONFIDENTIAL INTAKE — REVIEW BEFORE SHARING',
    `Report ID: ${report.reportId}`,
    `Type: ${report.type}`,
    `Name or alias: ${report.name}`,
    `Email: ${report.email}`,
    `Institution: ${report.institution}`,
    `Issue: ${report.issue}`,
    `State: ${report.state}`,
    `Evidence score: ${report.evidenceScore}`,
    `Consent version: ${report.consentVersion}`,
    `Consent contact: ${report.consentContact}`,
    `Consent declaration: ${report.consentDeclaration}`,
    `Consent public summary: ${report.consentPublic}`,
    `Consent attorney: ${report.consentAttorney}`,
    `Consent media: ${report.consentMedia}`,
    '',
    'Timeline:',
    report.timeline,
    '',
    'Evidence listed:',
    report.evidence,
    '',
    'Requested remedy:',
    report.remedy,
    '',
    'Story / summary:',
    report.story || report.summary,
    '',
    'Volunteer credentials / media outlet:',
    report.credentials || report.mediaOutlet,
    '',
    'Conflict disclosure:',
    report.conflictDisclosure
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [process.env.REPORT_TO_EMAIL],
        subject: `Private BHR intake: ${report.institution || report.type} — ${report.reportId}`,
        text: body
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: 'email-delivery-failed', providerStatus: response.status };
    return { ok: true, providerId: result.id || '' };
  } catch {
    return { ok: false, error: 'email-delivery-unavailable' };
  }
}

async function createGitHubIssue(report) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return { skipped: true, reason: 'github-not-configured' };
  }
  if (process.env.GITHUB_REPO_PRIVATE_CONFIRMED !== 'true') {
    return { skipped: true, reason: 'private-repo-confirmation-required' };
  }

  const mode = process.env.GITHUB_INTAKE_MODE === 'full' ? 'full' : 'summary';
  const lines = [
    '> CONFIDENTIAL INTAKE. Keep this repository private. Do not copy to a public issue or pull request.',
    '',
    '## Intake metadata',
    `- Report ID: ${report.reportId}`,
    `- Type: ${report.type}`,
    `- Name or alias: ${report.name}`,
    `- Contact email: ${report.email}`,
    `- Institution: ${report.institution}`,
    `- Issue: ${report.issue}`,
    `- State: ${report.state}`,
    `- Evidence score: ${report.evidenceScore}`,
    `- Consent version: ${report.consentVersion}`,
    `- Contact consent: ${report.consentContact}`,
    `- Declaration consent: ${report.consentDeclaration}`,
    `- Public-summary consent: ${report.consentPublic}`,
    `- Attorney-contact consent: ${report.consentAttorney}`,
    `- Media-contact consent: ${report.consentMedia}`
  ];

  if (mode === 'full') {
    lines.push(
      '',
      '## Timeline',
      report.timeline,
      '',
      '## Evidence listed',
      report.evidence,
      '',
      '## Requested remedy',
      report.remedy,
      '',
      '## Story / summary',
      report.story || report.summary,
      '',
      '## Credentials / conflict disclosure',
      report.volunteerRole || '',
      report.credentials || '',
      report.conflictDisclosure || ''
    );
  } else {
    lines.push('', '_Summary mode is enabled. Full narrative is not copied into GitHub._');
  }

  lines.push(
    '',
    '## Admin review',
    '- [ ] Sensitive-data review',
    '- [ ] Consent verified',
    '- [ ] Evidence score reviewed',
    '- [ ] Regulator route assigned',
    '- [ ] Support match reviewed',
    '- [ ] Public use blocked unless separately approved'
  );

  try {
    const issuePayload = {
      title: `[Private intake] ${report.institution || report.type} — ${report.reportId}`,
      body: lines.join('\n')
    };
    const labels = (process.env.GITHUB_LABELS || '')
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);
    if (labels.length) issuePayload.labels = labels;

    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'bank-harm-registry'
      },
      body: JSON.stringify(issuePayload)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: 'github-delivery-failed', providerStatus: response.status };
    return { ok: true, issueNumber: result.number };
  } catch {
    return { ok: false, error: 'github-delivery-unavailable' };
  }
}

module.exports = async function handler(req, res) {
  const originCheck = requestOriginAllowed(req);
  if (originCheck.origin && originCheck.ok) {
    res.setHeader('Access-Control-Allow-Origin', originCheck.origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    if (!originCheck.ok) return json(res, 403, { ok: false, error: 'Origin not allowed' });
    return json(res, 204, {});
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  if (!originCheck.ok) {
    return json(res, 403, { ok: false, error: 'Origin not allowed' });
  }

  const contentType = String(req.headers?.['content-type'] || '');
  if (contentType && !contentType.includes('application/json')) {
    return json(res, 415, { ok: false, error: 'Content-Type must be application/json' });
  }

  try {
    const raw = await readBody(req);
    const data = normalizePayload(raw);
    const validationError = validatePayload(data);
    if (validationError) {
      return json(res, 400, { ok: false, error: validationError });
    }

    const turnstile = await verifyTurnstile(
      data.turnstileToken,
      req.headers?.['x-forwarded-for']
    );
    if (!turnstile.ok) {
      return json(res, 403, { ok: false, error: turnstile.error || 'Bot protection failed' });
    }

    const report = buildReport(data);
    const [email, github] = await Promise.all([
      sendEmail(report),
      createGitHubIssue(report)
    ]);

    const delivered = Boolean(email.ok || github.ok);
    const configured = !email.skipped || !github.skipped;

    if (!configured) {
      return json(res, 503, {
        ok: false,
        error: 'Private delivery is not configured yet. Add Resend or confirmed-private GitHub environment variables in Vercel before accepting real reports.'
      });
    }

    if (!delivered) {
      return json(res, 502, {
        ok: false,
        error: 'The report could not be delivered. Please retry later.',
        delivery: { email, github }
      });
    }

    return json(res, 202, {
      ok: true,
      reportId: report.reportId,
      evidenceScore: report.evidenceScore,
      delivery: {
        email: email.ok ? 'delivered' : email.reason || email.error,
        github: github.ok ? 'delivered' : github.reason || github.error
      },
      warnings: [
        'No public posting occurs without separate consent, redaction, and review.',
        'Save the receipt number shown above.'
      ]
    });
  } catch (error) {
    const status = /too large/i.test(error.message || '') ? 413 : 400;
    return json(res, status, { ok: false, error: error.message || 'Request failed' });
  }
};

module.exports._test = {
  hasSensitiveData,
  evidenceScore,
  normalizePayload,
  validatePayload,
  requestOriginAllowed
};
