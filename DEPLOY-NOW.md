# DEPLOY NOW

## Fastest: Vercel Drop
1. Go to `https://vercel.com/drop`.
2. Drag the ZIP itself onto the page.
3. Deploy.
4. Add environment variables in Project Settings if you want real private delivery.
5. `/api/health` should return JSON.

**Important:** Vercel Drop creates a new project. It does not update your existing Vercel project URL. To keep your current Vercel project/URL, replace the repository files with this package on a test branch or deploy it to the existing project with Vercel CLI.

## Netlify
This package includes `netlify.toml`, a Netlify build, and Netlify Functions. For the full backend, use a logged-in Netlify project that processes the project source/build configuration, or Git/Netlify CLI. A static-only drop of already-built files will not carry serverless functions.

### Netlify build
`npm run build:netlify` creates `dist/` for the public files while Netlify deploys the functions from `netlify/functions/`.

## Preview environment values
- `DEMO_ACCEPT_WITHOUT_DELIVERY=true` (preview only)
- `TURNSTILE_REQUIRED=false`
- `GITHUB_INTAKE_ENABLED=false`

## Real email delivery
- `RESEND_API_KEY=re_...`
- `REPORT_TO_EMAIL=your-private-intake@example.com`
- `REPORT_FROM_EMAIL=Bank Harm Registry <verified@yourdomain.com>` (recommended)
- `DEMO_ACCEPT_WITHOUT_DELIVERY=false`

## Optional private GitHub intake
Use a separate PRIVATE repository, never the public source repo.
- `GITHUB_INTAKE_ENABLED=true`
- `GITHUB_TOKEN=...`
- `GITHUB_OWNER=...`
- `GITHUB_REPO=...`
- `GITHUB_REPO_PRIVATE_CONFIRMED=true`
- `GITHUB_INTAKE_MODE=summary`

## Tests
`npm test`
