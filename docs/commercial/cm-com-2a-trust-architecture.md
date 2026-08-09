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

## External email is fail-closed (CM-COM-2A-R3)

R2 left the two inherited senders gated only by provider credentials and exempted them from
the domain-truth scan. Independent review correctly rejected that: credential absence is
runtime state, not an authorization contract — configuring provider keys could have made
sending possible without any code change or commercial email decision.

R3 closes this:

- `src/lib/external-email.server.ts` is the single canonical gate and transport.
  `isExternalEmailEnabled()` is **fail-closed**: only the exact literal `"true"` enables
  external email. Unset, `""`, `"false"`, `"0"`, `"1"`, `"TRUE"`, `"True"`, `"yes"`, `"on"`
  and arbitrary text all leave it disabled. No truthiness, no default-on.
- **Authorization and configuration are separate.** The capability flag is checked _before_
  provider configuration and before any outbound request, so provider keys alone can never
  authorize a send. Email activation is not coupled to checkout.
- Both `shipments.functions.ts` and `b2b-leads.functions.ts` now delegate to that gate.
  Neither builds provider headers, reads provider keys, or calls the provider directly.
- The unowned-domain fallback origin and the unowned-domain mailto are gone; the shipments
  path falls back to the verified application origin and the B2B email uses `PUBLIC_CONTACT`.
- Unauthorized commercial claims were removed from the B2B acknowledgement email: the
  one-business-day response promise and the delivery-SLA promise. The email now confirms
  receipt only and states it is not an order, quote or commitment. No replacement SLA was
  invented.
- The Category D exemption is **removed**. No application source is exempt from the
  cornermex.ae domain-truth scan.

The environment flag was **not** set and no provider credential was configured, so external
email remains disabled in the current state.

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

`npm run test:cm-com-2a` — 41 tests covering: Founder-attested identity and undefined
unattested fields; bank beneficiary spelling; delivery non-operational disclosure, absence of
absolute guarantees and suppressed COD thresholds; sequential heading outline; `/shipping`
redirect; manual-only contact; unique metadata titles; robots/sitemap/domain truth with **no**
application-source exemption; temporary public contact authority; and the R3 external-email
fail-closed gate (exact-`"true"` semantics, provider keys are not authorization, no outbound
request while disabled, both senders routed through the canonical gate, removed SLA/response
promises). Wired into CI and merged-tree validation. Full gate results recorded in the PR
description.
