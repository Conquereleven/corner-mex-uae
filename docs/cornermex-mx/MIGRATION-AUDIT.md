# CornerMex MX — Migration Audit

**Decision (Founder, 2026-10-04):** CornerMex does not launch commercially in the
UAE. It launches in **Mexico**. This is a market migration of the existing
platform, not a new project.

Status markers used across `docs/cornermex-mx/`:
`PLANNED` · `SCAFFOLDED` · `SANDBOX` · `CONNECTED` · `LIVE` · `DEFERRED`.
Nothing is called `LIVE` without real credentials and a verified production call.

## 1. Verified starting state (2026-10-04, after `git fetch --prune`)

| Ref | SHA | Notes |
| --- | --- | --- |
| `origin/main` | `f90134bd6084` | What production runs. Intermex-branded UAE storefront. |
| `origin/launch/cornermex-2` (PR #81) | `c3fa0baf0072` | 13 commits ahead of main, 0 behind. Open, mergeable, not merged, not deployed. |
| `origin/release/cornermex-brand-1` (PR #82) | `292686d439a7` | Brand-only subset of PR #81. Open. |

PR #81 is a strict superset of `main` and already contains Brand System 1.0, so
it — not `main` and not PR #82 — is the technological foundation.

## 2. Branch ancestry

```
origin/main f90134b
   └── origin/launch/cornermex-2 c3fa0ba   (PR #81, 13 commits)
          └── feat/cornermex-mx            (this branch)
```

`feat/cornermex-mx` was created from `origin/launch/cornermex-2` @ `c3fa0ba` with
`git switch -c feat/cornermex-mx origin/launch/cornermex-2 --no-track`.

Why this strategy:

- **PR #81 was not merged** to create the branch, so nothing UAE-specific was
  deployed and production is untouched.
- **PR #81 stays open as reference/history.** It should not be merged to `main`
  as a UAE launch. When `feat/cornermex-mx` merges, it carries PR #81's commits
  with it; PR #81 and PR #82 can then be closed as superseded.
- No rebase, no history rewrite. Migration file names and applied-migration
  history are untouched.

## 3. What PR #81 gives Mexico (reused unchanged)

| Capability | Where | Reuse |
| --- | --- | --- |
| Guest checkout, one identity per order | `20260919115000_cm2_guest_checkout_schema.sql`, `optional-auth-middleware.ts` | As is |
| Order idempotency (operation id + request fingerprint) | `20260919121000_cm2_cod_order_idempotency.sql`, `checkout-operation.ts` | As is |
| Stock release on cancellation | `20260919120000_cm2_release_stock_on_cancellation.sql` | As is |
| Canonical inventory and atomic order transaction | `place_cod_order_v2` / `cm_create_cod_order_v2` | As is — the Mexico checkout calls it |
| Secure guest tracking by capability token, account claim | `guest-order.functions.ts`, `guest-order-token.ts` | As is |
| Brand System 1.0 (Arena Beige `#D8C3A5`, Sunset Orange `#E77B30`, Black `#111111`) | `src/config/brand-tokens.ts` | As is — no rebrand |
| Domain abstraction | `site-url.ts`, `robots[.]txt.ts` | Kept; the Railway fallback host was removed |
| Payment idempotency architecture (attempts, verified-event-only transitions) | `payment-state.ts`, `20260828180000_cm_pay_stripe_1_payment_foundation.sql` | Pattern reused for Mercado Pago / Clip (MX-2) |

The key finding that makes the migration tractable: **the order transaction is
market-neutral.** It takes the address as an opaque JSON snapshot and the
shipping amount and tax rate as server-supplied parameters. No emirate, currency
or VAT rule lives in the database functions.

## 4. UAE coupling found

97 source files referenced the UAE. They fall into three groups.

**A. Active customer surfaces — migrated in this pass.** Checkout, cart, home,
shop, product, about, contact, delivery, terms, privacy, returns, legal index,
order confirmation, customer account (orders, returns, loyalty, B2B portal),
header, footer, trust bar, shop filters, B2B hero and quote form, email
templates, the English and Spanish dictionaries, brand copy and site metadata.

**B. Retired UAE modules — kept, inactive.** See `DEFERRED-UAE.md`.

**C. Back-office — money migrated, some labels left.** Admin and seller screens
now format money through `MarketConfig`. Still UAE-specific: the admin live view
(UAE map and "UAE time"), the admin legal view of the retired UAE documents, and
field labels in the seller area, which is inactive (`sellerAuthEnabled: false`).

## 5. Database facts that constrain the migration

- Money columns are named `*_aed` (`price_aed`, `subtotal_aed`, `total_aed`, …).
  They are unit-less numbers; the name is historical. See `MARKET-CONFIG.md`.
- `commerce_private.b2b_account_variant_prices.currency_code` has
  `check (currency_code = 'AED')`. B2B account pricing needs a migration before
  it can hold MXN.
- The Stripe payment functions reject any currency other than `'aed'`. Stripe is
  not the Mexico provider, so these stay as they are.
- `public.addresses` (saved addresses) has `emirate text not null`. The Mexico
  checkout does not write to it; a saved-address book for Mexico needs a
  migration.
- The canonical catalogue (195 products / 204 variants) was ingested from the
  UAE supplier's public storefront with **AED prices**. Rendering those numbers
  as pesos would be wrong by roughly a factor of five. See `CATALOG-MIGRATION.md`.
- `.env` in this clone points at the **obsolete** Supabase project
  (`ywyiejqnbyzjfatojvkh`); the canonical one is `wlrfknmrhowldygmvtvn`. Any
  local tooling must be pointed at the canonical project explicitly.

## 6. Baseline and delta

| Gate | PR #81 (`c3fa0ba`) | `feat/cornermex-mx` |
| --- | --- | --- |
| Tests | 812: 804 pass / 4 fail / 4 skipped | **936: 928 pass / 4 fail / 4 skipped** (+124 Mexico tests) |
| `tsc --noEmit` | 299 errors | **299 errors** (no new) |
| Mexico SQL contract | — | **56 assertions pass** on a clean bootstrap |
| `lint:changed` | fails | **passes** |

The 4 failures are the same four, by name, that fail on `main`. 35 existing guard
tests pinned UAE copy or the UAE checkout; each was updated to assert the Mexico
equivalent of the same rule rather than deleted.
