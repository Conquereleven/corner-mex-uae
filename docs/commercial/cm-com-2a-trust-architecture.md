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

## Business facts used, with evidence class

- Legal identity — "CornerMex, a trading brand of RodMor TradeCo LLC · Sharjah Media City,
  Free Zone, UAE · Trade license 2647014.01". Evidence: **Founder-attested**
  (`FD-CM-BUSINESS-IDENTITY-001`); not independently verified against an external registry.
- Public contact — the Founder-authorized **temporary** Gmail address recorded in
  `FD-CM-PUBLIC-CONTACT-001`, resolved through `public-contact.ts`. Evidence:
  **Founder-attested / temporary**; no independent mailbox verification is claimed.
- Seven-emirates delivery structure (`shipping.functions.ts` emirate enum).
- Checkout execution disabled by default (`CORNERMEX_CHECKOUT_ENABLED` gate).

### Correction (CM-COM-2A-R2)

An earlier revision of this document listed `b2b@/complaints@/legal@/privacy@ cornermex.ae`
under "verified business facts". That classification was **wrong**: the domain
`cornermex.ae` is **not purchased and not operational**, so those mailboxes were never
verified business facts and must not be presented as active contact channels. Corrected
per `FD-CM-PUBLIC-CONTACT-001`.

## Domain and contact status

- Custom web domain: **not purchased**.
- `cornermex.ae`: **not owned, not operational** — must not appear as an active website,
  mailbox domain or implied asset on any customer-visible surface.
- Current verified application origin: the Railway production origin (unchanged).
- Future domain cutover: **CM-COM-2B remains ON HOLD** and requires separate Founder
  authorization for any purchase, DNS/MX, TLS or Railway custom-domain action.

## Corrections to stale copy

- `/terms` and `/legal` index previously claimed accounts/cart were disabled; accounts and B2C
  cart preparation exist. Wording now matches actual behavior while keeping execution-disabled
  truth.
- `src/lib/legal-docs.ts` previously published `Website: https://cornermex.ae` at `/legal`.
  Removed in R2; the field now reads `[PENDING CUSTOM DOMAIN ACTIVATION]`.
- The CM-COM-2A domain test no longer exempts `legal-docs.ts`; that exemption had masked a
  publicly rendered claim.

## Known debt, deliberately not changed in R2 (Category D — disabled paths)

Two inherited server paths still reference the unowned domain. Both are **non-rendered** and
send mail only when `LOVABLE_API_KEY` **and** `RESEND_API_KEY` are present, so neither can
reach a customer today:

- `src/lib/shipments.functions.ts` — an unowned-domain fallback origin used to build links in
  order emails.
- `src/lib/b2b-leads.functions.ts` — an unowned-domain mailto inside the lead-acknowledgement
  email body.

They were left unchanged on purpose: editing them pulls their pre-existing third-party
email-provider address and API-key literals into the A3 privacy guard's changed-file scope,
and R2 is not authorized to modify email-provider configuration. The CM-COM-2A suite exempts
exactly these two files and separately asserts that their provider-key gate still exists, so
the exemption cannot silently become untrue.

**Follow-up:** correct both when email delivery is next worked on, together with the
provider FROM-address handling.

## Unknown Founder inputs (intentionally NOT displayed)

- Public phone number, street address for visits, support hours.
- VAT/TRN number.
- Approved return windows, fees, exclusions, refund timing.
- Delivery SLAs, free-shipping thresholds, COD rules, fulfilment partners.
- Custom domain and branded mailboxes (not purchased; see "Domain and contact status").

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
