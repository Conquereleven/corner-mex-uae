# CornerMex MX — launch plan

Branch `feat/cornermex-mx`, from PR #81 @ `c3fa0ba`. Not merged, not deployed.

## Sprint status

| Sprint | Scope | Status |
| --- | --- | --- |
| MX-0 | Audit, market config, UAE removed from active storefront, MXN / es-MX, address model, catalogue classification | **Done** |
| MX-1 | `ShippingProvider`, Skydropx and Solo Envíos adapters, quote engine, shipping checkout UI | **Done to `SCAFFOLDED`** — `SANDBOX` needs credentials |
| MX-2 | `PaymentProvider`, Mercado Pago, Clip, payment state machine | `PLANNED` — designed in `PAYMENTS.md` |
| MX-3 | End-to-end checkout: payment → order → label → tracking; shipment tables, webhook routes | `PLANNED` |
| MX-4 | B2B tiers, supplier model, admin and operations, UAE removed from back-office | `PLANNED` |
| MX-5 | Production credentials, real catalogue, real shipping and payments, controlled launch | `PLANNED` |

## Launch gate

Checkout stays inert until each of these is true. The first four are enforced in
code (`evaluateMxCheckout`); the rest are decisions and data.

| # | Gate | Owner | State |
| --- | --- | --- | --- |
| 1 | Checkout execution flag on | Founder | Off |
| 2 | Quote-signing secret set | Engineering | Not set |
| 3 | A shipping source: carrier credentials + origin address, or manual rules with real prices | Founder | None |
| 4 | A payment method enabled | Founder | None |
| 5 | Mexico legal documents published (enforced in production) | Founder + counsel | Not written |
| 6 | Mexico seller entity, RFC, fiscal address | Founder + accountant | Unknown |
| 7 | Tax treatment of catalogue prices; CFDI flow and invoicing provider | Accountant | Undetermined |
| 8 | Mexico database with MXN prices (no AED row sellable) | Founder + engineering | Not started |
| 9 | Real catalogue: suppliers, costs, MXN prices, weights | Founder | Not started |
| 10 | Public domain and `CORNERMEX_PUBLIC_APPLICATION_URL` | Founder | Undecided |
| 11 | Online payments (Mercado Pago) verified in sandbox, then production | Engineering | MX-2 |
| 12 | Customer email sending | Engineering | Off (`externalEmailEnabled: false`) |

## Legal / tax boundary

Nothing from the UAE is carried over, and no Mexican legal or tax conclusion is
made in code:

- `ACTIVE_MARKET.legal` — seller entity, RFC, fiscal address — is `null`. No
  seller line is displayed until it is filled.
- `ACTIVE_MARKET.tax.priceModel` is `UNDETERMINED`. No tax line is displayed and
  no tax is added.
- The policy pages describe how the site works and say the full documents will
  be published before sales open. They state no legal fact.

Needed from the Founder / accountant: legal seller entity, RFC, fiscal address,
whether catalogue prices include tax, whether and how CFDI is issued, and the
invoicing or accounting provider.

## Decisions waiting on the Founder

1. **UAE production.** `corner-mex-uae` still accepts cash-on-delivery orders
   under UAE terms. With the UAE launch cancelled, should that checkout be
   switched off now?
2. **Database:** new Supabase project for Mexico (recommended) or re-price in
   place.
3. **Cash on delivery in Mexico:** yes or no, and for which postal codes.
4. **Review of 56 catalogue rows** marked `REVIEW`, and confirmation of the two
   inferred `INTERMEX_PRIVATE` rows.
5. **Local delivery:** the postal-code prefixes served from Tecámac, and its
   price.
6. **PR #81 and PR #82:** close as superseded once this branch is the line.

## Credentials needed

| Integration | What | Where it goes |
| --- | --- | --- |
| Skydropx | Sandbox Client ID + Client Secret | `SKYDROPX_CLIENT_ID`, `SKYDROPX_CLIENT_SECRET` |
| Solo Envíos | Sandbox Client ID + Client Secret (account verified) | `SOLO_ENVIOS_CLIENT_ID`, `SOLO_ENVIOS_CLIENT_SECRET` |
| Mercado Pago | Test Access Token + Public Key, webhook secret | MX-2 |
| Clip | API key + secret for Redirected Checkout | MX-2 |
| Supabase (Mexico) | New project URL, publishable key, service role key | Deployment secrets |
| Quote signing | A random secret of at least 32 characters | `CORNERMEX_QUOTE_SIGNING_SECRET` |

Credential search performed: the local `.env` holds only Supabase variables (and
points at the obsolete project). No shipping or payment credential exists
locally. The Railway environment was not read.

## Next

1. Provider sandbox credentials → run both adapters against the sandboxes, fix
   whatever the real responses differ on, move to `SANDBOX`.
2. MX-2: `PaymentProvider`, Mercado Pago Orders API, Clip, provider-neutral
   pending-payment order function and its migration.
3. MX-3: shipment tables, webhook routes, label purchase after payment.
4. es-MX copy pass on the remaining English pages and the cookie banner.
