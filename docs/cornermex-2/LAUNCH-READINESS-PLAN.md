# CornerMex 2.0 — Launch Readiness Plan

**Base:** `origin/main` @ `f90134bd6084` (verified by `git ls-remote`, 2026-09-19).
**Status:** planning only. No storefront, schema, legal-copy or production change is made by this document.
**Evidence rule:** every claim below was checked against `f90134b`, live production (read-only), or canonical DB2 `wlrfknmrhowldygmvtvn` (read-only `SELECT`). Nothing is inferred from older clones.

---

## Track 1 — Production verification (read-only)

| Check             | Result                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Railway service   | `corner-mex-uae` (`6702af28-…`), env `production` (`8f35b59c-…`)                                                                                |
| Live deployment   | `4cd45379-…`, **SUCCESS**, created 2026-09-15 21:09 UTC                                                                                         |
| Deployed commit   | **`f90134bd6084` = `origin/main` HEAD** (Railway metadata **and** `/api/health` `commit` agree)                                                 |
| Replicas          | 1/1 running, 0 crashed, 0 failures / 0 warnings in the last 96 h                                                                                |
| `GET /api/health` | 200 `status: ok`                                                                                                                                |
| `GET /api/ready`  | 200 `status: ready`, `target: reachable`                                                                                                        |
| Capabilities      | `checkoutEnabled: true`, **`realPaymentExecutionEnabled: false`**, **`externalEmailEnabled: false`**, marketplace/seller/commission all `false` |
| Domain            | Only `corner-mex-uae-production.up.railway.app`. **No custom domain attached.**                                                                 |
| DB2 orders        | 2 total, both COD, both `delivered` (one `paid`, one `refunded`); 0 cancelled                                                                   |
| DB2 stock drift   | 0 rows (`product_variants.stock` = `inventory.quantity_on_hand` everywhere)                                                                     |

**Meaning:** production is current and healthy. **COD is live; card is not** (real payment execution off). **No customer email is sent** (external email off), so "existing customer notification behaviour" today is in-app only.

`docs/program/DEPLOYMENT_REGISTRY.json` (observed 2026-09-12) still names `9766762` as current — it is stale, not production.

---

## Track 2 — CornerMex 2.0 rebrand impact map

**Architecture fact that makes this tractable.** Issue #70 defined the design: _"migrate Intermex UAE … onto the CornerMex platform … turning it into a reusable brand layer over the CornerMex commerce/operations core."_ Brand is parameterised: `src/config/brand.ts` exports `BrandConfig` + `INTERMEX_BRAND`, and `SiteLayout` / `BrandLogo` accept a `brand` prop. A full CornerMex kit already exists in `public/brand-kit/` (logos: horizontal, stacked, monogram, monochrome, social-avatar) and is not referenced by `src/` yet. The rebrand is primarily **a second `BrandConfig` + copy changes**, not a rewrite.

**Scale:** 762 occurrences in 103 tracked files.

### A. Safe cosmetic rename (≈47 files, ≈211 occurrences)

Public copy, `<title>`/meta/OG, header/footer, nav, product cards, account pages, B2B pages, `i18n.ts` (28), `styles.css` class/variable names (`.intermex-header`, `--intermex-cream-surface`), `brand.ts` display fields, `oauth.consent.tsx`, admin `GoLiveReadiness` title.

Safe to change **only once the legal/brand decision (Track 4) is made**, because many of these sit next to seller-of-record statements.

Two externally visible items deserve their own review even though they are code-cosmetic:

- `src/lib/external-email.server.ts:45` — sender display name `Intermex <…>`
- `src/lib/payments.functions.ts:112` — Stripe line item `Intermex order #…` (customer sees it on Stripe Checkout and receipts; the card **statement descriptor** is set in the Stripe dashboard, not in code)

**Assets:** the current logo and imagery are Intermex's official assets sourced from `intermexuae.com` (provenance in `public/brand-kit/intermex/asset-provenance.json`). Under a CornerMex brand they must be replaced by CornerMex assets, not restyled.

**Tests that intentionally enforce Intermex** and must be rewritten as part of the rebrand (they are the guard, not a bug): `tests/cm-intermex-storefront-2/public-brand-invariant.test.mjs`, `tests/cm-intermex-brand-1/brand-system.test.mjs`.

### B. Legal / seller-of-record content — do not change without decision

See Track 4 for the exact list. Files: `src/lib/legal-docs.ts` (86), `src/lib/business-identity.ts`, `src/routes/{terms,privacy,legal.index}.tsx`, `src/routes/_authenticated/admin.legal.tsx`, plus consumers of `BUSINESS_IDENTITY` (footer, checkout VAT line, bank-transfer beneficiary).

### C. Persisted identifiers — must NOT be renamed without a migration design

| Identifier                                         | Where                                                                                                                          | Why it is persisted                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `intermex-card-operation:<buyerId>` (localStorage) | `src/lib/checkout-operation.ts:5`, `src/routes/order-confirmed.tsx:30`                                                         | Card checkout idempotency. Renaming orphans any in-flight operation → the next attempt mints a new id → **possible duplicate order/charge**. |
| `intermex-checkout:<buyerId>` (Web Lock name)      | same                                                                                                                           | Cross-tab serialisation of the above. Must change atomically with the key, or two builds serialise on different locks.                       |
| `intermex-po-v1` / `"INTERMEX PO v1"`              | `src/lib/po/domain.ts:3,266`; **enforced by a DB check** in applied migration `20260914114744_intermex_po_automation_1.sql:51` | External document contract for customer purchase orders and stored `po_mapping_sets` payloads.                                               |
| Synthetic seller `slug: "cornermex"`               | `src/lib/catalog.functions.ts:188,470`                                                                                         | Slug persists in carts. (Display `name: "Intermex"` beside it is cosmetic.)                                                                  |
| `"intermex uae"` placeholder brand filter          | `src/lib/public-product-brand.ts:1`                                                                                            | Matches **product data values**; renaming changes which products show a brand. Keep.                                                         |
| Applied migration names                            | `…intermex_go_live_2_operational_boundaries`, `…intermex_po_automation_1`                                                      | Recorded in DB2's migration ledger. Immutable.                                                                                               |

**If the card keys must change later**, the safe pattern is read-both/write-new: read `cornermex-card-operation:` then fall back to `intermex-card-operation:`, write only the new key, keep the fallback for at least the card session lifetime plus a margin, then remove.

### D. Internal / dead-code / supplier references (≈38 files, ≈128 occurrences)

Test directory and script names (`tests/intermex-*`, `scripts/cm-com-3a/ingest-intermex-catalog.mjs`), npm script names (`test:intermex-*`), docs, and **supplier-relationship data** (catalog ingestion provenance, PO automation fixtures naming Intermex Pro General Trading LLC as supplier). Renaming is optional churn; supplier references are factual and should stay.

### E. Migrations / configuration (≈9 files, ≈320 occurrences)

`supabase/migrations/*` (applied, immutable), `supabase/legacy-lovable/*` (quarantined DB1 history, checksummed), `contracts/*`, `package.json` script names. **Do not edit.**

---

## Track 3 — Launch-critical checkout gaps (plans only)

### 3.1 COD idempotency

- **Current state:** the only protection is `disabled={submitting}` in `checkout.tsx`. `place_cod_order_v1` takes no operation id. A network retry, a second tab or a replayed request creates a second order.
- **User impact:** duplicate COD orders → double stock decrement, two delivery/WhatsApp confirmations, customer confusion. Combined with 3.5 below, the admin cancelling the duplicate does **not** return the stock.
- **Approach:** mirror the proven card pattern. New RPC `cm_create_cod_order_v2(p_buyer_id, p_operation_id, …)` that fingerprints the normalised request into `commerce_private.card_checkout_operations` (the key is `(buyer_id, operation_id)`; include the payment method in the fingerprint so a COD and a card attempt can never collide), raises `CHECKOUT_IDEMPOTENCY_CONFLICT` on a changed payload, and otherwise calls the unchanged `place_cod_order_v1`. Client uses the same `checkoutOperation()` helper with a **new** COD key namespace; the card key is untouched.
- **DB/schema impact:** one new function; no new table if the operations table is reused (renaming it to `checkout_operations` is optional and can come later).
- **Migration:** yes (additive, function only).
- **Risk:** low–medium; pattern already proven in production code for card.
- **Classification:** **hard blocker for a public/marketed launch.** Tolerable for the current founder-controlled soft launch (2 orders to date).

### 3.2 Coupons

- **Current state:** DB2 has **0 coupons and 0 redemptions** — no customer has ever used one on the canonical platform. Canonical checkout does not accept a coupon. `orders` has no `discount_aed` / `coupon_id` / `coupon_code`. **The live admin page `admin.coupons.tsx` is broken:** `src/lib/coupons.functions.ts` reads/writes legacy columns (`kind`, `value`, `min_subtotal_aed`, `max_uses`, `uses_count`, `max_discount_aed`) that do not exist in canonical `coupons` (`discount_type`, `discount_value`, `minimum_order_aed`, `max_redemptions`, no usage counter).
- **User impact:** no promotions possible; admins hitting the coupon page get errors.
- **Approach:** (1) point `coupons.functions.ts` at the canonical columns; (2) add nullable `orders.discount_aed`, `coupon_id`, `coupon_code`; (3) add `p_coupon_code text default null` to the v2 order functions: lock the coupon row `FOR UPDATE`, validate active/window/minimum, count `coupon_redemptions` < `max_redemptions`, compute the discount server-side, insert the redemption (unique on `coupon_id, order_id`) — all inside the order transaction, so a failed redemption fails the order and no discount is ever granted without a redemption; (4) the cart preview calls the same SQL rule in read-only mode, so rules exist once.
- **DB/schema impact:** 3 additive nullable columns, 1 unique constraint, function changes.
- **Migration:** yes.
- **Risk:** medium — money math. Needs a decided VAT treatment (UAE VAT is normally charged on the discounted consideration) and **the Zoho invoice projection must carry the discount line**, or invoices will not reconcile with orders.
- **Classification:** **can ship shortly after launch** (nothing live regresses — there are no coupons). **Pre-launch:** fix or hide the broken admin page.

### 3.3 Delivery SLA

- **Current state:** the Terms already promise _"express 1–2 business days, standard UAE 2–5 business days, remote areas +1–3 business days"_ (`legal-docs.ts:155`). Checkout, confirmation and the delivery page show **no** delivery window. The commercial config has per-emirate shipping rates but no windows.
- **User impact:** the customer cannot see the delivery commitment the Terms make; no record of what was promised at purchase time.
- **Approach, two phases:** (a) add a per-emirate delivery-window map to the commercial config (same shape as `CORNERMEX_COD_SHIPPING_RATES_JSON`) and display it in checkout, the confirmation page and the order view — **values must match the Terms**; (b) snapshot the window onto the order (`sla_min_days`, `sla_max_days`, nullable) through the v2 order function so the promise is auditable.
- **DB/schema impact:** (a) none; (b) 2 nullable columns + function parameter.
- **Migration:** (a) no; (b) yes.
- **Risk:** low technically; the legal risk is displaying windows that differ from the Terms.
- **Classification:** (a) **pre-launch recommended**; (b) can ship after launch.

### 3.4 Stripe cancel / retry recovery

- **Current state (card is not live):** a card order is created through `place_cod_order_v1`, so **stock is decremented at order creation, before payment**. On `checkout.session.expired` the webhook sets the payment and `orders.payment_status` to `cancelled`, but **the order stays `pending` and stock is never restored**. Checkout Sessions use Stripe's default 24 h expiry. Client-side, the stored operation key survives a Stripe cancel; if the buyer then changes the cart, `checkoutOperation()` throws `CHECKOUT_OPERATION_PENDING` and the UI can only say "retry with the same details" — no way forward except completing the old order.
- **User impact:** buyers who cancel at Stripe and edit the cart are stuck; every abandoned card checkout permanently removes stock.
- **Approach:** (1) `resumeCardCheckout(operationId)` — if the order is still `pending` and unpaid, open a fresh Checkout Session for the **same** order (the attempts model already supports multiple attempts per order); (2) `abandonCardCheckout(operationId)` — cancel the order through the lifecycle function, restore stock with ledger `release` movements (see 3.5), then clear the key; (3) on `checkout.session.expired`, when no other attempt is paid, cancel and restore stock the same way; (4) set an explicit, shorter `expires_at` on sessions to bound the hold. A late payment after cancellation is already flagged (`payment_attention = 'CAPTURE_ON_CANCELLED_ORDER'`).
- **DB/schema impact:** new stock-release function, webhook function change.
- **Migration:** yes.
- **Risk:** medium–high (payment × inventory races); needs the disposable-Postgres SQL tests the repo already uses for COD.
- **Classification:** **hard blocker before enabling card.** Not a blocker for a COD-only launch.

### 3.5 Found during this audit — cancellations never restore stock

No code path adds stock back: not the admin lifecycle transition (`admin_transition_order_lifecycle_v1` only updates status and writes a lifecycle event), not the Stripe webhook, not any server function. `inventory_movements` already permits `release` and `return`, unused. **COD is live**, and COD refusals are common, so every cancelled or refused COD order will silently lower sellable stock. It fails safe (under-selling, never overselling) and has not triggered yet (0 cancelled orders).

- **Approach:** one `release_order_stock_v1(order_id)` used by admin cancellation, 3.4 and returns; idempotent per order; writes `release` ledger rows and increments both stock stores in the same locked order `place_cod_order_v1` uses.
- **Classification:** **pre-launch recommended**; it is the shared foundation for 3.1 and 3.4.

---

## Track 4 — Legal / commercial identity (inventory only — nothing rewritten)

### Who the code says the seller is

`src/lib/business-identity.ts`: `brandName: "Intermex"`, `legalEntity: "RodMor TradeCo LLC"`, Sharjah Media City free zone, trade licence `2647014.01`, bank beneficiary RodMor TradeCo LLC. Every legal page derives from this object.

**Statements that make Intermex / RodMor the seller of record:**

| Location                             | Statement                                                                                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/legal-docs.ts:84`           | "Intermex is a trading brand operated by ${LEGAL_ENTITY_NAME} …"                                                                          |
| `src/lib/legal-docs.ts:92`           | "Company legal name: ${LEGAL_ENTITY_NAME}"                                                                                                |
| `src/lib/legal-docs.ts:141`          | "Intermex is an online store operated … by ${LEGAL_ENTITY_DESCRIPTOR}. For the current MVP, Intermex acts as the seller of record …"      |
| `src/lib/legal-docs.ts:156`          | "… Intermex remains the seller of record."                                                                                                |
| `src/lib/legal-docs.ts:229`          | "Intermex is responsible for customer support, complaints, refund handling and the returns process …"                                     |
| `src/lib/legal-docs.ts:318`          | "The controller of personal data … is ${LEGAL_ENTITY_DESCRIPTOR}, operating the Intermex brand … Intermex acts as the seller of record …" |
| `src/lib/legal-docs.ts:685`          | "For the current MVP, Intermex is the seller of record …"                                                                                 |
| `src/lib/legal-docs.ts:1118`         | "… Intermex remains the seller of record for customer purchases."                                                                         |
| `src/components/site/Footer.tsx:140` | `businessIdentityLine()` → "Intermex, a trading brand of RodMor TradeCo LLC · …"                                                          |
| `src/routes/terms.tsx:34`            | "This website is operated in the UAE. ${businessIdentityLine()}"                                                                          |
| `src/routes/checkout.tsx:531`        | "RodMor TradeCo LLC — VAT TRN {config.vatTrn}"                                                                                            |
| `src/lib/payment-methods.ts:188`     | bank-transfer beneficiary defaults to RodMor TradeCo LLC                                                                                  |
| `src/config/brand.ts:41`             | **`legalName: "Intermex UAE"`** — a field named `legalName` holding a brand, contradicting the entity above                               |

### Three conflicts you need to resolve

1. **Brand name vs its own authority.** `business-identity.ts` sets `brandName: "Intermex"` and cites `FD-CM-BUSINESS-IDENTITY-001` as its authority — but that founder decision (last updated 2026-08-08) attests brand name **`CornerMex`**. The switch happened in `4d8b4ff` (2026-08-29, PR #75) with no founder-decision record. Issue #70 is your authorisation in practice, but the governed record was never updated.
2. **Two legal entities in one sales chain.** The website names **RodMor TradeCo LLC** as seller of record and shows its VAT TRN at checkout. The accounting integration targets the Zoho Books organisation of **Intermex Pro General Trading LLC** (Dubai, VAT-registered, org id 773588238), which already issues real B2B invoices (e.g. to Majid Al Futtaim Cinemas LLC, invoice 41237). If Zoho is activated for web orders as built, invoices would come from a different company than the one the website says sold the goods. **Zoho writes are off** (`ZOHO_LIVE_ACTIVATION_AUTHORIZED = false`), so nothing has been mis-issued.
3. **The site describes itself as non-transactional while taking orders.** Live pages say _"UAE commercial preview"_ (title/meta), the policies index calls the terms _"the non-transactional terms of this commercial preview"_ (`legal.index.tsx:26`), `/delivery` says _"Online order and delivery execution are not currently enabled"_, and `/returns` says _"Order execution is not currently enabled … so no website purchase …"_ — yet production has checkout on and has fulfilled 2 COD orders.

---

## Track 5 — Migration hygiene (proposals only; nothing applied)

### 5.1 Inventory-consistency hotfix has no DB ledger row

`20260810120000_place_cod_order_v1_inventory_consistency.sql` is in the repo and its function body is live in DB2 (drift check, dual decrement), but `supabase_migrations.schema_migrations` has no row for it — it was applied outside the migration tracker under `docs/program/CM-COM-3A1_HOTFIX_RUNBOOK.md`.

**Proposal:** do **not** re-run the SQL. Record it, gated by an explicit Founder production approval:

1. Read-only proof first: `pg_get_functiondef('public.place_cod_order_v1(uuid,jsonb,jsonb,numeric,numeric,jsonb)'::regprocedure)` must equal the file's function body (normalised), recorded as evidence.
2. Insert one ledger row with the file's version and name and `statements` set to the file contents, inside a transaction that first asserts the row is absent — no DDL executes.
3. Alternative if touching the ledger is unwanted: leave DB2 alone and record the out-of-band application in `contracts/canonical-active-migration-extensions-v1.json` (`productionApplied: true`, `appliedOutOfBand: true`, evidence pointer). Lower risk, but replay tooling that trusts the ledger will still see a gap.

### 5.2 `cm_mcp_db2_read_boundary` sits in the active path but is not for production

Verified: `commerce_private.mcp_grants` does **not** exist in DB2, and `docs/mcp/CM-MCP-3-DB-PROPOSAL.md` states it is "not applied to production". Because the file is in `supabase/migrations/`, any `supabase db push` would apply it.

**Proposal (repository-only, one PR):** `git mv` it to `supabase/pending-canonical/` (the existing home for merged-but-unauthorised canonical work) and, in the same change: remove its entry from `contracts/canonical-active-migration-extensions-v1.json` (the validator builds the expected active set from `activeCanonicalMigrations` plus that extension list), add it to `pendingCanonicalMigrations` in `contracts/lovable-cloud-migration-ownership-v1.json`, and add `"cm_mcp_db2_read_boundary"` to `REQUIRED_PENDING` in `scripts/supabase/validate-migration-ownership.mjs` (line 151; the count check derives from that list). The exact-set assertions stay as strict as they are. Its version (`20260822050535`) predates applied migrations, so if it is ever approved it must be re-timestamped after `20260914133036` rather than applied out of order.

### 5.3 Found during this audit — the extension contract says 7 applied migrations are unapplied

`contracts/canonical-active-migration-extensions-v1.json` marks these `productionApplied: false`, but DB2's ledger shows all applied:

| File                                         | Applied version in DB2 |
| -------------------------------------------- | ---------------------- |
| `…cm_b2b_ops_foundation_1`                   | 20260912110525         |
| `…cm_b2b_portal_1a_boundary`                 | 20260912181132         |
| `…cm_b2b_portal_1b_pricing_availability`     | 20260912181756         |
| `…cm_int_zoho_1_zero_touch_order_invoice`    | 20260912183600         |
| `…cm_pay_stripe_1_payment_foundation`        | 20260912184118         |
| `…intermex_go_live_2_operational_boundaries` | 20260912185327         |
| `…intermex_po_automation_1`                  | 20260914133036         |

`validate:migration-ownership` passes because it never compares the contract with the database. **Proposal:** update those seven entries with their real versions, and add an opt-in `--against-db` mode (read-only) that fails on any ledger ↔ contract mismatch.

---

## Also found (not in the five tracks)

- 3 pre-existing test failures are stale source-shape assertions, not defects (`cm-com-1a` ×2, `cm-com-4a` ×1).
- `validate:program-state` fails `PROGRAM_STATE_EVIDENCE_STALE` (evidence expired 2026-07-27).
- Local and CI builds need `NODE_OPTIONS=--max-old-space-size=8192`; Railway builds succeed without it.
- Dead code: legacy `placeOrder` (not in the build output), `listSellers` / `getSeller` (query a table DB2 lacks; no callers), the inert BNPL route.

---

## Launch gate (updated 2026-09-20, after the second Founder decision set)

The gate below replaces the per-track exit criteria above. Launch is allowed
when every line is GREEN, except where the line itself says a YELLOW is
acceptable.

| #   | Item                                                                                          | Status                        | Evidence / what is missing                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Legal review of the customer-facing documents                                                 | GREEN                         | FD-CM-LEGAL-REVIEW-001; nine documents are `Approved` in `src/lib/legal-docs.ts`. The seller agreement stays `Draft` because it was not in scope.                                    |
| 2   | Commercial identity (CornerMex brand, RodMor TradeCo LLC seller of record, Intermex supplier) | GREEN                         | `docs/cornermex-2/LEGAL-IDENTITY.md`; the identity is centralised, and a test fails the build if a source file hardcodes it.                                                         |
| 3   | Guest checkout with no account wall                                                           | GREEN                         | One pipeline (`place_cod_order_v2`), guest and authenticated; `tests/cm2/guest-checkout.test.mjs` and the SQL harness.                                                               |
| 4   | Guest order tracking without exposing data by order id                                        | GREEN                         | Capability token, sha256 at rest, payload carries no email or address.                                                                                                               |
| 5   | Account claim of a guest order                                                                | GREEN                         | Requires the token **and** a verified matching email; the token is retired on claim.                                                                                                 |
| 6   | COD idempotency and stock release                                                             | GREEN                         | `cm_create_cod_order_v2`, `cm_release_order_stock_v1`, concurrency and negative controls in `npm run test:cm2:sql`.                                                                  |
| 7   | Domain                                                                                        | YELLOW — acceptable           | The domain is not bought. The app derives its host at runtime, so no code change is needed at cutover; `docs/cornermex-2/DOMAIN-CUTOVER.md` is the runbook.                          |
| 8   | Zoho invoicing                                                                                | YELLOW — acceptable           | The provider refuses to issue a CornerMex customer invoice inside a supplier organisation. Invoicing stays off until the RodMor organisation exists; checkout does not depend on it. |
| 9   | Card payments                                                                                 | Intentionally OFF             | Not activated. COD only.                                                                                                                                                             |
| 10  | Google sign-in verified with a genuinely new external account                                 | **BLOCKING — Founder action** | Cannot be done from here: it needs a real Google account that has never touched this project.                                                                                        |
| 11  | Production migration applied before the app deploy                                            | **BLOCKING**                  | The three `2026091*` migrations are unapplied on DB2. They must be applied first, under the existing rollout checklist, then the app deploys.                                        |
| 12  | Program state evidence                                                                        | Expired                       | `docs/program/CURRENT_STATE.json` went stale on 2026-09-19 by its own seven-day window. It needs a fresh read-only observation; it is not a code defect.                             |

**Ordering that must be respected at release:** migrations to DB2 first, app
deploy second. The app tolerates the old schema only for authenticated COD;
guest checkout fails closed until the migration lands.
