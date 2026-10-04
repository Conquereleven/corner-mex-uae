# Deferred: the UAE implementation

**Status:** `DEFERRED`. Kept in the repository as history; inactive in the
Mexico customer experience.

Nothing was deleted. Removing these modules would break historical order
display, applied-migration contracts and their own tests, for no customer
benefit.

## Retained, not reachable from any active customer surface

| Module | What it is |
| --- | --- |
| `src/lib/commercial-config.server.ts` | Per-emirate COD rates, UAE VAT 5 %, TRN |
| `src/lib/cod-order.functions.ts`, `cod-preview.ts` | Emirate-based order and preview server functions (`cod-preview`'s pricing helpers are still used) |
| `src/lib/card-checkout.functions.ts`, `payments.functions.ts`, `stripe-*.ts`, `payment-state.ts`, `card-capability.server.ts` | Stripe (AED). Inactive provider for Mexico |
| `src/lib/payment-methods.ts` | Emirate COD limits, Tabby / Tamara, UAE bank transfer |
| `src/lib/delivery-sla.ts` | The UAE Terms' 2–5 business day window |
| `src/lib/legal-docs.ts`, `LegalDocPage.tsx`, `admin.legal.tsx` | The nine UAE legal documents |
| `src/lib/shipping.functions.ts`, `shipments.functions.ts` | Emirate zone stubs, already fail-closed |
| `BUSINESS_IDENTITY` in `business-identity.ts` | RodMor TradeCo LLC, Sharjah licence. Not the Mexico seller |
| Arabic dictionary in `i18n.ts` | Not offered in Mexico |
| Zoho (Intermex organisation), Intermex PO automation | Supplier workflows of the UAE operation |

A guard test (`tests/cornermex-mx/no-active-uae.test.mjs`) fails if any active
customer surface names the UAE, AED, an emirate, VAT/TRN, Talabat, Deliveroo,
noon or RodMor, and separately asserts that the retired modules still exist.

## Not yet migrated (back-office)

Money in admin and seller screens now follows the market. Still UAE-specific:
the admin live view (UAE map, "UAE time"), the admin legal view of the retired
UAE documents, and field labels in the inactive seller area (coupons, shipping
zones by emirate, settings).

## Production

**UAE checkout is off** (Founder decision, applied 2026-10-05).
`CORNERMEX_CHECKOUT_ENABLED` and `VITE_CORNERMEX_CHECKOUT_ENABLED` are `false`
on the Railway service `corner-mex-uae`. Verified after the redeploy:
`/api/ready` → `checkoutEnabled: false`, commit `f90134b` unchanged, service
healthy. The storefront still serves the catalogue; it takes no order.

Nothing was deleted: the two historical UAE orders, the database, the
migrations, the audit history and the code are intact. Setting both variables
back to `true` reverses it.

## Second lock, in code

In every build whose active market is not the UAE, the UAE entry points refuse
to run even if checkout is switched on:

| Entry point | Behaviour in a Mexico build |
| --- | --- |
| `placeCodOrder`, `previewCodOrderTotals` | throw `UAE_MARKET_DEFERRED` |
| `initiateCardCheckout`, `createStripeSession`, `confirmBnplPayment` | throw `UAE_MARKET_DEFERRED` |
| legacy `placeOrder` | throws `UAE_MARKET_DEFERRED` |
| `/api/public/stripe-webhook` | answers `410 Gone` |

## Historical records

Two delivered UAE orders exist in the canonical database. Order views detect
the address model: a snapshot tagged `address_model: "mx-1"` renders as a Mexican
address, anything else renders in its original UAE shape.
