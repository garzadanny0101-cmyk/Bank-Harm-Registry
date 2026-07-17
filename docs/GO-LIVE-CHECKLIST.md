# Go-Live Checklist

## Pass 1 — Deployment
- [ ] Files are at repository root, not inside an extra nested folder.
- [ ] Vercel project imports the correct repository.
- [ ] Production branch is the intended branch.
- [ ] `/api/health` returns `readyToAcceptPrivateIntake: true`.
- [ ] One fake report returns a receipt ID.

## Pass 2 — Privacy and security
- [ ] At least one private delivery channel is configured.
- [ ] GitHub intake repository remains private.
- [ ] `GITHUB_REPO_PRIVATE_CONFIRMED=true` only after checking privacy.
- [ ] Turnstile site and secret keys are configured.
- [ ] Sensitive-number blocking was tested.
- [ ] Privacy, terms, disclaimer, and deletion/retention process were reviewed.
- [ ] Placeholder emails and canonical domain were replaced.
- [ ] Dashboard and war-room prototypes remain `noindex`.

## Pass 3 — Consumer and growth quality
- [ ] Mobile navigation and forms were tested.
- [ ] Official resource links open correctly.
- [ ] Donation buttons have real reviewed payment links or stay disabled.
- [ ] No claim promises legal help, expert status, relief, or case outcomes.
- [ ] Public complaint statistics include source and context disclaimer.
- [ ] Public stories require consent, redaction, and moderation.
- [ ] `npm test` passes before production.
