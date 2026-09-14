# INTERMEX-PO-AUTOMATION-1

PO intake, controlled extraction, invoice preview and exceptions integrated with GO-LIVE-2. This branch does **not** authorize deployment, production migrations, OAuth grants or provider execution. `PO_PROVIDER_EXECUTION_AUTHORIZED=false` is an unconditional server-side stop; no environment switch bypasses it. No release endpoint/button is exposed.

## Flow and boundaries

1. An authorized email/iChat bridge POSTs an attachment to `/api/public/hooks/po-intake`, or an authenticated admin uploads it in Integrations. The bridge uses a dedicated bearer secret and a pinned mode/organization. No mailbox or iChat subscription was activated; channel operators must connect their authorized attachment delivery to this contract.
2. Intake verifies canonical base64 and a 5 MB limit, computes SHA-256, and preserves original bytes privately. PDFs use pinned PDF.js with executable PDF evaluation disabled, 20-page/200,000-character limits. Scans require human extraction; no automatic OCR or remote URL fetching.
3. The parser accepts strict `INTERMEX PO v1` text, normalized JSON, and the MAF layout reconstructed from the video. Unknown/ambiguous layouts, missing tax identity, discounts and unsupported precision become exceptions. The original PO PDF bytes were unavailable; the reconstructed PDF tests do not certify its actual text-layer ordering.
4. Customer matching requires exactly one approved name alias AND TRN. Location and product aliases must each match exactly once. Store names never determine place of supply. The MAF parser uses PO date only when the approved mapping explicitly chooses `invoiceDatePolicy=po_date`; otherwise review is required. Terms come from reviewed customer policy. Unit aliases allow `Kilogram` → `kg` without quantity conversion.
5. Prices must equal the approved price, quantities/rates must be positive, VAT is 5%, and BigInt decimal arithmetic rounds half up at line net and line VAT. Header and line totals must reconcile exactly. Example: 2.50 × AED 47 = 117.50 + 5.88 = **123.38**.
6. Validated documents enter `ready_for_review`; failures enter `requires_attention`. Admin corrections preserve original bytes, record before/after values and require a reason. Mapping changes invalidate existing approval revisions. The detail view includes conflicts, revisions and GO-LIVE-2 audit events.
7. A future separately authorized release binds the PO to a fresh same-mode GO-LIVE-2 gate generation. The existing accounting-worker endpoint uses shared authentication, runtime gates, token refresh and provider transport. It currently returns the PO hard-stop result without claiming PO work.
8. The dormant processor fully paginates customer/PO lookup, checks existing manual invoices, persists a unique create intent before POST, creates an unsent invoice, then fetches and reconciles customer, reference, address snapshot, date, terms, tax, items and totals. It never sends email or creates customers/items/payments. Existing reference suffix differences become reconciliation exceptions, not permission to create another invoice.
9. Projection stores the reconciled invoice ID/number/status/date and an allowlisted URL. The final Zoho PDF remains in Books; this sprint does not expose a public PDF download or grant portal access to POs without a storefront order. PDF visual acceptance is a separate E2E gate.

## Idempotency and recovery

Source/message/attachment identity, document hash and business identity are enforced within mode + organization. Business identity is external customer ID + normalized PO number, deliberately excluding the store label. A per-scope database advisory lock serializes overlapping intake identities; unique indexes are the backstop. Cross-channel duplicate receipts retain their identities. Different bytes for an existing source or PO preserve a conflict record, block release and appear in the queue. Successful invoices remain successful while the new conflict stays visible; no overwrite occurs.

Worker claims use `FOR UPDATE SKIP LOCKED`, owner/lease checks and the existing activation generation. Provider requests recheck the gate and lease. A durable create intent is never cleared. Response loss, lease expiry or reconciliation mismatch require operator attention. The pure processor supports lookup recovery when an invoice becomes visible; there is deliberately no operational retry/release UI for an ambiguous create in this sprint. Conflicts and uncertain creations must not be “fixed” by deleting intents or changing PO identity. A reviewed reconciliation-only operational action is required before activation.

## Migration and data custody

`20260914114744_intermex_po_automation_1.sql` adds five private PO tables, two service-only RPCs and a PO foreign key on the existing accounting audit table. Tables enable/force RLS and grant no direct access to public, anon, authenticated or service_role. Server-only service RPCs perform operations; admin operations independently check the actor's admin role. No public schema table/type baseline is changed. The migration is registered as production-gated in the canonical extension manifest.

Original attachments, revised extraction and conflicts contain business data. They stay in the private database; raw document bytes are omitted from admin list/detail and logs. Set a reviewed retention period and original-document review/download policy before production intake. Keep records required for idempotency/audit even when an approved retention process removes attachment content. This PR does not run a purge or remote migration.

## Transport contract

Server-only environment variables are listed in `.env.example`: `CORNERMEX_PO_INTAKE_ENABLED=false`, a dedicated `CORNERMEX_PO_INTAKE_SECRET`, `CORNERMEX_PO_MODE=test`, and `CORNERMEX_PO_ORGANIZATION_ID`. These enable only intake transport after a separately approved deployment. GO-LIVE-2 provider credentials/gates remain independent.

POST JSON: `{mode, organizationId, source: "email" | "ichat", sourceId, mime, documentBase64}`. `sourceId` must be stable and include the message plus attachment identity. Supported MIME types are `application/pdf`, `application/json`, `text/plain`. Authorization is `Bearer <dedicated-secret>`. Success is HTTP 202 with a durable intake ID/status; duplicate acceptance reuses the ID. 401/403/413/415 reject authorization, scope, size or MIME; disabled transport returns 503. Never place secrets in browser variables, payloads or URLs.

`tests/intermex-po-automation-1/fixture.mjs` is the executable synthetic mapping/schema example. Its IDs/TRN/test-organization assertion are fixtures, never approved live configuration. Mappings require external customer and billing address IDs, an address snapshot, explicit supply/date/terms policy, SKU/item/tax IDs, unit aliases, approved rate and an expiring evidence reference.

## Verification

Run `npm run test:intermex-po-automation-1`. It covers representative PDF extraction through reconciliation, commercial failures, mapping expiry/ambiguity, historical suffix typo lookup, pagination failure, authentication, mode separation, stale lease and lost-response recovery. PostgreSQL checks additionally require `PO_POSTGRES_TEST=1`, a loopback disposable database and canonical migration replay. CI runs them against PostgreSQL 17 after GO-LIVE-2's SQL suite. The local sandbox could not start PostgreSQL (shared-memory permission denied); local skips must not be described as database passes.

Also run GO-LIVE-2 and CM-INT-ZOHO-1 regression suites, canonical/schema validators, `typecheck`, changed-file lint, both builds and browser-secret scan. CI records the authoritative current-head result.

See [read-only inspection](read-only-inspection.md) and [E2E checklist](e2e-checklist.md).
