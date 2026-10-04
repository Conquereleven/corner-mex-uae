# Payment architecture

**Status:** `PLANNED` (Sprint MX-2). No Mexico payment provider code exists yet.
This document fixes the design so MX-2 is implementation, not discovery.

| Provider | Role | Capability level |
| --- | --- | --- |
| Mercado Pago | Primary online provider | `PLANNED` |
| Clip | Secondary online provider | `PLANNED` |
| Cash on delivery | Explicit Mexico flag (`CORNERMEX_MX_COD_ENABLED`), off by default | Implemented; `SCAFFOLDED` operationally |
| Stripe | Historical, AED only | `DEFERRED` — code retained, inactive |

Cash on delivery is **not** inherited from the UAE. A deployment carrying the old
UAE variables offers no payment method in Mexico
(`tests/cornermex-mx/checkout-config.test.mjs`).

## What already exists and carries over

- **Authoritative totals.** The server computes subtotal, shipping, tax and
  total; the browser sends identities, quantities and an opaque shipping token.
- **Order idempotency.** Operation id + request fingerprint
  (`cm_create_cod_order_v2`).
- **Payment-attempt model** (`20260828180000_cm_pay_stripe_1_payment_foundation.sql`):
  several attempts per order, monotonic status transitions driven only by
  verified provider events (`src/lib/payment-state.ts`). The pattern is reused;
  the Stripe-specific functions, which reject any currency but AED, are not.
- **Stock release on cancellation.**

## `PaymentProvider` (target)

```ts
interface PaymentProvider {
  readonly id: "mercado_pago" | "clip";
  createPayment(input: {
    orderReference: string;      // canonical CornerMex external reference
    amount: number;              // server-computed, market currency
    currency: "MXN";
    idempotencyKey: string;      // one per payment attempt
    payer: { email: string; name?: string };
    returnUrls: { success: string; failure: string; pending: string };
  }): Promise<{ providerPaymentId: string; redirectUrl: string | null; status: PaymentStatus }>;
  getPayment(providerPaymentId: string): Promise<NormalizedPayment>;
  refund(providerPaymentId: string, amount: number, idempotencyKey: string): Promise<NormalizedRefund>;
  verifyWebhook(rawBody: string, headers: Headers): WebhookVerification;
  parseWebhook(rawBody: string): PaymentEvent | null;
}
```

CornerMex payment statuses (existing): `pending · under_review · paid · failed ·
refunded · cancelled`. Each provider status maps into these; the raw status is
stored beside it.

## Mercado Pago — requirements for MX-2

Use the current official Mercado Pago Mexico documentation and the **Orders
API**; fall back to Payments/Preferences only for a verified technical reason,
recorded in this file.

- Access Token server-side only; never in a `VITE_` variable.
- `X-Idempotency-Key` on every create and refund.
- `external_reference` = the CornerMex order reference.
- Amount taken from the order row, never from the request.
- Webhook: verified signature, replay-safe through the same ledger shape as
  shipping (`provider, external_event_id, payload_hash, received_at,
  processed_at, processing_status`).
- A browser return URL is never proof of payment. Status is read from the
  provider or from a verified event.
- Reconciliation job: orders `PAYMENT_PENDING` past a threshold are looked up.

## Clip — requirements for MX-2

Start with **Redirected Checkout** unless the documentation and the account
justify more. Transparent checkout is not to be described as enabled unless its
PCI requirements are met. Payment link creation, return handling, server-side
status verification, and webhook if the chosen API supports it.

## Order → payment → shipment sequence

```
ORDER_DRAFT ─► PAYMENT_PENDING ─► PAID ─► CONFIRMED ─► READY_TO_FULFILL
                    │                                        │
                    ├─ failed / expired ─► CANCELLED         ▼
                    │   (stock released, no label)      LABEL_CREATED ─► SHIPPED ─► DELIVERED
```

| Event | Behaviour |
| --- | --- |
| Payment fails or expires | Order cancelled, stock released; **no label is bought** |
| Payment webhook replayed | Ledger rejects the duplicate; no second order, no second transition |
| Late success after cancellation | Flagged for manual attention (`payment_attention`); never auto-shipped |
| Shipment API timeout | `AMBIGUOUS` reservation; looked up before any new attempt |
| Label requested twice | Reservation exists; second request does not reach the provider |

Open design point for MX-2: an online order must hold stock while payment is
pending and release it on failure. `cm_create_card_order_v2` already does this
for Stripe; the Mexico equivalent needs a provider-neutral function and a
migration, plus an explicit pending-payment expiry.

## Credentials needed

Mercado Pago: Access Token and Public Key (test and production), webhook secret.
Clip: API key and secret for the chosen checkout product. None exist in this
project today.
