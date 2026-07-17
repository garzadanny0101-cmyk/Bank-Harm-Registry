# Bank Harm Registry v4 — Local Test Report

Run date: 2026-07-17
Runtime: Node.js v22.16.0
Command: `npm test`

## Result

PASS

## API smoke coverage

- Valid consumer report accepted when `DEMO_ACCEPT_WITHOUT_DELIVERY=true`
- Normalization of email and consent booleans
- Evidence, remedy, support-readiness, risk, regulator, consent, status generation
- Missing accuracy consent rejected
- SSN and account/card-like identifiers rejected
- Honeypot rejected
- GET blocked
- Oversized payload rejected
- Disallowed origin rejected
- Health endpoint exposes booleans, environment, and timestamp without secret values
- Public Turnstile config excludes secret key
- Mocked Resend delivery accepted

## Static/privacy coverage

- Required patch files present
- Four-step intake wizard and required CTA copy present
- Separate consent controls present
- Legal/privacy disclaimers retained
- Admin prototype is noindex and contains exact warning
- Required admin sections and fields present
- CSV and JSON export controls present
- Browser localStorage write contains safe receipt metadata only
- No name, email, amount, story, evidence narrative, timeline, remedy, credentials, or documents are stored in the receipt object
- API configuration and security controls present
- robots.txt disallows admin prototype
- Environment-variable template complete
- JavaScript syntax checks pass

## Not verified locally

- Live Vercel deployment
- Real Resend delivery
- Real private GitHub issue delivery
- Production Cloudflare Turnstile
- Real authentication or database storage
- Production retention, backup, incident response, and administrative audit logging
- Full cross-browser visual regression
