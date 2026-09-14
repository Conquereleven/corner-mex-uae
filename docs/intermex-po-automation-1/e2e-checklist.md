# E2E acceptance checklist

## This PR, offline / disposable CI

- [x] Versioned intake contract and admin upload; default-disabled transport.
- [x] Representative MAF PDF and explicit JSON/text extraction.
- [x] Exact customer/TRN/location/SKU resolution; unit alias, approved price and VAT arithmetic.
- [x] Example yields AED 117.50 + 5.88 = 123.38.
- [x] Invoice composer, paginated lookup, durable intent and simulated lost-response recovery.
- [x] Private original document, conflicts, exception queue, revisions and shared audit.
- [x] No provider execution switch can bypass the code hard stop.
- [ ] Current PR CI PostgreSQL replay/ACL/concurrent intake and claim tests green (check PR runs).
- [ ] Current PR complete CI and review accepted (check PR runs/review).

## Before an authorized test-organization run

- [ ] Confirm a separate Zoho test organization and its data center; do not relabel production as test.
- [ ] Obtain original MAF PDF and more multi-item/customer samples; certify actual extraction and rejection behavior.
- [ ] Read-only API verify customer/billing address/item/tax IDs, active status, currency, addresses, templates/custom fields and regional response shape.
- [ ] Approve explicit invoice-date, terms, Dubai-versus-Ajman supply policy and rates; record expiring mapping evidence.
- [ ] Authorize scoped OAuth registration/grant if needed, then verify server token refresh without exposing secrets.
- [ ] Approve deployment/migration to an isolated test environment, intake bridge routing, rate limits/retention and original-document access policy.
- [ ] Implement/review an explicit reconciliation-only operator recovery action for uncertain creates and a controlled conflict-resolution action; never clear create intents.
- [ ] Separately authorize removal of the PO execution hard stop and expose a controlled release action; all GO-LIVE-2 gates still required.
- [ ] Run the same PO through email and iChat twice concurrently; assert one intake/business identity and at most one invoice.
- [ ] Test price/SKU/address/tax mismatch, conflicting revised PO, missing mapping, expiry, disabled gate, rotated generation, lease expiry, 429/5xx and response loss.
- [ ] Reconcile invoice by read-only GET; visually inspect the actual Tax Invoice PDF: seller/customer TRN, billing/supply/date/terms, reference/store, quantity, price, VAT and totals.
- [ ] Confirm unsent invoice, no payment, no contact/item mutation, no automatic message, no public document exposure.

## Before production

- [ ] Review fresh Zoho/Railway/Supabase state; approve exact release, migration and production mappings.
- [ ] Obtain explicit user authorization for production mutation/provider activation.
- [ ] Verify backup/rollback and disable switch, least-privilege access, audit retention and alert ownership.
- [ ] Use an approved new PO; never create another invoice for B202609-37789.
- [ ] Observe first authorized result and reconciliation/PDF; stop on any ambiguity.

Production items remain unchecked by design. Creating or merging this PR is not authorization to execute them.
