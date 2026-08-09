# CM-COM-2B0 — Domain Readiness

Readiness only. This document **does not** purchase a domain, configure DNS or MX, bind a
Railway custom domain, change Railway variables, deploy, or activate any commercial
capability. It prepares the repository and governance state so a future cutover can be
executed safely once an exact domain is approved.

- **CM-COM-2A** — trust architecture: **COMPLETE / MERGED** (PR #23).
- **CM-COM-2B0** — this sprint: domain readiness.
- **CM-COM-2B1** — actual domain cutover: **BLOCKED** until an approved, owned domain exists
  and the Founder explicitly authorizes it.

Current verified application origin remains the Railway production origin.
`cornermex.ae` is **not purchased and not operational** (`FD-CM-PUBLIC-CONTACT-001`).

---

## 1. Domain approval contract

CM-COM-2B1 must not start until **every** item below is recorded. Items are evidence, not
credentials: **never** commit registrar passwords, recovery codes, API tokens or secret keys.

| #   | Required evidence                                                                                                                                                                              | Status                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | **Exact domain string** (single, unambiguous, including whether apex or a subdomain is the target)                                                                                             | PENDING                               |
| 2   | **Founder approval** recorded as a decision record (`FD-CM-DOMAIN-*`)                                                                                                                          | PENDING                               |
| 3   | **Ownership/control attestation** — that the domain is registered to, or controlled by, the business. Attestation only; no credentials                                                         | PENDING                               |
| 4   | **Registrar/account custody classification** — which account holds it, who can recover it, and whether custody is personal or company                                                          | PENDING                               |
| 5   | **Intended web use** — storefront only, or also marketing/other surfaces                                                                                                                       | PENDING                               |
| 6   | **Apex vs `www` decision** — which is canonical and which redirects                                                                                                                            | PENDING                               |
| 7   | **Email-domain status, recorded separately from web-domain status** — owning a web domain does **not** create mailboxes; the temporary public mailbox stays in force until a separate decision | PENDING                               |
| 8   | **Canonical application URL decision** — the value `CORNERMEX_PUBLIC_APPLICATION_URL` will take                                                                                                | PENDING                               |
| 9   | **Rollback origin** — the Railway origin that stays valid throughout                                                                                                                           | Railway production origin (available) |
| 10  | **OAuth redirect impact** — confirmation that the new origin is added to the Supabase Auth allow-list _before_ cutover                                                                         | PENDING                               |
| 11  | **Sitemap/robots impact** — sitemaps follow the _request host_, canonical tags follow `siteUrl()`, and `robots.txt` is static; confirm the intended post-cutover output for all three          | PENDING                               |
| 12  | **TLS readiness** — certificate issuance path and verification step                                                                                                                            | PENDING                               |
| 13  | **Explicit authorization boundaries** — what the cutover does and does not authorize (it must not imply commercial activation)                                                                 | PENDING                               |

**Web-domain state and email-domain state must never be conflated.** A future approved web
domain does not authorize branded mailboxes, and does not supersede
`FD-CM-PUBLIC-CONTACT-001` until a separate contact decision replaces it.

---

## 2. URL authority inventory

Verified from the repository at base `acb1723095471786e904825042c1b9745f120504`.

### A — Canonical URL authority

| Authority             | Detail                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/site-url.ts` | **The single canonical origin authority.** `siteOrigin()` resolves, in order: browser `window.location.origin` → `process.env.CORNERMEX_PUBLIC_APPLICATION_URL` → `VERIFIED_PUBLIC_ORIGIN` (the Railway production origin). `siteUrl(path)` composes absolute URLs from it. Non-`http(s)` or unparseable values fall back to the verified origin. |

### B — Runtime override

| Authority                          | Detail                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CORNERMEX_PUBLIC_APPLICATION_URL` | Server-side override consumed by `site-url.ts`; declared in `src/config/commerce-env.ts` (optional URL) and listed in `scripts/program/validate-staging-readiness-change-request.mjs`. **Not set by this sprint.** |
| `PUBLIC_SITE_URL`                  | Consumed only by `src/lib/shipments.functions.ts` for order-email links; falls back to `siteOrigin()`. Reachable only when external email is enabled, which is fail-closed. **Not set by this sprint.**            |

### C — SEO consumers (read the canonical authority; no independent origin)

**Via `siteUrl()` (canonical authority):** `src/routes/__root.tsx` (WebSite JSON-LD),
`index.tsx`, `about.tsx`, `contact.tsx`, `delivery.tsx`, `returns.tsx`, `privacy.tsx`,
`terms.tsx`, `legal.index.tsx`, `b2b.tsx`, `b2b_.catalog.tsx`, `b2b_.quote.tsx`,
`product.$slug.tsx` — all canonical and `og:url` tags.

**Via request origin (NOT `siteUrl()`):** `src/routes/sitemap[.]xml.ts` and
`src/routes/api/public/sitemap[.]xml.ts` both build absolute URLs from
`new URL(request.url).origin`. They therefore follow whatever host actually served the
request. This is a **separate origin authority** from `siteUrl()` and is called out explicitly
because it means the two can disagree: if `CORNERMEX_PUBLIC_APPLICATION_URL` is set to the new
domain while the Railway host is still directly reachable, a request to the Railway host emits
Railway-origin sitemap URLs alongside new-domain canonical tags. Cutover validation must check
both surfaces on both hosts.

**Static, follows nothing:** `public/robots.txt` hardcodes the Railway origin in its
`Sitemap:` line. **It must be updated by hand at cutover.**

### D — Auth consumers

| Authority                      | Detail                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/login.tsx`         | Builds the OAuth `redirectTo` as `new URL("/auth/callback", window.location.origin)` — i.e. from the **browser origin**, not `siteUrl()`. |
| `src/routes/auth.callback.tsx` | Handles the returned session.                                                                                                             |

**Consequence:** the callback URL follows the domain automatically with **no code change** —
but Supabase Auth's redirect allow-list is a **platform** configuration that must include the
new origin _before_ cutover, or sign-in breaks at the moment DNS resolves.

### E — Legal/trust consumers

| Authority                      | Detail                                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `src/lib/legal-docs.ts`        | Website field reads `[PENDING CUSTOM DOMAIN ACTIVATION]`; it must be filled only at an authorized cutover. |
| `src/lib/public-contact.ts`    | Public mailbox authority; deliberately independent of the web domain.                                      |
| `src/lib/business-identity.ts` | Founder-attested identity; contains no URL.                                                                |

### F — Historical/dead

No live `cornermex.ae` origin remains in application source. Remaining textual occurrences are
governance records stating it is **not** owned — see `docs/commercial/cm-com-2a-trust-architecture.md`.

### Dependency graph

```
CORNERMEX_PUBLIC_APPLICATION_URL ─┐
browser origin ───────────────────┼─► siteOrigin() ─► siteUrl() ─► canonical tags, og:url, JSON-LD
Railway verified origin (fallback)┘                 └─► shipments email links (PUBLIC_SITE_URL first)

new URL(request.url).origin ─────► /sitemap.xml and /api/public/sitemap.xml   (request-host driven)

window.location.origin ──────────► OAuth redirectTo ─► /auth/callback         (browser-driven)

public/robots.txt ───────────────► hardcoded Sitemap: origin   (MANUAL update at cutover)
```

Three independent origin sources exist — the canonical authority, the request host, and the
browser origin — plus one static file. A cutover is only coherent when all four agree.

---

## 3. CM-COM-2B1 cutover runbook

Prepared, **not executed**. Every step requires the domain approval contract to be complete.

### Pre-cutover

1. Exact domain approved and recorded in a Founder decision record.
2. Ownership/control attested; custody classified.
3. Record current `main` exact SHA; confirm CI green on it.
4. Record current production health provenance (`/api/health` commit) with a fresh read-only GET.
5. Verify the rollback origin (Railway) is serving and will remain attached.

### Domain

6. Registrar/DNS preflight: confirm nameserver control and existing record inventory.
7. Apply the apex vs `www` decision; define which redirects to which.
8. Create DNS records as Railway specifies for the chosen target.
9. Bind the Railway custom domain (**platform write — requires explicit authorization**).
10. Verify TLS issuance and that the certificate covers the chosen host(s).

### Application

11. Set `CORNERMEX_PUBLIC_APPLICATION_URL` to the approved canonical URL (**platform write**).
12. Confirm redirect behaviour between apex and `www` matches the decision.
13. Re-verify sitemap output on **both** hosts: sitemaps follow the request host, so the Railway host will still emit Railway URLs while it remains directly reachable. Decide whether that is acceptable or whether the Railway host should redirect.
14. **Update `public/robots.txt` `Sitemap:` by hand** — it does not follow `siteOrigin()`.
15. Fill the legal website field, replacing `[PENDING CUSTOM DOMAIN ACTIVATION]`.
16. Add the new origin to the Supabase Auth redirect allow-list **before** announcing the domain.

### Validation

17. HTTP → HTTPS redirect; certificate valid and trusted.
18. Apex and `www` both behave per the decision.
19. Canonical tags, `og:url` and JSON-LD resolve to the new origin.
20. `/sitemap.xml`, `/robots.txt` and canonical tags coherent with each other on the new host — and checked again on the Railway host, which uses a different origin source.
21. OAuth sign-in completes end-to-end via `/auth/callback` on the new origin.
22. Public routes render: `/`, `/shop`, `/b2b`, `/about`, `/contact`, `/delivery`, `/returns`,
    `/privacy`, `/terms`, `/legal`; `/shipping` still redirects to `/delivery`.
23. Desktop and mobile smoke pass.

### Rollback

24. The Railway origin remains attached and serving throughout — it is the rollback target.
25. DNS reversal: restore prior records; document TTL exposure before cutting over.
26. Decide explicitly whether to detach the Railway custom domain on rollback, or leave it bound.
27. Canonical rollback: revert `CORNERMEX_PUBLIC_APPLICATION_URL`, `robots.txt` and the legal
    website field together — a partial revert leaves incoherent canonical state.

### Not authorized by a cutover

A domain cutover authorizes **no** commercial capability: checkout, payments, bank transfer,
COD, external email, external messaging, A3.2b, catalog population and inventory all remain
separately gated.

---

## 4. Pre-activation debt register

Identified by independent review. **These do not block CM-COM-2B0.** They **must** remain
visible and be resolved before external email is activated.

| #   | Debt                                                      | Location                                                                      | Required before activation                                                    |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Email telemetry maps a skipped send to `failed`           | `src/lib/shipments.functions.ts` (`logNotification` call in `sendOrderEmail`) | Map `skipped → skipped`, `sent → sent`, real failure → `failed`               |
| 2   | `sendOrderEmail` authentication not explicitly reviewed   | `src/lib/shipments.functions.ts`                                              | Review and document the caller authorization before external email is enabled |
| 3   | Provider failure responses return a provider body excerpt | `src/lib/external-email.server.ts` (`error` field)                            | Make failures opaque to callers before activation                             |

---

## 5. Boundaries honoured by this sprint

No writes to Railway, Supabase, DNS, domain registrar, OAuth provider, email provider or
CornerOps. No domain purchased or configured, no MX, no custom-domain binding, no Railway
variable change, no deployment, and no commercial activation of any kind.
