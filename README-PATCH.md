# Bank Harm Registry — Premium 2026 Remaster Patch v4.0.0

This patch upgrades the existing static + Vercel serverless site without removing its existing policy, guide, resource, institution, donation, or volunteer pages.

## Replace/add

- `index.html`
- `styles.css`
- `script.js`
- `admin.html`
- `admin.js`
- `api/submit-report.js`
- `api/health.js`
- `api/public-config.js`
- `robots.txt`
- `.env.example`
- `package.json`
- `tests/smoke-test.js`
- `tests/static-audit.js`
- `docs/DEPLOY-VERCEL.md`

## Safety status

Admin Studio is a browser-only prototype. It reads safe receipt metadata only. Add authenticated server-side sessions, role-based authorization, encrypted database storage, retention controls, and audit logs before connecting it to private intake records.
