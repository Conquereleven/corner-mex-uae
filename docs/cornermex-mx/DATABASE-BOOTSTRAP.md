# Mexico database bootstrap

**Decision (Founder, 2026-10-05):** CornerMex Mexico uses a **new Supabase
project**. Nothing was re-priced in place.

**Status: `CONNECTED` (database built and verified, 2026-10-05).**

| | |
| --- | --- |
| Project | `cornermex-mx` |
| Ref | `bdknutgpbflenzefussq` |
| Region | `us-east-1` |
| Plan | Free (accepted for the first 1–2 weeks) |
| Identity | `cm_market_identity_v1()` → `{"market":"MX","currency":"MXN"}` |
| Contents | Schema + six categories. No product, price, order, customer or supplier |

**The UAE Supabase instance no longer exists.** The Founder deleted
`wlrfknmrhowldygmvtvn` on 2026-10-04 to free the project slot. UAE code,
migrations and evidence stay in Git; nothing in the Mexico runtime, migration
path, validation or tooling reads from it, and nothing may be made to depend on
it. `cornerops-ai` (`nhxpujypqxbjiqqddxqt`) is a separate product and is never
touched from this repository.

## Principle

Reuse the schema, not the data.

```
new empty project
   ├─ 1. canonical migrations   supabase/migrations/*.sql        (25 files, reused as is)
   ├─ 2. Mexico migrations      supabase/mx/migrations/*.sql     (Mexico only)
   └─ 3. reference seed         categories only
```

The Mexico migrations live in their own directory so the canonical replay — the
one the UAE database shares — never picks them up, and the first Mexico
migration refuses any database that already holds a catalogue or an order
(`MX_BOOTSTRAP_REFUSES_EXISTING_CATALOGUE`, `…_NON_EMPTY_DATABASE`). It cannot be
applied to a database that is already in use by mistake.

## Classification

### REUSE_SCHEMA — replayed unchanged

| Area | Objects |
| --- | --- |
| Identity and roles | `profiles`, `user_roles`, `commerce_private.is_admin`, admin boundary |
| Catalogue | `categories`, `products`, `product_translations`, `product_images`, `product_variants` |
| Inventory | `inventory`, `inventory_movements`, `commerce_private.inventory_policies` |
| Orders | `orders`, `order_items`, `place_cod_order_v2`, `cm_create_cod_order_v2` (idempotent, guest-capable) |
| Order lifecycle | `admin_transition_order_lifecycle_v1`, `cm_release_order_stock_v1` |
| Guest checkout | `guest_order_access`, `guest_checkout_operations`, tracking and claim functions |
| Notifications | canonical notifications |
| B2B | lead pipeline, quote drafts, anti-abuse, customer accounts, account prices, saved lists, portal |
| Security | RLS policies, private schema, public read boundary |

Money columns are named `*_aed`. In this database they hold MXN
(`MARKET-CONFIG.md`, "Stored amounts").

### REBUILD_FOR_MX — new in `supabase/mx/migrations`

| Object | Purpose |
| --- | --- |
| `commerce_private.market_identity`, `cm_market_identity_v1()` | The database states it is Mexico / MXN |
| `variant_launch_profiles`, `cm_mx_set_launch_status_v1`, launch gate trigger | Launch assortment |
| `suppliers`, `variant_suppliers` | Multi-supplier procurement |
| `mx_payment_attempts`, `cm_mx_*_payment_*` | Provider-neutral payments |
| `integration_webhook_events`, claim / complete functions | Replay protection |
| `shipments`, `shipment_events`, `cm_mx_reserve_label_v1` | One label per order, after payment |
| `cm_mx_create_order_v1` | Canonical order transaction + launch gate + payment method |
| `orders.payment_method` check | Adds `mercado_pago`, `clip` |
| `b2b_customer_accounts.currency_code` | `AED` → `MXN` |

Replayed but **inactive** in Mexico (kept so the canonical replay stays
identical): the Stripe payment functions and gates, the Zoho invoice projection,
the Intermex purchase-order automation.

### SEED_REFERENCE_DATA

Only data with no price, no customer and no supplier in it:

- the category taxonomy (slugs and Spanish names);
- nothing else.

Suppliers, costs, prices, stock and the launch assortment are **entered for
Mexico**, not seeded from anywhere.

### DO_NOT_COPY

| Data | Why |
| --- | --- |
| Products, variants, prices | AED prices from the UAE supplier's storefront |
| Inventory and movements | UAE stock |
| Orders, order items, payments | UAE customers and history |
| Auth users, profiles, addresses | UAE customers |
| B2B leads, accounts, account prices | UAE prospects, AED |
| Coupons, reviews, notifications, catalogue events | UAE activity |
| Zoho / Stripe / PO-automation state | UAE integrations |

`docs/cornermex-mx/catalog/catalog-snapshot.json` is a classification input. No
loader for it exists, and a test fails if one is added.

## What was done

Pre-flight, before the first statement: the target ref is
`bdknutgpbflenzefussq`; it is not CornerOps and not a UAE ref; it held no
`public` table, no migration and no auth user; the bootstrap market is MX and
the currency MXN.

1. **Prelude** — `supabase/mx/bootstrap/00_platform_prelude.sql` (Supabase
   migration `cm_mx_0_platform_prelude`): the one platform function the first
   canonical migration expects, the `http` extension, and a temporary runner.
2. **Replay** — the 25 canonical files in `supabase/migrations/` and then
   `supabase/mx/migrations/20261005090000_cm_mx_1_market_foundation.sql`, in
   order. The database has no inbound path for a 290 kB SQL payload from this
   tooling and no database password was ever handled, so the runner fetched each
   file from this public repository at commit
   `ad0b2e7fa41d6afbc374301b9636969430b51283`, **refused it unless its SHA-256
   matched the value computed from the local checkout**, executed it, and
   recorded it. 26 files, 293,883 bytes. The record is
   `cm_mx_bootstrap.applied` (RLS forced, no role granted).
3. **Verify** — structure and behaviour:
   - identity MX / MXN
   - 22 `public` tables and 34 `commerce_private` tables, RLS enabled on all
   - no `commerce_private` table readable by `anon` or `authenticated`
   - RLS forced on the 8 Mexico tables; the 13 `cm_mx_*` functions executable by
     `service_role` only
   - 37 `public` policies
   - a 14-check behavioural run inside a rolled-back transaction: order creation
     with server-side prices, stock reservation, launch gate, payment attempt
     idempotency, exactly-once webhook claim, payment state transitions, label
     reservation uniqueness, shipment events — 14/14
   - zero rows in `products`, `orders`, `auth.users` afterwards
4. **Finalize** — `supabase/mx/bootstrap/02_finalize.sql` (migration
   `cm_mx_2_bootstrap_finalize`): six categories seeded, runner dropped.
5. **Types** — `src/integrations/supabase/types.mx.ts`, generated from the
   project and pinned by `contracts/cornermex-mx-supabase-types-v1.json`. The
   Supabase clients are typed from it. `src/integrations/supabase/types.ts` and
   its fingerprint contract describe the deleted UAE project and are kept
   unchanged as history, because the validators that pin them are part of the
   repository's governance record.

Supabase's security advisor after the bootstrap reports two classes, both
inherited from the canonical schema and both intended: tables with RLS and no
policy (the private tables are reached only through `SECURITY DEFINER`
functions), and twelve admin/B2B `SECURITY DEFINER` functions executable by
signed-in users (each checks the caller's role inside).

The same sequence runs in CI and locally against a disposable PostgreSQL:
`npm run test:cornermex-mx:sql` (68 assertions).

## Still to do in the Supabase dashboard

These are settings, not schema, and the tooling used here cannot write them:

- **Auth → URL configuration:** Site URL = the Mexico public URL; redirect
  allow-list `<public URL>/auth/callback`.
- **Auth → Providers → Google:** a Mexico OAuth client, published.
- **Storage:** a public bucket for product media; upload policy admin-only.
- **First admin:** after the Founder signs up once, insert that user id into
  `user_roles` with `admin`.

## Guards against the wrong database

| Guard | Where | Behaviour |
| --- | --- | --- |
| Market declared | `CORNERMEX_MARKET` must be `MX` | Otherwise every server client throws |
| Declared project | `CORNERMEX_MX_SUPABASE_PROJECT_REF` must equal the ref in `SUPABASE_URL` and `VITE_SUPABASE_URL` | Mismatch throws |
| Foreign projects refused by ref | `wlrfknmrhowldygmvtvn` (UAE, deleted), `ywyiejqnbyzjfatojvkh` (UAE legacy), `nhxpujypqxbjiqqddxqt` (CornerOps) | Throws on the server and in the browser bundle |
| Database identity | `cm_market_identity_v1()` must answer MX / MXN before any price is read or order placed | No other project has that function |
| Readiness | `/api/ready` returns 503 `target: "refused"` without touching the database |
| Checkout | `evaluateMxCheckout` lists `market_database:*` reasons |
| Migration | The Mexico migration refuses a non-empty database |

The deny-list keeps the deleted UAE ref on purpose. Deleting the instance did
not make the guard unnecessary: a stale variable must be refused with a named
reason rather than fail as a DNS error, and CornerOps — which is live — was added
to the list when the UAE project went away.

## Environment separation

| | UAE (deferred) | Mexico |
| --- | --- | --- |
| Git branch | `main` | `mx/main` (`BRANCHING.md`) |
| Hosting | Railway project `CornerMex UAE`, service `corner-mex-uae` | Railway project `CornerMex MX`, service `corner-mex-mx` |
| Supabase | none — instance deleted 2026-10-04 | `bdknutgpbflenzefussq` |
| Checkout | Off | Off until the launch gate is met |

Required Mexico variables: `CORNERMEX_MARKET=MX`,
`CORNERMEX_MX_SUPABASE_PROJECT_REF=bdknutgpbflenzefussq`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `CORNERMEX_PUBLIC_APPLICATION_URL`,
`CORNERMEX_APPLICATION_ENV`, plus the checkout, shipping and payment variables in
`MARKET-CONFIG.md`. No UAE variable is reused.

The UAE Railway service still runs the `main` build with checkout off. Its
database is gone, so its catalogue pages cannot load data. Whether to stop that
service is a Founder decision; it is not touched from the Mexico work.

The organisation that owns the project is named after the UAE entity (RodMor
TradeCo LLC). Moving the project to an organisation owned by the Mexican entity
is a transfer Supabase supports later.
