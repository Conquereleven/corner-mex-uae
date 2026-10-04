# Payment architecture

**Status:** `SCAFFOLDED`. The provider layer, the state machine, the database
functions, the webhook routes and the checkout wiring are implemented and
tested. **No request has been sent to Mercado Pago or Clip**, so neither is
`SANDBOX`.

| Provider | Role | Capability level |
| --- | --- | --- |
| Mercado Pago | Primary | `SCAFFOLDED` — needs test credentials to reach `SANDBOX` |
| Clip | Secondary | `SCAFFOLDED` — its redirected checkout has **no sandbox** |
| Cash on delivery | Local delivery only, off by default | Implemented, disabled |
| Stripe | UAE history | `DEFERRED`, inert in a Mexico build |

## Layout

| File | Role |
| --- | --- |
| `src/lib/payments/types.ts` | `PaymentProvider`, normalised payment, errors |
| `src/lib/payments/state.ts` | The state machine and amount comparison |
| `src/lib/payments/mercado-pago.ts` | Orders API adapter |
| `src/lib/payments/clip.ts` | Redirected Checkout adapter |
| `src/lib/payments/processor.ts` | Exactly-once event processing and reconciliation |
| `src/lib/payments/providers.ts` | Configuration, health |
| `src/lib/mx-payments.server.ts` | Bridge to the database functions |
| `src/routes/api/public/hooks/{mercado-pago,clip}.ts` | Webhook routes |
| `supabase/mx/migrations/…` | `mx_payment_attempts`, `integration_webhook_events`, `cm_mx_*` |

## State machine

Eight normalised states, **as a view over the canonical stored statuses** — not
a second source of truth:

| State | Stored as (`payments.status` vocabulary) |
| --- | --- |
| `CREATED` | `pending`, no provider id yet |
| `PENDING` | `pending`, provider id bound |
| `AUTHORIZED` | `authorized` |
| `PAID` | `paid` |
| `PARTIALLY_REFUNDED` | `paid` with `0 < refunded_amount < amount` |
| `FAILED` | `failed` |
| `CANCELLED` | `cancelled` |
| `REFUNDED` | `refunded` |

Transitions are monotonic: a stale or repeated event cannot undo a payment.
`PAID` can only move to a refund. A `FAILED` or `CANCELLED` attempt that later
turns out `PAID` (a cash voucher paid after expiry) is recorded and **held for a
person** — it never ships automatically.

## What is never trusted

- **The browser.** The order request schema has no field that could carry a
  price, shipping, discount, tax or total. The payment attempt's amount is read
  from the order row by the database; the application cannot pass one in.
- **A return URL.** The confirmation page asks the server to re-read the payment
  from the provider. Landing on "success" changes nothing.
- **A webhook body**, even a correctly signed one. It is authenticated, recorded
  once, and then used only as a prompt to re-read the payment. The provider's
  answer is compared with the order — reference, amount (in cents), currency —
  before one database function applies it.

## Mercado Pago — Orders API

Source: Mercado Pago Mexico developer documentation, *Checkout API vía Orders*,
read 2026-10-05. The legacy Payments / Preferences APIs are not used.

| Operation | Call |
| --- | --- |
| Create | `POST https://api.mercadopago.com/v1/orders` with `Authorization: Bearer <access token>` and `X-Idempotency-Key` |
| Body | `type: "online"`, `processing_mode: "automatic"`, `external_reference` = CornerMex order number, `total_amount: "349.50"`, `payer`, `transactions.payments[]` |
| Read | `GET /v1/orders/{id}` |
| Cancel | `POST /v1/orders/{id}/cancel` |
| Refund | `POST /v1/orders/{id}/refund` (body names the transaction for a partial refund) |
| Webhook | topic `order`; `x-signature: ts=…,v1=…`, `x-request-id`, query `data.id` |

- **Idempotency:** the checkout operation id is the `X-Idempotency-Key`. A retry
  or a second tab replays the same order and the same payment.
- **Unknown outcome:** a timeout or 5xx on a money call is `AMBIGUOUS_WRITE`. It
  is never blindly retried; the customer's retry reuses the same key.
- **Webhook signature:** HMAC-SHA256 over
  `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Events older than 15
  minutes are refused as replays.
- **Test vs production:** a `TEST-` token is required in sandbox and refused in
  production, and vice versa.

**Payment methods.** The Orders API takes card payments only with a token minted
in the browser by Mercado Pago's own SDK (Card Payment Brick), so card data never
reaches CornerMex. The adapter accepts such a token. **The storefront Brick is
not built yet**, so today the checkout offers Mercado Pago's cash method (OXXO),
which needs no card data. Cards through Mercado Pago are the next UI step and
need the Public Key.

**To verify against a real test account** (not assumed): the refund and cancel
paths and bodies; the full list of order `status` / `status_detail` values
(unknown ones are stored raw and map to no state); the exact signature manifest.

## Clip — Redirected Checkout

Source: developer.clip.mx, read 2026-10-05.

| Operation | Call |
| --- | --- |
| Create | `POST https://api.payclip.com/v2/checkout`, `Authorization: Basic base64(api key:secret)` |
| Body | `amount`, `currency`, `purchase_description`, `redirection_url {success, error, default}`, `metadata.external_reference` (≤ 36 chars), `webhook_url` |
| Reply | `payment_request_id`, `payment_request_url`, `status` (`CHECKOUT_CREATED` … `CHECKOUT_COMPLETED`) |
| Read | `GET /v2/checkout/{payment_request_id}` |

The customer pays on Clip's hosted page: no card data touches CornerMex.
**Transparent Checkout is not implemented** and must not be described as
available; it takes card data in the merchant's page and carries PCI obligations.

Two documented facts shape the adapter:

1. **The Checkout webhook is unsigned.** CornerMex puts an unguessable per-order
   token in the webhook URL, and then re-reads the payment from Clip before
   applying anything. A completed link that does not report its amount is
   rejected.
2. **There is no sandbox for Redirected Checkout.** Clip's test credentials cover
   Transparent Checkout, the SDK and Refunds only. This flow can be verified only
   with a real, identity-verified account, so the configuration requires
   `CLIP_ENVIRONMENT=production` explicitly and never reports `SANDBOX`.

Not implemented, and reported as `NOT_SUPPORTED` rather than faked: cancelling a
payment link (the API documents none) and refunds (Clip's Refunds API works on a
receipt number and is not wired yet).

**To verify on a real account:** the status-read path, and whether the status
read returns the amount.

## Cash on delivery

Off by default. `CORNERMEX_MX_COD_LOCAL_ENABLED=true` offers it **only** with a
`LOCAL_DELIVERY` shipping option; the server refuses it for a parcel shipment
whatever the browser sends. UAE cash-on-delivery variables enable nothing.

## Sequence

```
cart → Mexico address → quoteMxShipping (signed options) → customer selects
  → placeMxOrder
       1. verify configuration and the Mexico database identity
       2. verify the signed shipping option (price comes from the token)
       3. cm_mx_create_order_v1      order + stock, items must be launch-ACTIVE
       4. cm_mx_start_payment_attempt_v1   amount read from the order row
       5. provider.createPayment     idempotency key = checkout operation id
       6. cm_mx_bind_payment_attempt_v1
  → customer pays at the provider
  → webhook / confirmation page → provider.getPayment → cm_mx_apply_payment_state_v1
       paid               → order confirmed, eligible for fulfilment
       failed / cancelled → order cancelled, stock released
       mismatch           → under review, nothing applied
  → cm_mx_reserve_label_v1 (refused until paid) → purchaseLabelOnce → tracking
```

The last line is implemented and tested as functions; it is **not wired to run
automatically**, so no label is purchased anywhere.

## Configuration

| Variable | |
| --- | --- |
| `MERCADO_PAGO_ENABLED` | `true` to offer it |
| `MERCADO_PAGO_ACCESS_TOKEN` | Server-side only. `TEST-…` in sandbox |
| `MERCADO_PAGO_WEBHOOK_SECRET` | The application's webhook secret |
| `MERCADO_PAGO_ENVIRONMENT` | `sandbox` (default) or `production` |
| `CLIP_ENABLED` | `true` to offer it |
| `CLIP_API_KEY`, `CLIP_API_SECRET` | Server-side only |
| `CLIP_WEBHOOK_SECRET` | ≥ 32 chars; mints the per-order webhook token |
| `CLIP_ENVIRONMENT` | Must be `production` |
| `CORNERMEX_MX_COD_LOCAL_ENABLED` | Local-delivery cash on delivery |

Webhook URLs to register: `<public URL>/api/public/hooks/mercado-pago` (Clip's is
sent per payment).

## Tests

`tests/cornermex-mx/payments.test.mjs` (34), `payment-webhook-route.test.mjs`
(7), and the SQL contract `scripts/cornermex-mx/test-mx-foundation-sql.mjs`.
Covered: creation, idempotency replay, duplicate webhook, status transitions,
amount tampering, failure, late capture, forged and expired signatures, Clip
return verification, refusal on a non-Mexico database.
