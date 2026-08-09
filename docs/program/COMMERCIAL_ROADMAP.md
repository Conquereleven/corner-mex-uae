# CornerMex UAE Commercial Roadmap

This roadmap prioritizes visible commercial progress. It records direction only and does not authorize Railway, Supabase, DNS, payment, checkout, marketplace, inventory, messaging, migration, or other production writes.

## Current baseline

- Production frontend is live and healthy.
- Production auto-deploy is disabled.
- All reported commercial execution capabilities remain disabled.
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

### CM-COM-2B0 — Domain Readiness · CURRENT

- domain approval contract, URL authority inventory and CM-COM-2B1 cutover runbook;
- canonical program-document reconciliation;
- **no** domain, DNS, Railway or deployment action. See `CM-COM-2B0_DOMAIN_READINESS.md`.

### CM-COM-2B1 — Domain Cutover · BLOCKED

Blocked until an approved, owned domain exists **and** the Founder authorizes it.
`cornermex.ae` is **not purchased and not operational**, so no domain is currently approved.

- connect the approved CornerMex domain;
- configure DNS and TLS under explicit authorization;
- preserve the Railway origin as the rollback route during cutover.

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

## CM-COM-5 — B2B and Growth

- add case pricing, quantity breaks and quote requests;
- create restaurant, grocery and reseller landing paths;
- add lead capture and founder work queue integration;
- begin measured outreach only after catalog, fulfilment and response ownership are ready.

## Priority order

`Desert Glass + catalog visibility → domain and trust → controlled order intake → payments and fulfilment → B2B growth`

This priority order is canonical. `CM-COM-3` must **not** move ahead of the domain and trust
layer without explicit Founder authorization.

### Current position

| Sprint                               | Status                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `CM-COM-1` / `CM-COM-1A–1C`          | delivered (storefront, Desert Glass, dual B2C/B2B commerce)                       |
| `CM-COM-2A` — Trust Architecture     | **complete / merged** (PR #23)                                                    |
| `CM-COM-2B0` — Domain Readiness      | **current sprint**                                                                |
| `CM-COM-2B1` — Domain Cutover        | **blocked** — no approved or owned domain exists                                  |
| `CM-COM-3` — Controlled Order Intake | follows completion of CM-COM-2 unless the Founder explicitly authorizes a reorder |

Production commerce execution remains safely off until separately authorized.
