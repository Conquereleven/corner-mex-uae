# CornerMex UAE Commercial Roadmap

This roadmap prioritizes visible commercial progress. It records direction only and does not authorize Railway, Supabase, DNS, payment, checkout, marketplace, inventory, messaging, migration, or other production writes.

## Current baseline

- Production frontend is live and healthy.
- Production auto-deploy is disabled.
- CM-COM-3A commercial-active (Cash on Delivery) is activated and accepted.
- CM-COM-3A.1 is **production accepted / complete**: Founder COD Acceptance Order #2 proved atomic stock/QOH consistency, exact movement cardinality and zero global drift.
- CM-COM-4A is the **current repository implementation sprint** for post-order customer and admin lifecycle foundations. It is not activated or deployed.
- All other commercial execution capabilities (marketplace, seller auth/payouts, commissions, external email/messaging, real payment execution) remain disabled.
- Staging is the required proving ground for storefront and conversion changes.

## CM-COM-1 — Storefront Conversion Foundation

### Goal

Turn the live technical frontend into a polished, product-led storefront that is ready for catalog discovery and controlled commercial testing.

### Desert Glass v1

Adopt a CornerMex-specific Liquid Glass-inspired visual system, officially named `Desert Glass v1`.

Use glass selectively for the interaction layer:

- floating header and primary navigation;
- search;
- category and filter controls;
- cart trigger and cart drawer shell;
- language and emirate selectors;
- mobile bottom navigation;
- modals, overlays and quick actions;
- lightweight promotional badges.

Keep the commerce content layer solid and highly legible:

- product cards;
- prices;
- descriptions;
- ingredients and allergen information;
- quantity controls;
- future checkout and B2B tables.

### Visual direction

- warm ivory base rather than generic blue glass;
- restrained cactus green, chile red and amber reflections;
- warm translucent whites;
- subtle one-pixel highlights and soft depth;
- rounded capsules and panels;
- minimal liquid motion;
- colorful Mexican product photography as the visual anchor.

### Implementation constraints

- Implement and review in staging first.
- No WebGL or heavy shader dependency for v1.
- Provide a solid-background fallback when backdrop blur is unavailable.
- Respect reduced-motion preferences.
- Preserve keyboard navigation, visible focus and accessible contrast.
- Do not place translucent effects behind critical price, ingredient or checkout copy.
- Do not materially degrade mobile loading or interaction responsiveness.

### Acceptance criteria

- Header, search, category controls, cart shell and mobile navigation use the approved Desert Glass system.
- Product cards and critical commerce information remain solid and easy to scan.
- Desktop and mobile navigation remain fully usable.
- Reduced-motion and no-blur fallbacks work.
- Staging visual review is approved before any production release.
- Commercial capability flags remain disabled throughout this sprint.

### Parallel commercial work

- expose the approved initial catalog in read-only storefront views;
- establish categories and product discovery;
- validate AED pricing presentation;
- prepare trust, delivery and UAE coverage messaging;
- define the first controlled order path without activating it.

## CM-COM-2 — Domain and Trust Layer

Split into a completed trust half and a blocked domain half.

### CM-COM-2A — Trust Architecture · COMPLETE / MERGED

- company, delivery, returns, privacy, terms and contact surfaces — delivered;
- UAE-focused trust signals and emirate-based delivery coverage — delivered;
- merged as PR #23, merge commit `acb1723095471786e904825042c1b9745f120504`, reviewed head
  `f0dfbb71a8978583c78aed0181078aa25b36f8f7`, Founder visual acceptance approved
  (desktop + mobile, no observations);
- merged to main only — **not deployed**; production deployment remains separately gated.

### CM-COM-2B0 — Domain Readiness · COMPLETE / MERGED

- domain approval contract, URL authority inventory and CM-COM-2B1 cutover runbook;
- canonical program-document reconciliation;
- **no** domain, DNS, Railway or deployment action. See `CM-COM-2B0_DOMAIN_READINESS.md`;
- merged as PR #24, merge commit `af822ba00866ccd75a8a0cf4431570f044317ad7`, reviewed head
  `92845d3d903d8843679db6cd68fe3a9ebb279534`;
- merged to main only — **not deployed**.

### CM-COM-2B1 — Domain Cutover · ON HOLD

On hold until an approved, owned domain exists **and** the Founder authorizes it.
`cornermex.ae` is **not purchased and not operational**, so no domain is currently approved.

- connect the approved CornerMex domain;
- configure DNS and TLS under explicit authorization;
- preserve the Railway origin as the rollback route during cutover.

## CM-COM-3A — Commercial Active MVP (Cash on Delivery) · ACTIVATED / ACCEPTED

Runs **ahead of** `CM-COM-2B1` under explicit Founder authorization, because revenue readiness
does not depend on a custom domain.

- one bounded order path: cash on delivery, single merchant, AED only;
- server-authoritative money: per-emirate shipping, 5% VAT and a Founder-attested TRN;
- transactional COD order function **applied**, catalog **loaded**, and COD checkout **activated**
  under Founder authorization (see `CM-COM-3A_ACTIVATION_RUNBOOK.md`);
- Intermex UAE public catalog ingestion (read-only) and the executed activation plan;
- the first Founder COD acceptance order exposed an inventory consistency defect; the corrected
  function subsequently passed Founder Acceptance Order #2 and CM-COM-3A is accepted.

### CM-COM-3A.1 — Inventory Consistency Hotfix · PRODUCTION ACCEPTED / COMPLETE

- corrected `place_cod_order_v1` decrements `product_variants.stock` **and**
  `inventory.quantity_on_hand` atomically, with exactly one `sale` movement, failing closed on
  missing/insufficient/drifted inventory;
- delivered and activated as a new forward migration without rewriting applied history;
- Founder COD Acceptance Order #2 proved atomic stock/QOH decrement, one exact sale movement and
  zero global drift. See `CM-COM-3A1_HOTFIX_RUNBOOK.md`.

## CM-COM-3 — Controlled Order Intake

- choose the first order mechanism: controlled checkout, order request or assisted WhatsApp flow;
- activate only one bounded path;
- keep inventory mutation and external automation disabled until separately approved;
- run internal and founder-observed test orders before public promotion.

## CM-COM-4 — Payments and Fulfilment

- activate approved payment methods one at a time;
- validate AED totals, tax, shipping and payment states;
- connect the selected fulfilment workflow;
- add order notifications and reconciliation only after successful controlled tests.

### CM-COM-4A — Post-Order Lifecycle Foundation · CURRENT IMPLEMENTATION SPRINT

- canonical customer order history and own-order detail;
- canonical order and COD payment state machines;
- admin-authorized, allowlisted and row-locked transitions;
- append-only lifecycle audit trail;
- fail-closed master-dashboard controls;
- repository and pending migration only — not activated or deployed.

### Transactional Order Confirmation Email · DEFERRED / NOT CURRENT PRIORITY

Deferred debt, recorded here so it is not lost. **Not** part of the CM-COM-4A implementation and
not started.

Later scope (for a future sprint):

- customer order-confirmation email after a successfully committed order;
- COD-aware content: order number, item summary, AED totals, shipping emirate and rate,
  payment state, delivery expectations, and company identity / TRN as legally appropriate;
- provider selection and configuration, idempotency / duplicate-send protection,
  delivery/failure observability, and a resend / manual recovery path.

Hard future contract: **email failure must never rollback or invalidate a committed order.**

Not now: no email provider is chosen, no SMTP/provider credentials are configured, no external
email is sent, no email transport is implemented, no email secrets are added, and notifications
are not activated. This item is roadmap-only.

## CM-COM-5 — B2B and Growth

- add case pricing, quantity breaks and quote requests;
- create restaurant, grocery and reseller landing paths;
- add lead capture and founder work queue integration;
- begin measured outreach only after catalog, fulfilment and response ownership are ready.

## Priority order

`Desert Glass + catalog visibility → domain and trust → controlled order intake → payments and fulfilment → B2B growth`

This priority order is canonical. `CM-COM-3A` moved ahead of the domain cutover **with**
explicit Founder authorization, recorded here and in `ACTIVE_SPRINT.md`. Any further reorder
requires the same explicit authorization.

### Current position

| Sprint                                        | Status                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `CM-COM-1` / `CM-COM-1A–1C`                   | delivered (storefront, Desert Glass, dual B2C/B2B commerce)                    |
| `CM-COM-2A` — Trust Architecture              | **complete / merged** (PR #23)                                                 |
| `CM-COM-2B0` — Domain Readiness               | **complete / merged** (PR #24)                                                 |
| `CM-COM-2B1` — Domain Cutover                 | **on hold** — no approved or owned domain exists                               |
| `CM-COM-3A` — Commercial Active MVP           | **activated / accepted** (PR #25) — catalog loaded and COD checkout live       |
| `CM-COM-3A.1` — Inventory Consistency Hotfix  | **production accepted / complete** — Founder Acceptance Order #2 passed        |
| `CM-COM-4A` — Post-Order Lifecycle Foundation | **current implementation sprint** — repository-only, not activated or deployed |
| `CM-COM-3` — Controlled Order Intake          | superseded in scope by CM-COM-3A; remaining items follow it                    |

COD checkout is live under Founder authorization. CM-COM-4A prepares customer order history,
own-order detail, canonical lifecycle transitions and auditability; application and production
activation remain separately gated.

### Preserved later roadmap lines

- `CM-DESIGN-2 — Anime.js Motion Language`
- `CM-DESIGN-3 — Desert Glass v2`
- `CM-B2B — Dubai/Sharjah commercial development`

CM-COM-4A does not implement or reorder these lines.
