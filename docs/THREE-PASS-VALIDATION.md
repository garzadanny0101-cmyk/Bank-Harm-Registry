# Three-Pass Validation Record — Gold Standard v3

## Pass 1: Architecture and completeness
Validated:
- Vercel static + serverless file structure
- API routes and environment-variable template
- 404 page, manifest, robots, sitemap, security policy
- Correct relative links for root, guide, and institution pages
- Private delivery requirement before API success

## Pass 2: Code, privacy, and security
Validated:
- JavaScript syntax
- API method, origin, content-type, size, email, consent, honeypot, and sensitive-number checks
- Optional Turnstile client rendering plus required server verification when configured
- No automatic local storage of private narratives or contact details
- Safe DOM rendering with `textContent`
- Private GitHub handoff disabled until repository privacy is explicitly confirmed
- Security headers and no-store API responses

## Pass 3: UX, SEO, accessibility, and consumer safety
Validated:
- Unique titles/descriptions/canonical tags
- One H1 per page
- Skip links, focus styles, form status announcements, image alt text
- Public CFPB statistics with primary-source link and context disclaimer
- Noindex for prototype admin/war-room pages
- Donation anti-influence language
- Volunteer/expert qualification and conflict guardrails
- Official public-action links on institution pages

## Remaining external validations
- Live Vercel preview/production deployment
- Real email or private-GitHub delivery
- Real Turnstile keys
- Attorney/privacy review before high-volume public intake
- Payment-provider configuration and fundraising compliance review

## Final local result
- `npm test`: PASS
- API smoke tests: PASS
- Static audit: PASS for 24 HTML files
- Local HTTP page check: 24/24 returned 200
- Print-layout render sanity check: PASS
