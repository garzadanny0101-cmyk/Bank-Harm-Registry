# Bank Harm Registry v4 — Vercel Deployment

1. Back up the current repository or create a branch locally.
2. Copy the files in this patch over the repository root, preserving existing policy, resource, bank, guide, and asset files.
3. Run `npm test` locally.
4. Push only after reviewing the diff. Do not commit `.env`, API keys, GitHub tokens, reports, or evidence.
5. In Vercel, import or open the Bank Harm Registry project.
6. Framework preset: **Other**. Leave Build Command and Output Directory blank unless the existing project uses explicit values.
7. Add the environment variables listed in `.env.example` for Production and Preview as appropriate.
8. Redeploy.
9. Open `/api/health` and confirm only configuration booleans are returned.
10. Submit a fake report. Confirm Resend or the private GitHub repository receives it.
11. Confirm `/admin.html` is `noindex`, shows the prototype warning, and contains no real private intake data.
12. Keep `DEMO_ACCEPT_WITHOUT_DELIVERY=false` in production.

## Required production minimum

Configure at least one delivery path:

- `RESEND_API_KEY` + `REPORT_TO_EMAIL`; or
- `GITHUB_INTAKE_ENABLED=true` + `GITHUB_TOKEN` + `GITHUB_OWNER` + `GITHUB_REPO` + `GITHUB_REPO_PRIVATE_CONFIRMED=true`.

Real authentication and encrypted database storage are still required before Admin Studio may retrieve or display private report content.
