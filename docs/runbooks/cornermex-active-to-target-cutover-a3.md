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
- final target clean-state verification complete;
- rollback, cutover and observation-window owners assigned;
- no production data load unless a separate reviewed source contract exists.

## Activation Sequence

1. Announce the maintenance/write-freeze window.
2. Confirm Lovable production writes are blocked for the activation window.
3. Record the exact freeze timestamp in UTC.
4. Record final canonical row counts.
5. Record aggregate monetary totals, expected to be zero before launch.
6. Record schema and integrity checksums.
7. Confirm no legacy static/reference export exists.
8. Confirm no eligible legacy commerce export exists.
9. Validate the approved greenfield mapping.
10. Load approved static/reference data only if separately reviewed.
11. Load approved categories, products and variants only if separately reviewed.
12. Load explicitly verified commercial inventory only; never stock-50 or planning stock-100.
13. Confirm customer/profile migration is not applicable; use approved enrollment.
14. Confirm orders/order-items remain empty before controlled launch.
15. Confirm payments/refunds remain empty before controlled launch.
16. Load approved reviews/promotions only when backed by a reviewed source.
17. Create approved Storage buckets/media with checksums and policy parity.
18. Configure approved Auth providers and founder enrollment.
19. Confirm no source delta exists.
20. Run full reconciliation.
21. Confirm zero unexplained row-count differences.
22. Confirm monetary totals within zero minor-unit tolerance.
23. Confirm zero unexpected orphan records.
24. Confirm target RLS, functions and grants.
25. Switch production environment variables to the canonical project.
26. Switch Supabase Auth redirects/callbacks.
27. Switch Stripe callbacks/webhooks.
28. Configure approved production email callbacks.
29. Deploy the independently accepted Railway production commit.
30. Verify `/api/health`.
31. Verify `/api/ready`.
32. Verify SSR and static assets.
33. Verify founder and customer authentication.
34. Verify product browsing.
35. Verify cart behavior.
36. Verify checkout in approved controlled mode.
37. Verify order creation.
38. Verify payment reconciliation.
39. Switch DNS.
40. Run full production acceptance.
41. Begin the observation window.
42. Preserve Lovable Cloud as rollback anchor until the window closes.

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
