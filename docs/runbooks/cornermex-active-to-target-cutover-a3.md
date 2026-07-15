# CornerMex Canonical Activation A3.2

This runbook activates the canonical greenfield project `wlrfknmrhowldygmvtvn`. The retired `ywyiejqnbyzjfatojvkh` project is not a migration source. Lovable Cloud remains the rollback host until the observation window closes.

## Pre-Cutover Requirements

- final greenfield mapping approved;
- independent Claude Code review complete and critical findings resolved;
- founder authorization recorded;
- target hardening migrations approved, applied and verified only in A3.2;
- Auth enrollment strategy and Storage activation strategy approved;
- Stripe test-mode validation complete;
- payment callback, webhook and Auth redirect inventories complete;
- email requirements and DNS TTL preparation documented;
- support/communication plan approved;
- authenticated read-only target clean-state verification completed immediately before activation, within the evidence validity window;
- rollback, cutover and observation-window owners assigned;
- no production data load unless a separate reviewed source contract exists.

## Activation Sequence

1. Announce the maintenance/write-freeze window.
2. Confirm Lovable production writes are blocked for the activation window.
3. Record the exact freeze timestamp in UTC.
4. Run the authenticated read-only clean-state query against `wlrfknmrhowldygmvtvn`; stop if the evidence is expired, unavailable or differs from the committed contract.
5. Record final canonical row counts and the query timestamp.
6. Record aggregate monetary totals, expected to be zero before launch.
7. Record schema and integrity checksums.
8. Confirm no legacy static/reference export exists.
9. Confirm no eligible legacy commerce export exists.
10. Validate the approved greenfield mapping.
11. Load approved static/reference data only if separately reviewed.
12. Load approved categories, products and variants only if separately reviewed.
13. Load explicitly verified commercial inventory only; never stock-50 or planning stock-100.
14. Confirm customer/profile migration is not applicable; use approved enrollment.
15. Confirm orders/order-items remain empty before controlled launch.
16. Confirm payments/refunds remain empty before controlled launch.
17. Load approved reviews/promotions only when backed by a reviewed source.
18. Create approved Storage buckets/media with checksums and policy parity.
19. Configure approved Auth providers and founder enrollment.
20. Confirm no source delta exists.
21. Run full reconciliation.
22. Confirm zero unexplained row-count differences.
23. Confirm monetary totals within zero minor-unit tolerance.
24. Confirm zero unexpected orphan records.
25. Confirm target RLS, functions and grants.
26. Switch production environment variables to the canonical project.
27. Switch Supabase Auth redirects/callbacks.
28. Switch Stripe callbacks/webhooks.
29. Configure approved production email callbacks.
30. Deploy the independently accepted Railway production commit.
31. Verify `/api/health`.
32. Verify `/api/ready`.
33. Verify SSR and static assets.
34. Verify founder and customer authentication.
35. Verify product browsing.
36. Verify cart behavior.
37. Verify checkout in approved controlled mode.
38. Verify order creation.
39. Verify payment reconciliation.
40. Switch DNS.
41. Run full production acceptance.
42. Begin the observation window.
43. Preserve Lovable Cloud as rollback anchor until the window closes.

## Objective Rollback Triggers

Rollback immediately for any RLS/unauthorized-access regression, public administrative function exposure, payment/order/refund reconciliation mismatch above zero minor units, missing approved product/variant/inventory/media count, broken Stripe/Auth callback, TLS/DNS failure or inability to reach the previous host.

Rollback when any five-minute window exceeds:

- authentication failures: 5% or 5 attempts, whichever occurs first;
- password-reset/OAuth callback failures: 2 consecutive failures;
- checkout/order creation failures: 2 consecutive controlled attempts or 2%;
- HTTP 5xx: 1% with at least 5 requests;
- client-breaking errors: 2 reproducible sessions;
- Storage access failures: 2 consecutive approved-object checks;
- p95 health/readiness latency: 2 seconds for 10 minutes;
- unresolved source/target divergence: any non-zero unexplained count.

## Rollback Sequence

1. Stop new writes on canonical production.
2. Preserve logs and audit evidence.
3. Record rollback decision time.
4. Restore prior payment callbacks/webhooks.
5. Restore prior Auth redirects/callbacks.
6. Restore prior DNS/production host.
7. Disable canonical production writes.
8. Retain canonical target only for safe forensic inspection.
9. Reconcile writes created during the window.
10. Reapply eligible writes to the restored system only through approved controls.
11. Communicate rollback status.
12. Open an incident record.
13. Document root cause.
14. Require resolution and independent review before retry.

## Prohibitions

Dual-write and automatic bidirectional sync are prohibited. CornerOps may not bypass CornerMex ownership or write directly to its database. OpenClaw cannot participate without separate approval. No data load, migration or cutover occurs without final founder approval or while critical independent-review findings remain open.
