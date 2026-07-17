# Security Checklist

- Use Vercel env vars; never commit secrets.
- Enable Cloudflare Turnstile before public traffic.
- Keep admin dashboard private before real data.
- Do not collect full account/card numbers or SSNs.
- Add rate limiting before traffic spikes.
- Store reports in email/GitHub only for beta; database with row-level security later.
- Use moderation before public summaries.
