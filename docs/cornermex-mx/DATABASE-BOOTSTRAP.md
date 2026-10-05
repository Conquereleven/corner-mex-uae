# Mexico database bootstrap

**Decision (Founder, 2026-10-05):** CornerMex Mexico uses a **new Supabase
project**. The UAE database is not re-priced in place; it stays historical and
read-only.

**Status:** plan, schema and guards are built and tested locally. The project
itself is **not created**. Creation was attempted on 2026-10-05 and refused by
Supabase: the organisation is on the free plan, which allows two active
projects per owner, and both slots are in use (`cornerops-ai` and
`corner-mex-uae`). A new project there costs $0/month; the limit is the only
obstacle. See "Founder action".

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
applied to the UAE database by mistake.

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

## Procedure

1. **Create the project** (Founder — see below). Region close to Mexico.
2. **Replay migrations** on the empty project, in order:
   `supabase/migrations/*.sql`, then `supabase/mx/migrations/*.sql`. Each file in
   its own transaction.
3. **Verify** with read-only checks:
   - `select public.cm_market_identity_v1()` → `{"market":"MX","currency":"MXN"}`
   - no row in `products`, `orders`, `auth.users`
   - every `commerce_private` table has RLS enabled and forced
   - `anon` and `authenticated` cannot execute any `cm_mx_*` function
4. **Seed** the category taxonomy.
5. **Auth configuration** (Supabase dashboard):
   - Site URL = the Mexico public URL
   - redirect allow-list: `<public URL>/auth/callback`
   - Google provider with a Mexico OAuth client, published (not "Testing")
   - email confirmations on; sender configured
6. **Storage:** a public bucket for product media; upload policy admin-only.
7. **First admin:** insert the Founder's user id into `user_roles` with `admin`.
8. **Generate types:** regenerate `src/integrations/supabase/types.ts` from the
   new project and commit it.
9. **Environment** for the Mexico deployment (below), then `/api/ready` must
   report `marketDatabase.ok: true`.

The same sequence runs in CI and locally against a disposable PostgreSQL:
`npm run test:cornermex-mx:sql` (56 assertions).

## Guards against the wrong database

| Guard | Where | Behaviour |
| --- | --- | --- |
| Market declared | `CORNERMEX_MARKET` must be `MX` | Otherwise every server client throws |
| Declared project | `CORNERMEX_MX_SUPABASE_PROJECT_REF` must equal the ref in `SUPABASE_URL` and `VITE_SUPABASE_URL` | Mismatch throws |
| UAE projects refused by ref | `wlrfknmrhowldygmvtvn`, `ywyiejqnbyzjfatojvkh` | Throws on the server and in the browser bundle |
| Database identity | `cm_market_identity_v1()` must answer MX / MXN before any price is read or order placed | The UAE database has no such function |
| Readiness | `/api/ready` returns 503 `target: "refused"` without touching the database |
| Checkout | `evaluateMxCheckout` lists `market_database:*` reasons |
| Migration | The Mexico migration refuses a non-empty database |

## Environment separation

| | UAE (historical) | Mexico |
| --- | --- | --- |
| Git branch | `main` | `mx/main` (`BRANCHING.md`) |
| Hosting | Railway project `CornerMex UAE`, service `corner-mex-uae` | A **new** Railway project/service |
| Supabase | `wlrfknmrhowldygmvtvn` | New project |
| Checkout | Off (2026-10-05) | Off until the launch gate is met |

Required Mexico variables: `CORNERMEX_MARKET=MX`,
`CORNERMEX_MX_SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`, `CORNERMEX_PUBLIC_APPLICATION_URL`,
`CORNERMEX_APPLICATION_ENV`, plus the checkout, shipping and payment variables in
`MARKET-CONFIG.md`. No UAE variable is reused.

The local `.env` in this clone still points at the obsolete UAE project; with
the guards above the app now refuses to start against it. That is intended.

## Founder action

One decision frees a project slot. Everything after it is automated.

Choose **one**:

- **A. Pause `cornerops-ai`** (Supabase dashboard → project `cornerops-ai` →
  Settings → General → *Pause project*). Free. The project's data is kept and it
  can be restored later. Only do this if nothing depends on it today.
- **B. Upgrade the organisation to Pro** (Organization → Billing → *Upgrade*).
  Removes the two-project limit. This is a paid plan; Supabase shows the price
  before you confirm.

Do **not** pause `corner-mex-uae`: it is the historical UAE database and the UAE
storefront still reads its catalogue.

Then say "slot is free". From there, without further input: the project
`cornermex-mx` is created in `us-east-1`, the canonical and Mexico migrations
are applied, the MX/MXN identity and RLS are verified, categories are seeded,
types are regenerated, and the keys are written directly into the Mexico Railway
service.

Note: the organisation is named after the UAE entity (RodMor TradeCo LLC). The
Mexico project can live there for now; moving it to an organisation owned by the
Mexican entity is a transfer Supabase supports later.
