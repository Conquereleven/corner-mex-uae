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

#### SSR vs browser semantics — verified

The precedence above is **context-dependent, and this is load-bearing for a cutover**
(behaviour proven by test in `tests/cm-com-2b0/`):

| Context                                 | `window`  | Origin used                                                        |
| --------------------------------------- | --------- | ------------------------------------------------------------------ |
| Initial SSR request                     | undefined | `CORNERMEX_PUBLIC_APPLICATION_URL`, else Railway fallback          |
| Browser (hydration / client navigation) | defined   | **`window.location.origin` — the env override is never consulted** |

Consequences, stated without overclaiming:

- **Can the Railway rollback host emit Railway canonical metadata after the env override is
  set?** Yes — in the browser. Served from the Railway host, `window.location.origin` is the
  Railway origin and wins over the override. On the initial SSR response the same host would
  emit the override value instead. The two can therefore disagree on the same page.
- **Can client-side navigation recalculate canonical metadata from `window.location.origin`?**
  The origin _function_ provably returns the browser origin in that context. Whether the
  router re-evaluates a given route's `head()` on client navigation was **not** determined in
  this sprint — see preflight **P1**. Not asserted either way.
- **Is `CORNERMEX_PUBLIC_APPLICATION_URL` a deterministic canonical origin across SSR and
  client navigation?** **No.** It is bypassed whenever `window` exists. Deterministic canonical
  output would require a source change to `site-url.ts`, which belongs in the reviewed
  exact-domain code delta — not a variable change. See preflight **P2**.

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

## 3. CM-COM-2B1 cutover model

Prepared, **not executed**. Every step requires the domain approval contract to be complete.

CM-COM-2B0 is readiness only, so this section defines the cutover **conceptually**. Where the
exact mechanism cannot yet be specified truthfully, that is recorded as a CM-COM-2B1 decision
rather than invented here.

### Hard invariant — ACTIVATION-INERT

> **Any source deployed BEFORE domain activation MUST remain activation-inert.**
>
> While the currently approved Railway origin is the authoritative public origin, a
> preparatory deployment MUST NOT cause the application to publicly claim the future domain.

A preparatory deployment is **not** safe merely because DNS does not yet resolve. The deployed
code runs on the **existing Railway host immediately**, so a naive "prepare the values early"
deployment would publish the future domain to real traffic before the domain is activated —
for example `public/robots.txt` advertising a future-domain sitemap, `src/lib/legal-docs.ts`
presenting the future domain as the company website, or canonical/`og:url`/JSON-LD output
switching origin. An earlier revision of this document claimed such values would be "inert
while the domain does not resolve". **That claim was false and has been removed.**

Until activation, none of the following may point at the future domain:

- legal website field
- `robots.txt` `Sitemap:` target
- canonical URLs
- `og:url`
- JSON-LD origin
- sitemap authority
- branded email-domain claims

Approving or owning a web domain still does **not** authorize branded email
(`FD-CM-PUBLIC-CONTACT-001` remains in force until separately replaced).

### Phase A — Preparation (no public-domain change)

1. Exact domain approved, owned/controlled, custody classified; recorded in a Founder decision.
2. **Freshly re-observe runtime** (production and staging serving commits, health) — the
   current serving commit is UNKNOWN until re-observed.
3. Record current `main` exact SHA; confirm CI green on it.
4. **Decide the deterministic canonical architecture.** `siteOrigin()` currently prefers the
   browser origin, so `CORNERMEX_PUBLIC_APPLICATION_URL` alone does not produce deterministic
   canonical output across SSR and client navigation (§2, preflight P2). CM-COM-2B1 must select
   and review the mechanism that flips public-domain authority coherently. **CM-COM-2B0 does
   not specify that mechanism and does not implement it.**
5. Prepare the exact-domain-capable **code delta** under the selected architecture.
6. Independent review of that delta; Founder Ready/merge gates satisfied; merge to `main`.
7. **Add the new origin to the Supabase Auth redirect allow-list before the new host can
   receive user traffic** (platform write — explicit authorization). `redirectTo` derives from
   the browser origin, so a later update would break sign-in the moment the host resolves. Keep
   the Railway origin allow-listed for rollback.
8. A pre-cutover deployment is **optional** and permitted **only if it is activation-inert** by
   the criteria above. If the selected architecture cannot guarantee inertness, do not deploy
   in Phase A — carry the delta into Phase B instead.

### Phase B — Activation (under explicit Founder authorization)

9. Execute the Railway / domain / DNS / TLS operations.
10. Switch public-domain authority **coherently**, using the architecture selected in
    CM-COM-2B1. The legal website field, canonical metadata, robots target and related
    public-domain outputs become active **only when the domain is actually being activated** —
    not earlier.
11. Validate **OAuth** end-to-end via `/auth/callback` on the new origin.
12. Validate **SSR** metadata (initial response).
13. Validate **client-navigation** metadata (after in-app navigation) — a different origin
    source is involved (§2).
14. Validate **sitemap and robots** coherence with canonical output.
15. Validate TLS, apex/`www` behaviour, and public routes (`/`, `/shop`, `/b2b`, `/about`,
    `/contact`, `/delivery`, `/returns`, `/privacy`, `/terms`, `/legal`; `/shipping` →
    `/delivery`).
16. **Founder browser acceptance** on desktop and mobile.

### Rollback

Rollback remains **dual-layer**: platform state **and** deployed source / public-authority
state. Reverting only one layer is not an acceptable end state.

Prohibited final states:

- new-domain canonical metadata served while public traffic is on the Railway host;
- Railway canonical metadata served while public traffic is on the new domain.

Any transitional inconsistency during the switch must be **explicitly bounded and validated**
in CM-COM-2B1, not discovered afterwards.

_Platform layer_

- DNS reversal: restore prior records; TTL is the practical rollback latency.
- Revert any platform variable changed for the cutover.
- Leave the new origin allow-listed in Supabase Auth (harmless) and confirm the Railway origin
  is still allow-listed.

_Source / public-authority layer_

- Revert the exact-domain delta via a reviewed revert and deploy it under the same separate
  deployment authorization.
- Re-validate that canonical metadata, sitemap and robots are coherent on the rollback host.

### Railway after cutover — two different things

Distinguish these; they are not the same decision:

| Concern                                                                                                   | Status                             |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Technical rollback access** — Railway remains reachable and deployable as the rollback target           | **Required**, preserved throughout |
| **Public SEO / canonical authority** — whether Railway keeps serving as a competing public canonical host | **Open decision for CM-COM-2B1**   |

The Railway host is **not** required to remain a competing public canonical host after cutover.
CM-COM-2B1 chooses between redirecting it, keeping it directly open, or another
evidence-backed approach — that decision is deliberately left open here.

### Not authorized by a cutover

A domain cutover authorizes **no** commercial capability: checkout, payments, bank transfer,
COD, external email, external messaging, A3.2b, catalog population and inventory all remain
separately gated.

### Open preflight questions (must be answered in CM-COM-2B1, not assumed)

- **P1 — Does route metadata recompute on client-side navigation?** `siteOrigin()` prefers
  `window.location.origin` whenever `window` exists (§2). Whether a given canonical/`og:url`
  tag is _recomputed_ in the browser depends on when the router evaluates route `head()`. This
  was **not** determined in CM-COM-2B0 and must be measured on a real deployment before
  cutover. Recorded as UNKNOWN rather than assumed.
- **P2 — Is `CORNERMEX_PUBLIC_APPLICATION_URL` a deterministic canonical origin?** No, not on
  its own: it is only consulted when `window` is undefined, so it governs SSR output but is
  bypassed in the browser. Deterministic canonical output requires a reviewed source change,
  which is the Phase A step 4 architecture decision.
- **P3 — What happens to the Railway host after cutover?** Redirect, keep open, or another
  approach — see the table above. Decide before activation.

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
