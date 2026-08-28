# CM-INT-ZOHO-1 — zero-touch order-to-invoice

## Authority and product evidence

- CornerMex remains the order and order-lifecycle authority.
- Stripe or the configured payment provider remains payment truth.
- Zoho becomes invoice/accounting authority only after a separate activation gate.
- Repository, issue #68 and public Intermex material contain no reliable evidence that Intermex uses Zoho Books rather than Zoho Invoice. The provider is therefore abstracted and live activation is blocked until Linda/Intermex confirms product, organization ID, data center and UAE VAT tax mapping.

Official API research performed 2026-08-28:

- Zoho Books API v3: `https://www.zoho.com/books/api/v3/introduction/`, invoices, contacts, OAuth scopes and customer payments. The organization is selected with `organization_id`; limits include 100 requests/minute/organization and HTTP 429.
- Zoho Invoice API v3: `https://www.zoho.com/invoice/api/v3/introduction/`, contacts and invoices. It uses a different API path/header, returns invoice ID/number/status/URL, and supports JSON/PDF retrieval.
- Neither product documents a Stripe-like idempotency key for invoice creation. Every retry first searches by canonical CornerMex order reference and adopts exactly one match; zero or multiple matches are explicit branches.

## Flow and safety

1. An additive order trigger writes a unique outbox job when an order first enters a confirmed-or-later state. Payment changes create separate deduplicated sync jobs.
2. A worker claims eligible jobs at least once. Durable unique job and entity keys make duplicates replay-safe.
3. Customer mapping is reused or recovered before creation.
4. Invoice mapping is reused; after a timeout the canonical order number is searched before any create.
5. AED line totals, shipping, discount and canonical VAT are validated in integer cents before any provider call.
6. A Zoho payment record may be created only from canonical paid state plus payment-provider reference. Zoho never writes CornerMex/Stripe state.
7. Retryable failures use bounded exponential backoff (maximum six attempts / thirty minutes). Validation, auth and conflicts require attention. Rate limits and provider outages are degraded/retryable.
8. Reconciliation compares external invoice total and identity with canonical order data and raises a mismatch job; it never silently overwrites CornerMex.

Failure taxonomy: `auth`, `validation`, `rate_limit`, `provider_unavailable`, `mapping_error`, `conflict`, `unknown`.

Logs and audit rows carry correlation ID, safe code, timestamps and external IDs only. They do not store OAuth tokens, request bodies, email, phone, addresses or tax registrations.

## Non-activation proof

- `ZOHO_LIVE_ACTIVATION_AUTHORIZED` is compile-time `false`.
- `CORNERMEX_ZOHO_LIVE_WRITES_ENABLED` defaults to `false` and cannot override the repository gate.
- Product, organization, API data-center base URL, token and VAT tax ID are empty in `.env.example`.
- Migration `20260828170741_cm_int_zoho_1_zero_touch_order_invoice.sql` is registered with `productionApplied=false` and `requiresFounderProductionGate=true`.
- This sprint performs no Supabase apply, Zoho request, OAuth activation, synthetic production record, Railway deploy or merge.
