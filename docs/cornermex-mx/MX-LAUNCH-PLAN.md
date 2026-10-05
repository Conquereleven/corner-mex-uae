# CornerMex MX — launch plan

Branch `feat/cornermex-mx` → PR #83 → base `mx/main`. Isolated from `main`
(UAE production). Not merged. Deployed to the Mexico staging service with
checkout off. See `BRANCHING.md`.

## Founder decisions (2026-10-05)

| Decision | Applied |
| --- | --- |
| No further UAE ecommerce | UAE checkout switched off in production; UAE entry points inert in Mexico builds (`DEFERRED-UAE.md`) |
| New Supabase project for Mexico | `cornermex-mx` (`bdknutgpbflenzefussq`) created, bootstrapped and verified (`DATABASE-BOOTSTRAP.md`) |
| UAE Supabase project deleted (2026-10-04) | Nothing depends on it; its ref stays on the deny-list and CornerOps was added (`DEFERRED-UAE.md`) |
| Cash on delivery off; never national | Off by default; when enabled, local delivery only (`PAYMENTS.md`) |
| Launch payments: Mercado Pago, Clip | Both adapters built to `SCAFFOLDED` |
| Push the branch, open a PR, do not merge to `main` | PR #83 against `mx/main` |
| Launch assortment of 50–75 SKUs, not 195 | Launch gate built; nothing copied (`CATALOG-MIGRATION.md`) |

## Infrastructure (2026-10-05)

| | State |
| --- | --- |
| Railway project `CornerMex MX`, service `corner-mex-mx` | **Created.** Separate from the UAE project. Checkout, real payments and real shipping purchase off; every provider disabled |
| Mexico Supabase project | **Created and bootstrapped.** 26 hash-verified migrations, identity MX/MXN, RLS verified, 14/14 behavioural checks, six categories seeded, no other data |
| Database ↔ Railway | URL, publishable key and declared project ref set. The secret (service-role) key is a Founder copy-paste |
| PR #83 → `mx/main` | Ready for review. Merging is left to the Founder: an automated merge was refused by a review safeguard |
| CI on PR #83 | `type-and-runtime` and `schema-authority` pass. `contract-and-migration` and `merged-tree-verification` fail on `PROGRAM_STATE_EVIDENCE_STALE`, a UAE governance evidence file that expired on 2026-09-19 and fails PR #81 the same way |

## Sprint status

| Sprint | Scope | Status |
| --- | --- | --- |
| MX-0 | Audit, market config, UAE out of the storefront, address model, catalogue classification | **Done** |
| MX-1 | Shipping provider layer, Skydropx and Solo Envíos adapters, quote engine | **Done to `SCAFFOLDED`** |
| MX-2 | Payment provider layer, Mercado Pago, Clip, state machine, Mexico schema, database isolation | **Done to `SCAFFOLDED`** |
| MX-3 | Run it for real: sandbox calls, label purchase after payment, tracking, shipping webhooks | Blocked on provider credentials only |
| MX-4 | B2B price tiers, procurement and launch-assortment admin screens, remaining back-office labels | `PLANNED` (schema built) |
| MX-5 | Production credentials, real catalogue, controlled launch | `PLANNED` |

## Integration status

| Integration | Level | What moves it forward |
| --- | --- | --- |
| Skydropx | `SCAFFOLDED` | Sandbox Client ID + Secret |
| Solo Envíos | `SCAFFOLDED` | Sandbox Client ID + Secret |
| Mercado Pago | `SCAFFOLDED` | Test Access Token, Public Key, webhook secret |
| Clip | `SCAFFOLDED` | A verified Clip account — its redirected checkout has no sandbox |

Nothing is `SANDBOX`, `CONNECTED` or `LIVE`. No request has been sent to any of
the four providers.

## Launch gate

Checkout stays inert until every row is true. Rows 1–6 are enforced in code
(`evaluateMxCheckout`, the Mexico migration and the Supabase client guards).

| # | Gate | Owner | State |
| --- | --- | --- | --- |
| 1 | Deployment declares `CORNERMEX_MARKET=MX` and its Mexico Supabase project | Engineering | **Done** |
| 2 | Checkout execution flag on | Founder | Off |
| 3 | Quote-signing secret set | Engineering | **Set** on the Mexico service |
| 4 | A shipping source: carrier credentials + origin address, or manual rules with real prices | Founder | None |
| 5 | A payment provider enabled and configured | Founder | None |
| 6 | Mexico legal documents published (enforced in production) | Founder + counsel | Not written |
| 7 | Mexico Supabase project created and bootstrapped | Founder + engineering | **Done**; service-role key and auth settings pending |
| 8 | Seller entity, RFC, fiscal address | Founder + accountant | Unknown |
| 9 | Tax treatment of catalogue prices; CFDI flow and invoicing provider | Accountant | Undetermined |
| 10 | Launch assortment: 50–75 SKUs `ACTIVE` with supplier, cost, price, weight, dimensions | Founder | Not started |
| 11 | Public domain and `CORNERMEX_PUBLIC_APPLICATION_URL` | Founder | Undecided |
| 12 | Each provider verified in sandbox, then in production | Engineering | Blocked on credentials |
| 13 | Customer email sending | Engineering | Off |

## Not done, deliberately

Production payments are not activated. No shipping label is purchased — the
label functions exist and are tested but are not wired to run. Nothing is
launched publicly. No AED price, UAE order or UAE customer is copied. National
cash on delivery cannot be enabled. Nothing is merged into `main`.

## Legal / tax boundary

No Mexican legal or tax conclusion is made in code. `ACTIVE_MARKET.legal` is
`null` (no seller line is shown) and `ACTIVE_MARKET.tax.priceModel` is
`UNDETERMINED` (no tax line, nothing added). The policy pages describe how the
site works and state no legal fact. Needed from the Founder / accountant: seller
entity, RFC, fiscal address, whether prices include tax, CFDI flow, invoicing
provider.

## Founder actions

1. **Copy the Mexico secret key into Railway.** Supabase → project
   `cornermex-mx` → Project Settings → API Keys → *Secret keys* → copy. Railway →
   project `CornerMex MX` → service `corner-mex-mx` → Variables → new variable
   `SUPABASE_SERVICE_ROLE_KEY` → paste → Deploy. Never paste it into chat or a
   file.
1a. **Supabase auth settings** for `cornermex-mx`: Site URL and redirect
   allow-list, Google provider, a media bucket (`DATABASE-BOOTSTRAP.md`).
1b. **Merge PR #83** into `mx/main` (base must stay `mx/main`).
2. **Open provider accounts and create credentials:**
   - Mercado Pago developer application → test Access Token and Public Key, and
     the webhook secret.
   - Skydropx → sandbox API credentials (Conexiones → API).
   - Solo Envíos → sandbox API credentials (Integraciones → API); complete account
     verification.
   - Clip → identity-verified account and online-store credentials.
3. ~~Create a Railway project/service for Mexico~~ — done.
4. **Supply the ship-from address** of the Tecámac stock point: contact name,
   10-digit phone, email, street, exterior number, interior number (if any),
   colonia, municipio, state, postal code, and a short reference (optional).
5. **Fill in the launch sheet** (`LAUNCH-CATALOG.md`): keep 50–75 rows of
   `catalog/launch-assortment-candidates.csv` and complete supplier, cost,
   prices, weight, dimensions, stock, case pack, MOQ and lead time.
6. **Legal and tax:** seller entity, RFC, tax treatment, legal documents.
7. **Close PR #81 and PR #82** as superseded when convenient.

## Credentials needed

Put them in the deployment's secret store — never in chat, never in the
repository.

| Integration | Variables |
| --- | --- |
| Mexico Supabase | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `CORNERMEX_MX_SUPABASE_PROJECT_REF` |
| Mercado Pago | `MERCADO_PAGO_ACCESS_TOKEN` (`TEST-…`), `MERCADO_PAGO_PUBLIC_KEY` (`TEST-…`), `MERCADO_PAGO_WEBHOOK_SECRET` |
| Clip | `CLIP_API_KEY`, `CLIP_API_SECRET` (`CLIP_WEBHOOK_SECRET` is already generated and set) |
| Skydropx | `SKYDROPX_CLIENT_ID`, `SKYDROPX_CLIENT_SECRET` |
| Solo Envíos | `SOLO_ENVIOS_CLIENT_ID`, `SOLO_ENVIOS_CLIENT_SECRET` |
| CornerMex | `CORNERMEX_QUOTE_SIGNING_SECRET` — already generated and set |

Credential search (names only, values never read): the local `.env`, the shell
environment, and every Railway service in both projects. No Mercado Pago, Clip,
Skydropx or Solo Envíos credential exists anywhere reachable. There is no
authenticated provider tooling available from here, so account creation and
credential generation need the Founder.

## Next

1. After PR #83 is merged: repoint the Railway service from
   `feat/cornermex-mx` to `mx/main` and verify the deployment.
2. With sandbox credentials: run each adapter against its sandbox, correct
   whatever real responses differ on, and move it to `SANDBOX`.
4. MX-3: wire label purchase after confirmed payment, shipping webhooks, tracking
   on the order page.
5. MX-4: admin screens for the launch assortment and suppliers; B2B price tiers.
6. Spanish for the remaining account sub-pages.
