# INTERMEX-GO-LIVE-1 — operational readiness and activation

Audit date: 2026-09-12. Baseline fetched from origin/main:
`976676271ccca3c9f04c071a581ce6ab158c1b66` (PR #75).
Branch: `feature/intermex-go-live-1-readiness`.

**NOT_READY. READY_FOR_OPERATIONS=false.** Code deployment does not certify operations.
This PR is a readiness change, not an activation request. No migration, live provider
operation, OAuth, Railway mutation, domain change, Shopify shutdown or merge is authorized.

## 1. Architecture and runtime audit

Intermex is the customer brand. CornerMex is internal order authority, Stripe is payment
truth, and Zoho is invoice/accounting authority. Do not expose infrastructure branding
on new customer surfaces.

| Component / source                                   | Evidence and consequence                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/checkout.tsx`                            | Uses `placeCodOrder`, explicitly does not call legacy `placeOrder` or Stripe. Card purchase cannot start from this UI.                                                                                                                                                      |
| `src/lib/orders.functions.ts`                        | Legacy non-atomic insert/items/stock path references legacy commerce fields. It is not a safe replacement for canonical COD checkout. Do not wire it to card checkout.                                                                                                      |
| `src/lib/payments.functions.ts`                      | Authenticated buyer ownership, stable local payment attempt, hosted Checkout Session and stable Stripe idempotency key. Existing confirmation reader is read-only. Admin reconciliation now selects `payment_method`, needed to detect missing paid/refunded card attempts. |
| `src/routes/api/public/stripe-webhook.ts`            | Raw-body signature verification precedes service-only RPC. This PR fixes `process` name shadowing that broke environment lookup. Verified failures return non-2xx.                                                                                                          |
| Stripe SQL migration                                 | Unique processed-event ledger, attempt/session linkage, AED total equality, row locks, terminal refund protection. Payment changes do not confirm the order. See remaining defects below.                                                                                   |
| `src/routes/order-confirmed.tsx`                     | Existing route redirects to cart; Stripe success URL is not a completed customer confirmation journey.                                                                                                                                                                      |
| B2B Foundation                                       | Six private forced-RLS tables; no direct browser grants. Inventory policies/reorder suggestions do not automatically create purchase orders or mutate inventory.                                                                                                            |
| `src/lib/b2b-portal.functions.ts`, portal migrations | Authenticated user and account membership boundary; Gate C adds pricing/availability through the same protected RPC. Availability UI is not an order reservation.                                                                                                           |
| `src/lib/accounting-worker.server.ts`, Zoho SQL      | Durable outbox, dedupe keys, entity mappings, leased worker claims, bounded retries and requires_attention. Order must be confirmed or later; paid pending orders do not yet produce invoices.                                                                              |
| `src/lib/zoho-accounting.server.ts`                  | Books/Invoice abstraction, compile-time authorization false. Credentials alone cannot activate. Access token input exists; automatic OAuth refresh is not implemented.                                                                                                      |
| `src/lib/account.functions.ts`, account order detail | Ownership-filtered order visibility exists. No accounting mapping/invoice projection or customer invoice link exists.                                                                                                                                                       |
| `src/routes/_authenticated/admin.integrations.tsx`   | Admin job/retry UI and provider posture exist. New dated readiness checklist remains visible even when accounting data is unavailable. It is explicitly not live telemetry.                                                                                                 |

Missing schema/provider means operational panels can remain unavailable despite deployed UI.
A schema API error alone does not prove that a migration is unapplied; the UI now says so.
The production migration ledger below is separate, freshly read evidence.

### Required implementation gates before provider activation

| Gate                         | Owner                 | Acceptance evidence                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 canonical card order      | Engineering           | Add an atomic, idempotent canonical card-order RPC and owner-bound request key; test concurrent retries, stock contention, rollback, shipping and tax totals. No legacy `placeOrder` reuse. New SQL requires its own migration and Founder gate.                                                                                                                                                                                                                |
| R2 storefront wiring         | Engineering           | Capability-gated card selection → R1 → `createStripeSession`; retry resumes the same order/session; pending confirmation page polls only owned canonical state. A success URL alone never marks paid.                                                                                                                                                                                                                                                           |
| R3 paid-to-confirmed handoff | Founder + Engineering | Confirm operational policy. Implement a separate idempotent CornerMex lifecycle transition after verified payment, with audit and outbox in the transaction, or explicitly certify an authorized operator confirmation step. Do not silently change payment authority or fulfillment semantics.                                                                                                                                                                 |
| R4 Stripe hardening          | Engineering           | Explicit test/live mode assertion on signed events; persist PaymentIntent for already-bound sessions (current webhook only sets it when adopting an unbound attempt); cumulative partial refund must never decrease; cover multiple attempts and late refunds at order level. Current SQL can lose intent linkage for a session bound before an intent exists and can regress partial-refund amount. Keep activation blocked until fixes pass PostgreSQL tests. |
| R5 customer invoice          | Engineering           | Owner-checked server projection of durable invoice mapping with minimal fields; same absent/unauthorized response; safe HTTPS URL/host validation or authenticated PDF proxy; no tokens in client. Test second-buyer denial, null URL, unavailable schema, and automatic artifact access.                                                                                                                                                                       |
| R6 tax and provider identity | Linda + Engineering   | Confirm VAT/shipping/discount rules, TRN and billing data; map them into provider payload. Existing legacy subtotal-only tax and Zoho before-tax discount settings may diverge. Provider-calculated totals must match in cents before payment sync.                                                                                                                                                                                                             |
| R7 worker operations         | Engineering + Founder | Validate private schema exposure to server only, worker authentication/scheduler, leases, cross-order customer creation concurrency, OAuth refresh, expired token recovery, alerting, refund/credit-note policy. No scheduler or OAuth activation in this PR.                                                                                                                                                                                                   |

These are hard blockers, not completed implementations. The offline harness does not
substitute for HTTP route, real database, provider sandbox or customer UI certification.

## 2. Production migration ledger

Read-only Supabase `list_migrations` for `wlrfknmrhowldygmvtvn` on 2026-09-12:

| Production version | Migration name                              |
| ------------------ | ------------------------------------------- |
| 20260713223138     | revoke_public_rls_auto_enable_execution_a1  |
| 20260713230958     | commerce_foundation_a2                      |
| 20260713231133     | private_admin_boundary_a2                   |
| 20260713234156     | public_read_policy_boundary_a2              |
| 20260809221200     | place_cod_order_v1                          |
| 20260819181510     | cm_com_4a_post_order_lifecycle              |
| 20260819202909     | cm_launch_1_lifecycle_acl_hardening         |
| 20260819215938     | cm_launch_1_notifications_canonical         |
| 20260820204004     | cm_launch_1_l3p_admin_product_management    |
| 20260820225944     | cm_launch_1_l5r_canonical_b2b_lead_pipeline |
| 20260820230032     | cm_launch_1_l5r_pipeline_operations         |
| 20260820230100     | cm_launch_1_l5r_quote_draft_integrity       |
| 20260821033221     | cm_launch_1_l5r_b2b_intake_anti_abuse       |
| 20260823004146     | sec_rls_1_b2b_private_rls                   |

Latest remains `20260823004146`. Production timestamps can differ from source filenames.
Never infer production application from a file in main. Refresh this ledger before applying.

## 3. Pending artifacts and exact sequence

Exact SHA-256 values are in [activation-manifest.json](activation-manifest.json).
A test verifies these against source bytes and the independent B2B contract.

1. A: `20260823023904_cm_b2b_ops_foundation_1.sql`.
2. B: `20260823040000_cm_b2b_portal_1a_boundary.sql`.
3. C: `20260823041625_cm_b2b_portal_1b_pricing_availability.sql`.
4. ZOHO: `20260828170741_cm_int_zoho_1_zero_touch_order_invoice.sql`, provider remains disabled.
5. STRIPE: `20260828180000_cm_pay_stripe_1_payment_foundation.sql`, checkout remains disabled.
6. Separately reviewed R1/R3/R4 migration gates, if introduced; publish fresh manifest/checksums.
7. Isolated provider test certification, reviewed runtime activation, controlled order, go-live approval.

Use source migration ordering for ZOHO then STRIPE. Each is an independent apply, never
an all-pending `db push`. The unrelated pending `20260822050535_cm_mcp_db2_read_boundary.sql`
is outside this activation sequence and must not be accidentally included.

For A/B/C, use the exact per-gate Founder authorization commands in
`contracts/cm-b2b-ops-prod-readiness-1.json` and run the referenced preflight/postflight SQL:
`docs/b2b/sql/gate-a-foundation-{preflight,postflight}.sql`,
`gate-b-portal-boundary-{preflight,postflight}.sql`, and
`gate-c-portal-pricing-availability-{preflight,postflight}.sql`.

A postflight must be GREEN before asking for B. B postflight and membership runtime smoke
must be GREEN before asking for C. Authorization must be new, issued after the preceding
postflight, and bound to project, exact artifact/hash and repository head. No carry-forward,
no aggregate approval. Stop after each gate; record SQL output, timestamp and advisor delta.

Existing-data-only smoke: verify anonymous denial, an authenticated nonmember denial, and
an existing active member's own account read; verify inactive member/account denial. Gate C
must return account-specific price and availability without exposing another account.
If no suitable existing fixtures exist, mark smoke BLOCKED; do not create production fixtures.
No smoke may create orders, payments, POs, stock updates or saved-list writes.

Security: compare owners, fixed search_path, function signatures, PUBLIC/anon/authenticated
EXECUTE ACLs, RLS/FORCE RLS and direct private table grants to the gate postflight. Preserve
service-only Stripe RPCs and auth.uid/account membership in portal SECURITY DEFINER code.
A service-role browser path or unexpected grant is STOP. Compare advisor deltas with the
existing B2B contract rather than accepting a new finding just because a query succeeded.

## 4. Founder authorizations

Separate exact-scope authorizations are required for A, B, C, ZOHO SQL, STRIPE SQL, each
additional migration, live Stripe secrets, live webhook registration, Zoho OAuth/provider
activation, runtime deployment/configuration, the controlled money/order operation, final
go-live, and any later DNS/Shopify cutover. PR merge also requires exact-head authorization.
A merge approval does not authorize any production operation.

For each non-B2B migration, prepare this record before requesting authorization:
`gate, projectRef, sourceFilename, sha256, repositoryHead, preflightArtifact,
predecessorPostflightArtifact, scope=one migration, stopAfterPostflight=true`.
The Founder response must identify that exact record. A changed hash/head invalidates it.
Do not execute on silence, a historical approval, or a checklistComplete result.

## 5. Linda / Intermex inputs

- Stripe account owner, AED capability, test versus live account/mode, canonical HTTPS origin,
  payment method policy and controlled-order buyer/product/amount/refund intent.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` through approved server secret storage only.
  Hosted Checkout redirects do not need a browser publishable key in this implementation.
- Zoho **Books or Invoice**: currently UNKNOWN; organization ID, region/data-center API and
  OAuth accounts hosts, confirmed product/plan sandbox availability and isolated organization.
- OAuth client ID/secret, redirect URI, refresh-token custody/rotation, authorized operator,
  and product-specific contacts/invoices/customerpayments read/create/update scopes.
  Choose least privilege from the selected product documentation; do not activate OAuth here.
- Legal issuer name/address/TRN, customer TRN/billing mapping, VAT IDs, inclusive/exclusive tax,
  shipping taxation, discount tax ordering, rounding and credit-note/refund handling.
- Customer mapping key and duplicate-resolution policy (email search is not a unique identity),
  invoice numbering owned by Zoho, canonical order number in reference_number,
  and external invoice/payment reference recovery policy.
- Worker scheduling/ownership, failure alert recipient, support process and invoice URL/PDF access.

Runtime names already implemented: `CORNERMEX_ZOHO_PRODUCT`,
`CORNERMEX_ZOHO_ORGANIZATION_ID`, `CORNERMEX_ZOHO_API_BASE_URL`,
`CORNERMEX_ZOHO_ACCESS_TOKEN`, `CORNERMEX_ZOHO_VAT_TAX_ID`,
`CORNERMEX_ZOHO_LIVE_WRITES_ENABLED`, `CORNERMEX_INTEGRATION_WORKER_SECRET`.
Presence is not validation, and compile-time `ZOHO_LIVE_ACTIVATION_AUTHORIZED=false` remains.

## 6. Stripe checklists

### Preflight

- Close R1–R4; prove transactional order creation and correct AED totals in an isolated database.
- Verify reviewed hash, target and ledger absence; run [provider-preflight.sql](provider-preflight.sql).
- Check existing Stripe references for duplicates before the migration's unique index.
- Resolve multiple paid attempts, missing metadata and refund-history inconsistencies before apply.
- Document test/live separation and mode rejection; do not mix account keys or webhook secrets.
- Confirm `CORNERMEX_CHECKOUT_ENABLED`, `CORNERMEX_REAL_PAYMENT_EXECUTION_ENABLED`,
  `CORNERMEX_PUBLIC_APPLICATION_URL` remain disabled/unactivated until their own approval.

### Production apply and postflight

Obtain the STRIPE-specific authorization; apply only the exact reviewed migration. On
uncertain transaction outcome stop, reread ledger and inspect objects; do not retry blindly.
Run [provider-postflight.sql](provider-postflight.sql), verify private ledger ACL/RLS and
all four public cm*pay*\* function grants. Keep provider flags disabled. A SQL postflight
alone cannot validate credentials, delivery or payment.

Endpoint: `POST /api/public/stripe-webhook`. Expected event subscriptions:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
Validate byte-for-byte signature handling, invalid signature rejection, event ledger,
exact session/attempt/order/intent IDs, amount/currency, duplicate replay, delayed failure,
partial/full refunds, decreasing refund replay and provider outage recovery.
Do not register a live webhook in this task.

### Test-mode and controlled-live flow

After isolated credentials and R1–R4 are approved, create an actual hosted test Session via
the customer flow, pay with a documented Stripe test method, retain the event ID and prove
one canonical order/attempt plus ledger entry. Replay the same event and verify no duplicate
effects. Exercise failure, expiry, refund and network ambiguity. Test redirect spoofing.
Then follow TEST 4 below under a separate exact controlled-order authorization.

## 7. Zoho checklists

Preflight: confirm product/org/region/scopes/tax and R3/R5–R7. Verify reviewed hash and ledger
absence; inspect preflight SQL. Keep worker disabled and compile-time gate false. Migration
activation does not authorize customer/invoice writes. Read existing queue size before apply
and before worker activation; never indiscriminately drain historical jobs.

After the separate ZOHO apply, run postflight SQL and verify all job/mapping/audit RLS/ACLs,
trigger, unique dedupe/entity constraints and claim function service-role access. Capture
existing-data counts without inserting anything. Validate server access to private schema
without granting browser access. Authorize credential/provider deployment separately.

For testing, Books documents a sandbox API; confirm availability for the actual account and
region. Do not assume Invoice has an equivalent sandbox. Use an approved isolated test
organization only if supported and explicitly provisioned. Otherwise mark provider test
BLOCKED; local fakes are not a substitute.

Test paid order → confirmation → durable job → customer mapping → exactly one invoice →
AED/reference/total reconciliation → payment sync → linked customer artifact. Simulate lost
responses, 429, 5xx, token expiry, crash/lease expiry, duplicate jobs, duplicate external
matches and two orders for the same new customer. Invalid tax/mapping must require attention.
No Zoho result may update canonical Stripe payment state. Reconcile each create response;
PDF capability alone is not evidence that an owner can access an artifact automatically.

## 8. Certification and evidence

Run `npm run test:intermex-go-live-1` for deterministic offline checks; existing Stripe and
Zoho suites add failure/retry/refund coverage. These fixtures use real local signature
verification and injected accounting fakes; they make no network calls or production writes.
Run canonical migration replay and `CM_PAY_POSTGRES_TEST=1 npm run test:cm-pay-stripe-1`
only on a disposable local/CI database. The latter is opt-in and inserts synthetic rows.

| Test                 | Required evidence                                                                                                   | Current state                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1 internal/no-money  | Available product/cart via read-only app; canonical fixture validation; disabled provider paths; no outside effects | Offline fixture coverage added; actual storefront/cart and DB certification still required |
| 2 Stripe test        | Actual hosted Session, signed HTTP delivery, canonical database state and reconciliation; duplicate replay          | Offline verifier/policy coverage only; real provider flow BLOCKED by R1–R4                 |
| 3 Stripe + Zoho test | Durable paid-order job, customer/invoice mapping, invoice/payment reconciliation, admin and customer artifacts      | Offline fake integration passes; actual flow BLOCKED by R3/R5–R7 and product/credentials   |
| 4 production         | Founder-gated single controlled order, all below                                                                    | NOT EXECUTED; runbook only                                                                 |

TEST 4 procedure (never automated by this repository):

1. Close R1–R7, all migration postflights, provider tests and critical incidents. Freeze exact
   deployment head, project, Stripe account/mode, Zoho organization, product/variant, buyer,
   AED cents/VAT breakdown and maximum one charge/invoice in a controlled-order request.
2. Obtain new Founder authorization for that exact request, including provider side effects
   and approved containment/refund authority. A test-mode approval is not live approval.
3. Existing real customer signs in and submits one order. Retain canonical order UUID/number,
   Stripe Session/PaymentIntent/event IDs and expected cents; do not repeat checkout on timeout.
4. Observe verified webhook and ledger; require exactly one canonical order and paid attempt.
   Confirm lifecycle through the approved R3 path, then process only this order's approved job.
5. Require exactly one Zoho invoice with canonical reference, correct VAT, AED total and payment
   mapping; zero unresolved critical jobs/reconciliation discrepancies. Verify admin status.
6. Customer opens their own order and invoice/PDF automatically, without manual file handling;
   a second buyer cannot read it. Record sanitized screenshots/evidence references.
7. Recheck duplicate effects and failures, close or contain the controlled operation, and obtain
   distinct Founder go-live approval. Any mismatch stops certification; preserve identifiers.

Evidence record: exact head/deployment, project/mode/org, UTC time and expiry, operator,
Founder authorization reference, every pre/postflight output, test IDs, order/provider IDs,
amount/VAT in cents, cardinalities, reconciliation, owner-access results and rollback proof.
Store sensitive records securely; commit only sanitized references. `evaluateOperationalEvidence`
checks completeness/freshness but neither authenticates artifacts nor authorizes actions.

## 9. Containment and rollback

Before activation, name the authorized operator and secure configuration backup. For failure,
stop new checkout/session creation; pause the accounting scheduler/worker and keep Zoho write
gate disabled. Any production configuration change requires the applicable Founder authority.
Preserve webhook reception for already-created payments when safe; disabling ingestion without
capturing/replaying pending events can lose payment reconciliation. Quarantine discrepant jobs.

Never delete orders, payments, event ledgers, invoice mappings or applied migrations to hide
an incident. Do not automatically issue another invoice or refund. Inspect provider truth and
recover exactly one mapping by canonical reference; multiple matches require human resolution.
After committed SQL, prefer containment and a separately reviewed forward repair. Transaction
failure means stop and inspect actual ledger/object state. Revert code only to a schema-compatible
head under deployment approval. A B2B containment must not grant private tables or admin bypass.

## 10. Shopify cutover prerequisites

Maintain Shopify until controlled E2E certification and explicit cutover authorization.
Reconcile products, prices, inventory, open orders, customers and legal content; identify
systems of record and freeze/sync ownership to avoid double-selling. Verify domains/TLS,
redirects/SEO, payment receipts, shipping/support/refunds, monitoring and a traffic rollback.
Authorize DNS/domain work and Shopify shutdown separately after a successful rollback rehearsal.
No Railway, DNS or Shopify action is part of this readiness PR.

## 11. Definition of READY FOR OPERATIONS

All B2B A/B/C active with green postflights; Stripe migration, credentials, webhook and real
test payment validated; Zoho migration/product/credentials and invoice generation/reconciliation
validated; one controlled E2E order certified; no critical failures; documented/rehearsed
containment; and explicit Founder go-live approval for the exact deployment.

NOT_READY means implementation or evidence gaps remain. READY_FOR_ACTIVATION means R1–R7 and
local/security reviews are complete, while external gates remain. READY_FOR_CONTROLLED_E2E
requires live activation postflights and provider tests; READY_FOR_OPERATIONS additionally
requires controlled-order certification and Founder approval. This PR remains NOT_READY.

## 12. Provider references

Reviewed against official sources on 2026-09-12:
[Stripe webhooks](https://docs.stripe.com/webhooks) documents raw body verification,
duplicate deliveries and unordered events. [Zoho Books invoices](https://www.zoho.com/books/api/v3/invoices/)
documents references, totals and invoice artifacts;
[Books sandbox](https://www.zoho.com/books/api/v3/sandbox/) documents sandbox management.
Validate product-specific region/scopes and account entitlement at activation time.

## 13. Validation record for this readiness change

B2B Foundation/Portal 1A/Portal 1B/readiness, Stripe, Zoho, cm-launch-1,
Intermex storefront and brand checks passed locally. Migration ownership, canonical types,
application schema references, schema authority, deployment governance, no-Railway-writes,
scoped typecheck, build, build:railway and changed-file lint passed. Browser-secret scan
passed after build (459 public files; zero service-role secrets). Seven new offline tests
pass, including execution of the actual webhook handler with an injected database.

Limitations: `typecheck` is the repository's scoped tsconfig.a2 check, not full application
coverage. Local PostgreSQL startup was denied by sandbox shared-memory restrictions, but
CI run 34680503683 passed canonical replay, the seven new tests and the opt-in Stripe
PostgreSQL suite. These tests do not certify provider sandboxes or production orders.

The first CI run found expired shared program evidence. A fresh read-only Railway
reconciliation confirmed staging deployment `b81feb08-a966-48e7-8872-e201c1dd8108` and
production deployment `8da17bff-05b8-4fee-92a4-aa517ff9701a`, both SUCCESS at baseline main.
Production source still has checkSuites=true; governance drift remains open. No secret
values were read. The service-level variable-name lists contain no Stripe or Zoho keys;
shared/inherited secret configuration is not certified by that observation.

`docs/program/CURRENT_STATE.json` and `DEPLOYMENT_REGISTRY.json` are refreshed from
[read-only-runtime-evidence.json](read-only-runtime-evidence.json), with historical records
retaining their original scope. Program-state, deployment-governance, no-Railway-writes and
all 128 program tests now pass. No platform mutation or health endpoint/provider certification
is implied. Gate A live read-only preflight returned 9/9 green; no apply or postflight occurred.
Fresh exact-head review and CI are required for this evidence-refresh commit.
