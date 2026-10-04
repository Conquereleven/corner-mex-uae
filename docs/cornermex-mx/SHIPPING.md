# Shipping architecture

**Status:** `SCAFFOLDED` — implemented and contract-tested; never called with a
real account.

CornerMex Core owns the shipping model. Skydropx and Solo Envíos are adapters.
Checkout and admin code never see a provider's field names.

```
checkout ──► quoteMxShipping (server)
               ├─ price cart from the database
               ├─ estimateParcels            parcel.ts
               ├─ shopRates                  quote-engine.ts
               │     ├─ Skydropx  ─┐
               │     └─ Solo Envíos┴─► NormalizedQuote[]
               ├─ manualQuotes               fulfillment.ts (local + fallback)
               ├─ rank (CHEAPEST | FASTEST | BEST_VALUE)
               └─ signQuote                  quote-token.server.ts
```

## Modules (`src/lib/shipping/`)

| File | Role |
| --- | --- |
| `types.ts` | `ShippingProvider`, `NormalizedQuote`, `NormalizedShipment`, `ShipmentStatus`, `ShippingError` |
| `skydropx-platform.ts` | One client for the API contract both providers publish |
| `providers.ts` | Provider definitions, configuration, health |
| `quote-engine.ts` | Parallel quoting, de-duplication, ranking |
| `fulfillment.ts` | Stock-point origin, manual and local rules |
| `parcel.ts` | Parcel estimation with explicit assumptions |
| `quote-token.server.ts` | Signed shipping selection |
| `label-purchase.ts` | Buy a label exactly once; reconcile unknown outcomes |
| `status.ts` | Provider status → CornerMex status; monotonic transitions |
| `webhook.server.ts` | HMAC verification, event identity, replay protection |

## `ShippingProvider`

`authenticate · quote · createShipment · getShipment · cancelShipment ·
getTracking · getLabel`. A method a provider cannot support throws
`ShippingError("NOT_SUPPORTED")` instead of faking a result.

## Normalised quote

`provider, carrier, carrierName, service, serviceCode, price, currency,
estimatedDaysMin, estimatedDaysMax, deliveryEstimate, fulfillmentMode, package,
insurance, pickupSupported, providerQuoteId, providerRateId, expiresAt`.

## Rate shopping

- Providers are quoted in parallel. **One failing does not fail the quote**; the
  failure is reported beside the options the others returned.
- The same carrier service offered by both aggregators appears once, at the
  lower price.
- Ranking only orders the options. Every option keeps its delivery estimate; an
  option with no estimate can never be ranked fastest.
- Expired quotes and quotes in another currency are dropped.

## The browser cannot set a price

Each option is returned with a token: the quote, the destination postal code and
a fingerprint of the cart, HMAC-signed with `CORNERMEX_QUOTE_SIGNING_SECRET`.
At order time the server takes the shipping amount **from the verified token**.
A token is refused if forged, expired, or if the postal code or the cart
changed. No quote table is needed.

## Shipment state model

`QUOTE_CREATED → LABEL_PENDING → LABEL_CREATED → READY_FOR_PICKUP → IN_TRANSIT →
OUT_FOR_DELIVERY → DELIVERED`, plus `EXCEPTION`, `CANCELLED`, `RETURNED`.

| Provider status | CornerMex status |
| --- | --- |
| workflow `pending`, `in_progress` | `LABEL_PENDING` |
| workflow `success`; tracking `created` | `LABEL_CREATED` |
| `picked_up`, `in_transit` | `IN_TRANSIT` |
| `last_mile`, `delivered_to_branch` | `OUT_FOR_DELIVERY` |
| `delivered` | `DELIVERED` |
| `delivery_attempt`, `exception`, `retained`, `destroyed` | `EXCEPTION` |
| `in_return` | `RETURNED` |
| `canceled` | `CANCELLED` |

An unknown provider status maps to nothing: the last known status is kept and the
raw value is stored. A status never moves backwards and never leaves a terminal
state. `READY_FOR_PICKUP` is reserved for scheduled carrier pickups (MX-3).

## Label purchase

1. **No label before payment.** `purchaseLabelOnce` refuses without a payment
   assertion (`PAID`, or a named rule that permits shipping first).
2. **One label per order.** A reservation is written before the provider is
   called; a second attempt finds it and stops.
3. **Unknown outcome ≠ failure.** A timeout, a 5xx or a 409 leaves the
   reservation `AMBIGUOUS`. It is resolved by `reconcileAmbiguousLabel`, which
   asks the provider — by shipment id if known, otherwise by replaying the
   identical request under the provider's own `unique_shipment` idempotency. It
   refuses to run with a different rate, because that would buy a second label.

## Webhooks

- HMAC-SHA512 over the exact raw body, lowercase hex, `Authorization: HMAC <sig>`.
  The weaker bearer-token mode is refused.
- Identity: `type:id:status` plus a sha256 of the body. Stored fields:
  `provider, external_event_id, payload_hash, received_at, processed_at,
  processing_status`.
- `processShippingWebhookOnce` claims the event before acting. A duplicate is
  acknowledged and ignored; an event whose processing failed is retried when the
  provider re-delivers it.

## Database

`supabase/mx/migrations` creates `shipments` (unique per order — the
duplicate-label guard), `shipment_events`, `integration_webhook_events`, and
`cm_mx_reserve_label_v1`, which refuses a reservation until the order is paid
and grants it exactly once. Proven by the SQL contract test.

## Sandbox readiness

Both adapters are still `SCAFFOLDED`: no credentials exist, so no sandbox request
has been made and none is claimed. Configuration, health reporting and the
contract tests are complete; the first real call needs only
`<PROVIDER>_ENABLED`, `_CLIENT_ID`, `_CLIENT_SECRET` and
`CORNERMEX_MX_ORIGIN_JSON`.

## Not built yet

| Item | Sprint |
| --- | --- |
| Shipping webhook HTTP routes (payment webhook routes exist) | MX-3 |
| Label purchase wired to the order lifecycle | MX-3 |
| Pickup scheduling, multi-package packing | later |
| A local last-mile provider (none is invented; `LOCAL_DELIVERY` is a manual rule) | later |
