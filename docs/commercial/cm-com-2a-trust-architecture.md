# CM-COM-2A — Trust Architecture

Scope: public trust surfaces only. This sprint is CM-COM-2A; it does not complete CM-COM-2,
does not deploy, and does not authorize domain cutover or commercial activation.

## Implemented surfaces

- `/about` — editorial company page (what CornerMex is, B2C + B2B pathways, how-we-work).
- `/contact` — new; three manual email intents (customer support, B2B/wholesale, privacy/legal)
  from the central `PUBLIC_CONTACT` registry. No forms, no automated sending.
- `/delivery` — new; emirate-based coverage explained without inventing times, fees, thresholds
  or partners. `/shipping` now redirects here.
- `/returns`, `/privacy`, `/terms` — restructured plain-language summaries with accurate
  capability descriptions, metadata and links to the review-gated `/legal` template centre.
- Footer — Shop / Help / Company / Legal groups, central identity line, contact email.
- Contextual `TrustBar` on product detail, cart, checkout and B2B quote.
- Reusable trust layer: `src/components/site/Trust.tsx` (`TrustCard`, `TrustBar`,
  `PolicyLinkGroup`) and `src/lib/business-identity.ts` (single source of identity facts).
- SEO: unique titles/descriptions/canonicals via `siteUrl()` (origin-safe, no custom domain);
  both sitemaps updated; `public/robots.txt` sitemap URL moved off the retired lovable.app
  origin to the verified Railway origin.

## Verified business facts used

- "CornerMex, a trading brand of RodMor TradeCo LLC · Sharjah Media City, UAE ·
  Trade license 2647014.01" (pre-existing footer truth, now centralized).
- Contact mailboxes b2b@/complaints@/legal@/privacy@ cornermex.ae (pre-existing
  `public-contact.ts`).
- Seven-emirates delivery structure (`shipping.functions.ts` emirate enum).
- Checkout execution disabled by default (`CORNERMEX_CHECKOUT_ENABLED` gate).

## Corrections to stale copy

- `/terms` and `/legal` index previously claimed accounts/cart were disabled; accounts and B2C
  cart preparation exist. Wording now matches actual behavior while keeping execution-disabled
  truth.
- Not corrected in this sprint (pre-existing, out of scope): `src/lib/shipments.functions.ts`
  keeps a `https://cornermex.ae` fallback origin inside the disabled email path. Flagged for a
  follow-up config fix; excluded explicitly from the CM-COM-2A domain test.

## Unknown Founder inputs (intentionally NOT displayed)

- Public phone number, street address for visits, support hours.
- VAT/TRN number.
- Approved return windows, fees, exclusions, refund timing.
- Delivery SLAs, free-shipping thresholds, COD rules, fulfilment partners.
- Custom domain (no cornermex.ae canonical anywhere in app code).

These have typed slots (`business-identity.ts` optional fields; legal centre templates) and can
be added centrally once approved.

## Non-goals honored

No DNS/domain change, no deployment, no Railway/Supabase writes, no migrations, no checkout or
payment enablement, no email/WhatsApp/CRM activation, no inventory or admin changes, no
CornerOps involvement.

## Test evidence

`npm run test:cm-com-2a` — 12/12 static contract tests (routes exist, redirect, footer/sitemap
links, robots, centralized identity, banned fabricated-promise patterns, metadata presence, no
unverified domain, checkout disabled default, central contact registry, contextual TrustBar).
Full gate results recorded in the PR description.
