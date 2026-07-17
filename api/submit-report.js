const crypto = require('crypto');

const MAX_BODY_BYTES = 128_000;
const CONSENT_VERSION = process.env.CONSENT_VERSION || '2026-07-17-v2';
const ALLOWED_TYPES = new Set(['consumer-report', 'volunteer-application', 'media-inquiry']);

const SENSITIVE_PATTERNS = [
  { label: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: 'nine-digit identifier', regex: /\b\d{9}\b/ },
  { label: 'card or account-like number', regex: /\b(?:\d[ -]*?){12,19}\b/ },
  { label: 'account-like identifier', regex: /\b(?:account|acct|routing|card)\s*(?:number|no\.?|#)?\s*[:=-]?\s*\d{6,19}\b/i }
];

function isTrue(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function asString(value, max = 5000) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\u0000/g, '').trim().slice(0, max);
}

function normalizePayload(input) {
  const aliases = {
    category: input?.category ?? input?.issue,
    consentAccuracy: input?.consentAccuracy ?? input?.accuracy,
    consentSupport: input?.consentSupport ?? input?.consentMatch
  };
  const source = { ...(input || {}), ...aliases };
  const limits = {
    type: 50,
    name: 120,
    email: 254,
    institution: 200,
    issue: 240,
    category: 120,
    state: 50,
    amount: 80,
    timeline: 5000,
    evidence: 7000,
    story: 14000,
    summary: 6000,
    remedy: 1500,
    credentials: 5000,
    area: 500,
    volunteerRole: 200,
    conflictDisclosure: 3500,
    mediaOutlet: 200,
    website: 200,
    pageUrl: 500,
    turnstileToken: 3000,
    consentVersion: 100
  };
  const payload = {};
  for (const [key, max] of Object.entries(limits)) payload[key] = asString(source[key], max);

  const booleanFields = [
    'priorContact', 'consentContact', 'consentDeclaration', 'consentPublic',
    'consentAttorney', 'consentMedia', 'consentSupport', 'consentAccuracy'
  ];
  for (const key of booleanFields) payload[key] = isTrue(source[key]);

  payload.email = payload.email.toLowerCase();
  payload.type = payload.type || 'consumer-report';
  payload.category = payload.category || 'Other';
  payload.consentVersion = payload.consentVersion || CONSENT_VERSION;
  return payload;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') {
    const bytes = Buffer.byteLength(JSON.stringify(req.body));
    if (bytes > MAX_BODY_BYTES) return Promise.reject(new Error('Request body too large'));
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body) > MAX_BODY_BYTES) return Promise.reject(new Error('Request body too large'));
    try { return Promise.resolve(req.body ? JSON.parse(req.body) : {}); }
    catch { return Promise.reject(new Error('Invalid JSON')); }
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    let complete = false;
    req.on('data', (chunk) => {
      if (complete) return;
      raw += chunk;
      if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
        complete = true;
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (complete) return;
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sensitiveFinding(payload) {
  const fields = [
    'name', 'institution', 'issue', 'category', 'state', 'amount', 'timeline',
    'evidence', 'story', 'summary', 'remedy', 'credentials', 'area',
    'conflictDisclosure', 'mediaOutlet'
  ];
  const text = fields.map((field) => payload?.[field] || '').join('\n');
  return SENSITIVE_PATTERNS.find(({ regex }) => regex.test(text))?.label || '';
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
    if (!data.consentAccuracy) return 'Accuracy confirmation is required';
  }

  if (data.type === 'volunteer-application') {
    if (!data.name || !data.email || !data.credentials || !data.conflictDisclosure) {
      return 'Name, email, credentials, and conflict disclosure are required';
    }
    if (!data.consentContact || !data.consentAccuracy) {
      return 'Verification consent and acknowledgement are required';
    }
  }

  if (data.type === 'media-inquiry') {
    if (!data.name || !data.email || !data.summary) return 'Name, email, and inquiry summary are required';
  }

  if (!validEmail(data.email)) return 'Enter a valid email address';
  const sensitive = sensitiveFinding(data);
  if (sensitive) return `Remove the apparent ${sensitive} before submitting`;
  return '';
}

function textHas(value, regex) {
  return regex.test(String(value || ''));
}

function evidenceScore(data) {
  let score = 10;
  if (data.timeline.length >= 40) score += 18;
  else if (data.timeline.length >= 10) score += 10;
  if (data.institution) score += 8;
  if (data.issue && data.category) score += 10;
  if (data.amount) score += 6;
  if (data.evidence.length >= 80) score += 22;
  else if (data.evidence.length >= 15) score += 12;
  if (data.priorContact) score += 10;
  if (data.story.length >= 120) score += 8;
  if (data.remedy.length >= 20) score += 8;
  return Math.min(100, score);
}

function remedyScore(data) {
  let score = 0;
  const remedy = data.remedy || '';
  if (remedy.length >= 10) score += 25;
  if (remedy.length >= 40) score += 20;
  if (textHas(remedy, /refund|reimburse|correct|remove|restore|unfreeze|reopen|investigate|provide|preserve|stop|written/i)) score += 25;
  if (textHas(remedy, /\$\s?\d|\b\d+\s?(?:dollars|days|business days)\b/i)) score += 15;
  if (data.priorContact) score += 10;
  if (data.timeline.length >= 20) score += 5;
  return Math.min(100, score);
}

function riskFlags(data) {
  const combined = [data.issue, data.category, data.story, data.timeline, data.remedy].join(' ');
  const flags = [];
  if (textHas(combined, /identity theft|account takeover|stolen identity/i)) flags.push('identity-theft');
  if (textHas(combined, /evict|foreclos|homeless|medical|medication|utility shut|immediate|urgent/i)) flags.push('urgent-harm');
  if (textHas(combined, /retaliat|threat|harass|discriminat/i)) flags.push('heightened-review');
  if (!data.priorContact) flags.push('company-contact-not-confirmed');
  const numericAmount = Number(String(data.amount || '').replace(/[^0-9.]/g, ''));
  if (Number.isFinite(numericAmount) && numericAmount >= 10000) flags.push('large-financial-impact');
  if (data.consentPublic) flags.push('public-summary-consent-review');
  return [...new Set(flags)];
}

function suggestedRegulators(data) {
  const text = `${data.category} ${data.issue} ${data.institution}`.toLowerCase();
  const regulators = new Set(['Consumer Financial Protection Bureau (CFPB)']);
  if (/credit report|debt collect/.test(text)) regulators.add('Federal Trade Commission (FTC) / state attorney general as applicable');
  if (/identity theft|account takeover|fraud/.test(text)) regulators.add('IdentityTheft.gov / FTC');
  if (/credit union/.test(text)) regulators.add('National Credit Union Administration (NCUA)');
  if (/securit|broker|investment/.test(text)) regulators.add('SEC or FINRA, depending on the product and entity');
  if (/bank|checking|saving|mortgage|loan|transfer|card|freeze|closure/.test(text)) {
    regulators.add('OCC, FDIC, Federal Reserve, or state regulator after charter lookup');
  }
  regulators.add('State attorney general or state financial regulator, depending on jurisdiction');
  return [...regulators];
}

function consentMatrix(data) {
  return {
    contact: data.consentContact,
    publicSummary: data.consentPublic,
    attorneyContact: data.consentAttorney,
    journalistContact: data.consentMedia,
    declarationSupport: data.consentDeclaration,
    consumerSupportMatching: data.consentSupport,
    accuracy: data.consentAccuracy,
    version: data.consentVersion
  };
}

function supportMatchReadinessScore(data, evidence, flags) {
  let score = 0;
  if (data.consentSupport) score += 35;
  if (data.consentContact) score += 15;
  if (data.state) score += 10;
  if (data.category && data.category !== 'Other') score += 15;
  if (evidence >= 60) score += 20;
  if (!flags.includes('heightened-review')) score += 5;
  return Math.min(100, score);
}

function deriveStatus({ evidence, remedy, support, flags, type }) {
  if (type !== 'consumer-report') return type === 'volunteer-application' ? 'volunteer-review' : 'new-inquiry';
  if (flags.includes('urgent-harm') || flags.includes('identity-theft')) return 'risk-review';
  if (support >= 75) return 'support-match-review';
  if (evidence >= 70 && remedy >= 60) return 'regulator-ready';
  if (evidence >= 65) return 'evidence-ready';
  return 'new-intake';
}

function buildReport(data) {
  const createdAt = new Date().toISOString();
  const reportId = `BHR-${createdAt.slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const evidence = evidenceScore(data);
  const remedy = remedyScore(data);
  const flags = riskFlags(data);
  const support = supportMatchReadinessScore(data, evidence, flags);
  return {
    ...data,
    reportId,
    createdAt,
    evidenceScore: evidence,
    remedyScore: remedy,
    supportMatchReadinessScore: support,
    riskFlags: flags,
    consentMatrix: consentMatrix(data),
    suggestedRegulators: suggestedRegulators(data),
    status: deriveStatus({ evidence, remedy, support, flags, type: data.type })
  };
}

function requestOriginAllowed(req) {
  const origin = req.headers?.origin;
  if (!origin) return { ok: true, origin: '' };
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
  const proto = req.headers?.['x-forwarded-proto'] || 'https';
  const sameOrigin = Boolean(host && origin === `${proto}://${host}`);
  const configured = [process.env.SITE_ORIGIN, ...(process.env.ALLOWED_ORIGINS || '').split(',')]
    .map((value) => String(value || '').trim().replace(/\/$/, ''))
    .filter(Boolean);
  return { ok: sameOrigin || configured.includes(origin.replace(/\/$/, '')), origin };
}

async function verifyTurnstile(token, ip) {
  const required = isTrue(process.env.TURNSTILE_REQUIRED);
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const configured = Boolean(siteKey && secret);

  if (!configured) {
    if (required) return { ok: false, error: 'Bot protection is required but not fully configured' };
    return { ok: true, skipped: true };
  }
  if (!token) return required
    ? { ok: false, error: 'Complete the bot-protection check' }
    : { ok: true, skipped: true, warning: 'turnstile-token-absent' };

  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.append('remoteip', String(ip).split(',')[0].trim());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form, signal: controller.signal
    });
    const result = await response.json();
    return { ok: Boolean(result.success), error: result.success ? '' : 'Bot protection failed' };
  } catch {
    return required ? { ok: false, error: 'Bot-protection service unavailable' } : { ok: true, skipped: true };
  } finally {
    clearTimeout(timer);
  }
}

function reportText(report) {
  return [
    'CONFIDENTIAL INTAKE — REVIEW BEFORE SHARING',
    `Report ID: ${report.reportId}`,
    `Created: ${report.createdAt}`,
    `Status: ${report.status}`,
    `Type: ${report.type}`,
    `Name or alias: ${report.name}`,
    `Email: ${report.email}`,
    `Institution: ${report.institution}`,
    `Issue: ${report.issue}`,
    `Category: ${report.category}`,
    `State: ${report.state}`,
    `Approximate amount: ${report.amount}`,
    `Evidence score: ${report.evidenceScore}`,
    `Remedy clarity score: ${report.remedyScore}`,
    `Support match readiness: ${report.supportMatchReadinessScore}`,
    `Risk flags: ${report.riskFlags.join(', ') || 'none'}`,
    `Suggested regulators: ${report.suggestedRegulators.join(' | ')}`,
    `Consent matrix: ${JSON.stringify(report.consentMatrix)}`,
    '', 'Timeline:', report.timeline,
    '', 'Evidence listed:', report.evidence,
    '', 'Requested remedy:', report.remedy,
    '', 'Story / summary:', report.story || report.summary,
    '', 'Volunteer role / credentials:', report.volunteerRole || '', report.credentials || '',
    '', 'Conflict disclosure:', report.conflictDisclosure || ''
  ].join('\n');
}

async function sendEmail(report) {
  if (!process.env.RESEND_API_KEY || !process.env.REPORT_TO_EMAIL) {
    return { skipped: true, reason: 'email-not-configured' };
  }
  const from = process.env.REPORT_FROM_EMAIL || 'Bank Harm Registry <onboarding@resend.dev>';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [process.env.REPORT_TO_EMAIL],
        subject: `Private BHR intake: ${report.institution || report.type} — ${report.reportId}`,
        text: reportText(report)
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
  const enabled = isTrue(process.env.GITHUB_INTAKE_ENABLED);
  if (!enabled) return { skipped: true, reason: 'github-intake-disabled' };
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) return { skipped: true, reason: 'github-not-configured' };
  if (!isTrue(process.env.GITHUB_REPO_PRIVATE_CONFIRMED)) {
    return { skipped: true, reason: 'private-repo-confirmation-required' };
  }

  const mode = process.env.GITHUB_INTAKE_MODE === 'full' ? 'full' : 'summary';
  const body = [
    '> CONFIDENTIAL INTAKE. Keep this repository private. Never copy private intake into a public issue or pull request.',
    '', '## Intake metadata',
    `- Report ID: ${report.reportId}`,
    `- Created: ${report.createdAt}`,
    `- Status: ${report.status}`,
    `- Type: ${report.type}`,
    `- Name or alias: ${report.name}`,
    `- Contact email: ${report.email}`,
    `- Institution: ${report.institution}`,
    `- Issue/category: ${report.issue} / ${report.category}`,
    `- State: ${report.state}`,
    `- Approximate amount: ${report.amount}`,
    `- Evidence score: ${report.evidenceScore}`,
    `- Remedy score: ${report.remedyScore}`,
    `- Support readiness: ${report.supportMatchReadinessScore}`,
    `- Risk flags: ${report.riskFlags.join(', ') || 'none'}`,
    `- Consent matrix: ${JSON.stringify(report.consentMatrix)}`,
    `- Suggested regulators: ${report.suggestedRegulators.join(' | ')}`
  ];
  if (mode === 'full') body.push('', '## Private narrative', reportText(report));
  else body.push('', '_Summary mode is enabled. Full story and evidence narrative are not copied into GitHub._');
  body.push('', '## Admin review',
    '- [ ] Sensitive-data review', '- [ ] Consent verified', '- [ ] Risk triage complete',
    '- [ ] Evidence/remedy scores reviewed', '- [ ] Regulator route assigned',
    '- [ ] Support matching separately approved', '- [ ] Public use blocked unless separately approved');

  const baseLabels = ['private-intake', report.type, report.status, ...report.riskFlags.map((flag) => `risk:${flag}`)];
  const configuredLabels = (process.env.GITHUB_LABELS || '').split(',').map((v) => v.trim()).filter(Boolean);
  const issuePayload = {
    title: `[Private intake] ${report.institution || report.type} — ${report.reportId}`,
    body: body.join('\n'),
    labels: [...new Set([...baseLabels, ...configuredLabels])].slice(0, 20)
  };

  try {
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

  if (req.method === 'OPTIONS') {
    if (!originCheck.ok) return json(res, 403, { ok: false, error: 'Origin not allowed' });
    res.statusCode = 204;
    return res.end('');
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  if (!originCheck.ok) return json(res, 403, { ok: false, error: 'Origin not allowed' });

  const contentType = String(req.headers?.['content-type'] || '');
  if (contentType && !contentType.includes('application/json')) {
    return json(res, 415, { ok: false, error: 'Content-Type must be application/json' });
  }

  try {
    const raw = await readBody(req);
    const data = normalizePayload(raw);
    const validationError = validatePayload(data);
    if (validationError) return json(res, 400, { ok: false, error: validationError });

    const turnstile = await verifyTurnstile(data.turnstileToken, req.headers?.['x-forwarded-for']);
    if (!turnstile.ok) return json(res, 403, { ok: false, error: turnstile.error || 'Bot protection failed' });

    const report = buildReport(data);
    const [email, github] = await Promise.all([sendEmail(report), createGitHubIssue(report)]);
    const demoAccepted = isTrue(process.env.DEMO_ACCEPT_WITHOUT_DELIVERY);
    const delivered = Boolean(email.ok || github.ok);
    const accepted = delivered || demoAccepted;

    if (!accepted) {
      const configuredAttemptFailed = (!email.skipped && !email.ok) || (!github.skipped && !github.ok);
      return json(res, configuredAttemptFailed ? 502 : 503, {
        ok: false,
        error: configuredAttemptFailed
          ? 'The report could not be delivered. Please retry later.'
          : 'Private delivery is not configured. Add Resend or enabled confirmed-private GitHub intake, or enable demo acceptance for testing.',
        delivery: { email, github }
      });
    }

    return json(res, delivered ? 202 : 200, {
      ok: true,
      reportId: report.reportId,
      createdAt: report.createdAt,
      evidenceScore: report.evidenceScore,
      remedyScore: report.remedyScore,
      supportMatchReadinessScore: report.supportMatchReadinessScore,
      riskFlags: report.riskFlags,
      consentMatrix: report.consentMatrix,
      suggestedRegulators: report.suggestedRegulators,
      status: report.status,
      delivery: {
        email: email.ok ? 'delivered' : email.reason || email.error,
        github: github.ok ? 'delivered' : github.reason || github.error,
        demo: !delivered && demoAccepted ? 'accepted-without-delivery' : 'not-used'
      },
      warnings: [
        'No public posting occurs without separate consent, redaction, and admin review.',
        'Support matching requires explicit consent and admin approval.',
        ...(!delivered && demoAccepted ? ['Demo mode accepted this report without durable private delivery. Do not use demo mode for real consumer intake.'] : [])
      ]
    });
  } catch (error) {
    const status = /too large/i.test(error.message || '') ? 413 : 400;
    return json(res, status, { ok: false, error: error.message || 'Request failed' });
  }
};

module.exports._test = {
  MAX_BODY_BYTES,
  isTrue,
  normalizePayload,
  sensitiveFinding,
  validatePayload,
  evidenceScore,
  remedyScore,
  riskFlags,
  suggestedRegulators,
  consentMatrix,
  supportMatchReadinessScore,
  deriveStatus,
  buildReport,
  requestOriginAllowed
};
