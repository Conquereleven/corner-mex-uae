# Zoho test activation — 2026-09-15

Status: **READ-only OAuth provisioned; existing-invoice API verification complete. Not activated for automatic invoicing.** Base: `627704cb4acb4359a7c15a4b8bf752943e901053`.

## Verified real configuration

See `observed-facts.json` for IDs copied from authenticated UI routes and displayed values. They are evidence, not an executable mapping set. Organization `773588238` is the production Trading organization. Catering `861471618` is also listed; neither is labelled as sandbox. No separate test organization was verified. Do not reuse a real organization as a test org.

Books is served from `books.zoho.com`; official data-center documentation maps this to US `.com`, API `https://www.zohoapis.com/books/v3` and Accounts `https://accounts.zoho.com`. This is independent of the UAE legal/tax locale. Profile confirms UAE, Dubai, AED, Asia/Dubai, January–December fiscal year and Accrual basis. Profile also reports the same organization in Zoho Inventory; this requires an integration audit before the operational cutover, not a change in authority today.

Customer MAF has VAT Registered, TRN `100347258400003`, AED, Dubai member state and Due on Receipt. Billing text: MAF TOWER 1, Port Saeed, Deira, Dubai, 60811; Dubai, United Arab Emirates. No shipping address; an additional Wafi address exists. No Ajman address ID was observed. Locations is disabled. Ajman in the PO reference is a delivery label, not a verified Zoho warehouse ID. Do not infer tax place of supply from that label.

Item `3142388000022781335` is active in the active-items list, displayed as `PR 0077 Sweet Nachos 1kg`, Sales Items, kg, Taxable, AED47.00. The separate SKU column was blank; PR 0077 is present in the name, not proven as API `sku`. Default Standard Rate 5% is `3142388000000075192`; Zero Rate is `3142388000000075194`.

Invoice `3142388000023527010`, number `41237`, already exists for `B202609-37789 AJMAN CITY CENTRE CINEME STORE`, dated 2026-09-13. UI confirms quantity 2.50 kg, rate 47.00, taxable 117.50, VAT 5.88, total/balance 123.38, status Overdue, Due on Receipt. Seller TRN `100491647200003`; template Standard Template. This PO must never be created again. A test must use read-only reconciliation of this invoice or a verified separate test organization with different IDs.

Number series has no invoice prefix and displayed 41289 as the next number. This is a time-specific observation, never an assigned invoice number. Invoice custom-field usage 0/135; standard fields Discount, Terms & Conditions and Subject active, E-Commerce Operator inactive. Payment terms include case/spelling duplicates of Due on Receipt and Net 15/30/45/60; do not resolve by fuzzy label.

API usage showed n8n, 9 GET calls today (5 Item, 4 Invoice), 4991/5000 remaining. This proves an existing integration, not permission to reuse its secrets/scopes. After user reauthentication and explicit approval, created a Self Client with contacts.READ, settings.READ and invoices.READ only. Token exchange confirmed the .com API domain. Credentials stored in Railway; temporary downloaded credentials and token files deleted after transfer and verification. OAuth scopes are user-level; the read-only bridge restricts calls to organization 773588238.

## Production verification and exact mutations

Railway service `6702af28-5689-46fb-8896-b5a8b1fbba94`, project `06d2ecdd-3c03-4480-8299-48c539595a94`, environment `8f35b59c-7446-4514-a307-0b329ec62bd1`: deployment `012b137c-3b29-4d79-8c9f-1ff5177d7617` SUCCESS. `/api/health` confirms runtime Node and commit `627704cb4acb`. Unauthenticated POST accounting-worker returns 401, no job executed. No worker scheduler was verified; service cron is null and worker secret absent from variable names.

Provisioned 11 server variables: MODE=test, LIVE_WRITES_ENABLED=false, PRODUCT=books, ORGANIZATION_ID, VAT_TAX_ID, API_BASE_URL (origin only), ACCOUNTS_URL and OAuth client/access/refresh secrets. Railway acknowledged the writes with skipDeploys=true. They apply on the next deployment; no deployment or live enable was performed. No PO mappings were inserted. Access tokens expire; refresh must occur server-side before a later verification run. READ scopes cannot create invoices even if a downstream caller attempted a write.

Supabase `wlrfknmrhowldygmvtvn`: `cm_runtime_capabilities_v2()` returns schemaVersion 2, empty gates. Five PO tables exist, RLS enabled+forced. Both PO RPCs are SECURITY DEFINER with closed search_path, executable by service_role, not anon/authenticated. 0 intakes and 0 mappings. Migration history is `20260914133036_intermex_po_automation_1` (correct spelling from database). No DB mutations in this task.

Existing worker runtime requires live-writes true and an unexpired gate. PO has an additional code hard stop. Both remain intact. Test does not relax either control.

## New code and verification

`src/lib/zoho-readonly.server.ts` offers only invoice GET/search, exact allowlisted regional API host and organization scope, test mode + explicit live-writes false. It returns no mutation methods, rejects redirects and does not refresh/exchange tokens. `reconcileExistingPo` has no store or create fallback; missing/multiple invoices stop safely. Full reconciliation still requires a complete approved mapping; unknown IDs are not filled in.

`scripts/intermex-zoho-test-activation/inspect-existing.mjs` reads the existing real invoice using `CORNERMEX_ZOHO_READONLY_ACCESS_TOKEN` from server environment. It compares observed customer, reference, date, terms, TRN, item/tax, quantity/rate and totals, emits only check outcomes, and explicitly does NOT claim full billing/supply reconciliation. It never runs the worker or writes to Supabase. Authenticated GET verification passes for all 14 checks, with zero accounting writes. See api-check-result.json. Contact API confirms billing address ID 3142388000022781328; existing invoice confirms place_of_supply DU. Item API confirms blank sku and kg unit ID 3142388000000075026. Books invoice uses tax_reg_no; reconciliation now accepts that field or the legacy vat_reg_no, and rejects conflicting aliases. This verifies the existing invoice, not original-PDF ingestion or automatic invoice creation.

Validation: 7 new tests pass; 70 existing Zoho/PO/GO-LIVE-2 tests pass, 2 PostgreSQL-dependent tests skipped. Focused strict TypeScript check passes. No migration/schema changes require replay in this change. Existing tests use clearly synthetic mappings. Real IDs remain separate evidence. The source PO PDF was not provided to this task, so original-PDF certification remains open.

Run after safe READ-only credential provisioning, without putting tokens in shell arguments/history:

```
CORNERMEX_ZOHO_MODE=test CORNERMEX_ZOHO_LIVE_WRITES_ENABLED=false node --experimental-strip-types scripts/intermex-zoho-test-activation/inspect-existing.mjs
```

Token must already be injected securely into server environment. Never prefix secrets with VITE_, include them in evidence JSON or paste them into chat. READ access expires; provision/refresh it separately under explicit credential custody. Keep this command operator-only, without public route.

## Next concrete steps

1. Credentials and observed mappings are now available as server secrets and non-executable evidence respectively. No further login or temporary-file approval is needed for this completed step.
2. Review and deploy the prepared bridge before using it from the deployed service; secrets are staged for the next deployment. Retain test mode and live writes false.
3. Obtain the original PO PDF for parser certification and approve tax-place policy for future POs. DU is the observed value on this existing invoice; it is not a general tax determination for all Ajman deliveries.
4. No automated accounting writes until a separate verified test organization exists and has its own IDs and reviewed activation. Without it, retain read-only/offline tests. New production invoices require separately authorized new POs and live activation.

Sources: [Zoho data centers](https://www.zoho.com/books/api/v3/introduction/#multiple-data-centers), [OAuth](https://www.zoho.com/books/api/v3/oauth/), authenticated UI evidence above, live Railway/Supabase read-only results. Supabase changelog checked; no relevant API or schema breaking change used here.

## ZOHO-TEST-ACTIVATION-2 — pre-merge verification (2026-09-16)

Scope: isolated from local work based on `627704cb4acb4359a7c15a4b8bf752943e901053`. INTERMEX-OPS-1 remains an unimplemented design in the original workspace and is excluded from this PR. This report and the adjacent JSON files preserve historical read-only evidence; the 14 checks were not rerun against Zoho during this phase.

Safety: no Zoho API calls, invoice creates/updates, provider gate changes, Railway variable changes, deployments or merge performed in this phase. The read-only factory requires exact `CORNERMEX_ZOHO_MODE=test` and `CORNERMEX_ZOHO_LIVE_WRITES_ENABLED=false`. Historical evidence records those staged Railway values. A fresh Railway connector read confirms both variable names but redacts values; therefore current deployed values are not certified here. A missing/expired read token fails closed and requires separate server-side credential provisioning before the future smoke.

Local validation:
- Zoho activation: 7/7 PASS. Independent related PO/GO-LIVE-2 review run: 61 PASS, 2 PostgreSQL tests skipped locally.
- Full discovered suite initial run: 749 PASS, 4 FAIL, 4 SKIP (757 tests). Three failures are legacy UI assertions, reproduced unchanged on base main (cm-com-1a: two; cm-com-4a: one). The fourth was invocation/environment-dependent remediation testing; rerun with npm executable and writable cache: all 6 remediation tests PASS. No unrelated UI changes added.
- Changed-file lint: PASS, zero errors in all four changed code/test files. Global lint: 3275 errors, 17 warnings, exactly matching clean base.
- Canonical `npm run typecheck`: PASS. Strict focused TypeScript for bridge/reconciliation: PASS. Global `typecheck:full`: same diagnostic set as clean base.
- Default and Railway builds: PASS with `NODE_OPTIONS=--max-old-space-size=8192`; initial default-memory attempts exhausted the local heap. SSR async-context validation: PASS.
- GitHub CI remains the authority for fresh dependency installation, PostgreSQL tests, schema replay and proposed merge-tree checks. Final head/check/reviewer evidence is attached to the PR.

Certification boundary: this PR prepares the read-only code and evidence for Founder review. `ZOHO_READ_ONLY_RUNTIME_CERTIFIED` is NOT claimed before an authorized exact-head merge, deployment and successful read-only smoke from Railway. No merge authorization is implied by CI or reviewer PASS.
