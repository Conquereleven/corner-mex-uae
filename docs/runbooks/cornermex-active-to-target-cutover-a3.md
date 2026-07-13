# CornerMex Active-to-Target Cutover A3

This is a plan only. A2 performs no export, migration or cutover.

1. Obtain administrative access to active project `ywyiejqnbyzjfatojvkh`; export schema metadata and reconcile migration history.
2. Inventory Auth identities and providers. Password hashes and identities must not be assumed portable; use a Supabase-supported migration/reset strategy.
3. Define canonical mappings for products, variants, inventory, profiles, customers, orders, payments, reviews and Storage objects.
4. Dry-run sanitized transforms; compare checksums, row counts, foreign keys and money totals without documenting PII.
5. Plan delta capture and a short write freeze. Dual-write is prohibited.
6. Migrate Storage with object checksums and private/public policy parity.
7. Prepare Supabase Auth redirect URLs, Stripe webhook/callback URLs and email-domain configuration for staging and future production.
8. Validate checkout in Stripe test mode, RLS, SSR, assets, email sandboxing and zero unauthorized access.
9. Lower DNS TTL, schedule cutover, freeze writes, apply final delta, switch callbacks and domain, then run acceptance.
10. Keep Lovable Cloud online through the rollback window. Roll back DNS/callbacks and restore the prior host if any critical check fails.

No customer data or credentials belong in this runbook.
