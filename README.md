# Bank Harm Registry — GOLD STANDARD v3

A Vercel-ready, privacy-first consumer banking evidence, regulator-routing, and consent-based support platform.

## Critical improvement
The API does **not** claim success unless a private email or confirmed-private GitHub delivery channel actually accepts the submission. Private stories are not stored in browser localStorage; only a receipt ID and non-sensitive metadata are saved after successful delivery.

## Included
- Consumer report intake and evidence scoring
- Consent matrix for contact, declarations, public summaries, attorneys, and media
- Optional Resend email delivery
- Optional private GitHub issue handoff
- Optional Cloudflare Turnstile client + server validation
- Regulator resource directory
- CFPB 2025 national complaint context
- Institution pages with selected official public actions
- Donation/support and donor-influence firewall
- Volunteer/expert application with conflict disclosure
- Static admin and review-team prototypes marked `noindex`
- Security headers, policies, sitemap, robots, manifest, 404
- API smoke tests and static site audit

## Test
```bash
npm test
```

## Clean GitHub/Vercel setup
1. Back up the old repository.
2. Extract this ZIP.
3. Upload the **contents inside** `Bank-Harm-Registry-GOLD-STANDARD-v3` to the repository root.
4. Ensure `index.html`, `api`, `assets`, and `package.json` appear at the root.
5. Import the repository into Vercel.
6. Framework preset: **Other**.
7. Build command and output directory: leave blank.
8. Add environment variables from `.env.example`.
9. Open `/api/health`.
10. Submit one fake report and confirm private delivery.
11. Run through `docs/GO-LIVE-CHECKLIST.md`.

## Required before accepting real reports
Configure at least one:
- Resend: `RESEND_API_KEY` + `REPORT_TO_EMAIL`
- Private GitHub issues: token with Issues write permission + owner/repo + `GITHUB_REPO_PRIVATE_CONFIRMED=true`

Recommended:
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

## Donation links
Edit `site-config.js`. Buttons remain disabled until real reviewed payment URLs are added.

## Replace before public launch
- canonical placeholder domain `bankharmregistry.org`
- privacy/security contact placeholders
- payment links
- policy/retention language after qualified review

## Never commit
- `.env`
- API keys
- GitHub tokens
- consumer reports or evidence
