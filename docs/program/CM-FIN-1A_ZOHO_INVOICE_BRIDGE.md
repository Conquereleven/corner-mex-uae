# CM-FIN-1A — Zoho Invoice Bridge

Status: repository-only design slice. Production activation is not authorized by this document.

## Objective

Remove the manual invoice-file handoff from the post-order workflow and establish one reusable Zoho Books invoice integration core for:

1. Intermex Shopify orders through a Shopify adapter.
2. CornerMex canonical orders through a CornerMex lifecycle adapter.

Email is an optional notification channel, not a required transport or source of truth.

## Target customer workflow

### Intermex

Shopify order → Shopify webhook → Invoice Bridge correlation → Zoho invoice-created webhook → invoice linked to Shopify order → customer can view/download invoice.

### CornerMex

Canonical CornerMex order/lifecycle transition → Invoice Bridge → resolve-or-create Zoho invoice → invoice linked to canonical CornerMex order → customer can view/download invoice.

No user downloads a PDF from Zoho and re-uploads it to ChatGPT, Shopify, or CornerMex.

## Architecture

### 1. Provider-neutral core

The bridge core owns:

- Zoho OAuth token refresh.
- Zoho organization selection.
- Invoice lookup by external reference.
- Optional invoice creation when the accounting workflow has not already created one.
- Invoice metadata normalization.
- PDF retrieval from Zoho Books.
- Optional Zoho-native invoice email.
- Idempotency and reconciliation state.
- Cancellation/refund handoff to credit-note logic.

The core must not depend on Shopify types or CornerMex UI types.

### 2. Shopify adapter

The Shopify adapter owns:

- HMAC verification on every Shopify webhook.
- Store/tenant resolution.
- Order-event normalization.
- Trigger policy per tenant (`orders/create` or `orders/paid`).
- Stable external reference generation.
- Writing invoice metadata back to the Shopify order.
- Supplying invoice state to a future customer-account extension.

Recommended external reference:

`shopify:<shop-domain>:<shopify-order-id>`

Recommended order metadata:

- `invoice_bridge.zoho_invoice_id`
- `invoice_bridge.invoice_number`
- `invoice_bridge.status`
- `invoice_bridge.last_synced_at`

Do not place OAuth credentials, refresh tokens, or API secrets in Shopify metafields.

### 3. CornerMex adapter

The CornerMex adapter owns:

- Listening after canonical order creation/lifecycle transitions rather than inside checkout UI.
- Converting the canonical order into the provider-neutral invoice request contract.
- Persisting the Zoho invoice correlation against the canonical order.
- Exposing invoice state only through authenticated server-owned functions/routes.

The invoice integration must not block order placement, mutate inventory, change payment state, or bypass the canonical order lifecycle authority.

## Event model

Use two independent event sources and correlate them. This removes timing assumptions.

### Shopify event

On the configured Shopify order event:

1. Verify Shopify HMAC.
2. Deduplicate delivery.
3. Normalize order.
4. Upsert correlation by external reference.
5. Attempt Zoho invoice lookup.
6. If an invoice already exists, finalize immediately.
7. If it does not exist yet, leave the correlation pending. Do not create a duplicate by default for Intermex.

### Zoho event

On Zoho Books invoice-created webhook:

1. Verify configured webhook secret/header.
2. Read invoice ID, invoice number, and external reference.
3. Upsert invoice side of correlation.
4. Match the external order.
5. Finalize the link when both sides exist.

This supports both instant and delayed Zoho/Shopify synchronization without polling.

## Resolve-first rule

Intermex currently has a Zoho accounting workflow. Therefore the default rule is:

1. Search Zoho Books using the Shopify external reference/reference number.
2. Reuse the invoice when found.
3. Only create an invoice if the tenant policy explicitly enables bridge-owned creation.

This prevents double invoicing while allowing CornerMex to use bridge-owned creation later.

## PDF and customer delivery

Zoho Books remains the invoice-document authority.

The bridge retrieves the PDF server-side using Zoho Books invoice API and streams it to an authenticated customer route. Do not persist duplicate invoice PDFs unless there is a separate retention requirement.

Preferred UX:

- Order page shows invoice number/status.
- Button: `View invoice`.
- Button: `Download PDF`.
- Optional: `Email invoice` action, executed directly through Zoho Books.

For Shopify, expose this through a Customer Account UI extension or equivalent authenticated order surface.

For CornerMex, expose it in the authenticated order detail.

## Trigger policy

Trigger is tenant-configurable.

- Intermex: initially preserve the business rule currently used by the accounting workflow. If invoices are created at order creation, use `orders/create` for correlation.
- Paid retail: prefer `orders/paid` when an invoice should not exist for failed/unpaid orders.
- B2B payment terms/COD: order creation can be a valid invoice trigger.

The bridge must never infer accounting policy from payment method alone.

## Cancellation and refunds

Do not delete financial history.

- Cancelled before invoice finalization: close the pending correlation.
- Valid invoice that must be voided: invoke the configured Zoho void policy only when accounting rules allow it.
- Paid/refunded transactions: create/apply Zoho credit-note/refund workflow rather than deleting the invoice.

This is a separate activation gate after the initial invoice-link happy path is proven.

## Security requirements

- Shopify webhook HMAC verification is mandatory.
- Shopify delivery ID is stored for deduplication.
- Zoho webhook requests require a configured secret/header and replay protection where practical.
- Zoho OAuth refresh tokens remain server-side only.
- Access tokens are short-lived and are never persisted in browser storage.
- Invoice PDF routes require authenticated ownership/authorization checks.
- Secrets must pass the repository browser-secret scan.
- Logs must contain IDs/statuses only, not OAuth credentials or full invoice PDFs.

## Suggested persistence

Create a canonical integration correlation record, additive and independent from order/payment/inventory truth.

Suggested fields:

- `id`
- `tenant_key`
- `source_provider`
- `external_order_id`
- `external_order_number`
- `external_reference` (unique per tenant)
- `cornermex_order_id` nullable
- `zoho_invoice_id` nullable
- `zoho_invoice_number` nullable
- `sync_status` (`pending_order`, `pending_invoice`, `linked`, `failed`, `cancelled`)
- `last_error_code` nullable
- `retry_count`
- `created_at`
- `updated_at`

Separately store processed provider event IDs for replay/deduplication.

## Tenant configuration contract

Secrets/config are server-side and tenant-scoped. Exact variable naming can be finalized during implementation. Each tenant needs:

- Shopify shop domain when applicable.
- Shopify app/admin credentials when applicable.
- Shopify webhook secret when applicable.
- Zoho Books organization ID.
- Zoho OAuth client ID/secret/refresh token.
- Zoho Accounts/API domain for the organization's data center.
- Invoice trigger policy.
- Whether bridge-owned invoice creation is enabled.
- Invoice template/tax/account mapping when bridge-owned creation is enabled.

## Implementation slices

### CM-FIN-1A — Link existing invoices

- Provider-neutral Zoho client.
- Shopify webhook verification/normalization.
- Zoho invoice-created webhook receiver.
- Correlation persistence and idempotency.
- Resolve existing invoice by external reference.
- Store invoice metadata against order.
- Server-side PDF proxy.
- Tests for duplicate/out-of-order webhook delivery.
- No bridge-owned invoice creation.

### CM-FIN-1B — Bridge-owned invoice creation

- Customer/contact resolution.
- Product/SKU to Zoho item mapping.
- Tax/place-of-supply mapping.
- Invoice creation.
- Payment-state mapping where accounting-approved.

### CM-FIN-1C — Reversals

- Cancellation policy.
- Void policy.
- Credit notes/refunds.
- Reconciliation/audit views.

## Acceptance criteria for CM-FIN-1A

1. A Shopify order and its existing Zoho invoice are linked automatically regardless of event arrival order.
2. Duplicate provider webhooks cannot create duplicate correlations or invoices.
3. No PDF is manually uploaded.
4. No ChatGPT email step is required.
5. Invoice PDF can be fetched through a server-owned authenticated path.
6. Missing Zoho invoice results in a visible pending state, not a fake success.
7. Zoho outage does not break checkout/order creation.
8. No payment, inventory, order-lifecycle, email, or production activation occurs as a side effect of deploying the inactive code slice.
9. The same Zoho core is callable by both Shopify and CornerMex adapters.

## Production boundary

This design authorizes no production write, credential change, Zoho workflow change, Shopify app installation, webhook registration, database migration, Railway variable, deployment, email, invoice creation, credit note, or refund.
