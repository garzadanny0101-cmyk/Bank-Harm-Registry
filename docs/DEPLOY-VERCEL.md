# Vercel Deploy

1. Create a fresh GitHub repo or replace the old repo with this folder.
2. Push files to `main`.
3. Vercel → Add New → Project → Import repo.
4. Framework: Other.
5. Build command: blank.
6. Output directory: blank.
7. Deploy.
8. Open `/api/health`.

Optional env vars:
- `RESEND_API_KEY`
- `REPORT_TO_EMAIL`
- `REPORT_FROM_EMAIL`
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `TURNSTILE_SECRET_KEY`
- `SITE_ORIGIN`
