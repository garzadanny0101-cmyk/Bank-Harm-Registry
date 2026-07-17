# Security Policy

## Before public intake
- Replace the placeholder security email in `.well-known/security.txt`.
- Configure at least one private delivery channel.
- Keep any GitHub intake repository private.
- Configure Cloudflare Turnstile and verify it server-side.
- Test `/api/health` and a fake submission.
- Never commit `.env` or API keys.
- Add authenticated storage and admin access before displaying real reports in a dashboard.

## Reporting a vulnerability
Do not post vulnerabilities or private consumer information in a public issue.
Use the security contact configured in `.well-known/security.txt`.

## Data-handling rule
No private report, contact detail, document, or support match is public by default.
