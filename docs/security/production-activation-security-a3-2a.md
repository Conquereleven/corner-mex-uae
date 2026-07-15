# Production activation security A3.2a

A3.2a is read-only hardening. Production, DNS, callbacks, Auth, Storage, checkout, payments, imports, external communications, OpenClaw, and CornerOps writes remain disabled.

## Controls

- strict readiness contract binds project, service, schema fingerprint, zero state, evidence time, blockers, and rollback anchor
- expired or contradictory evidence fails closed
- CI runs static evidence only; live mode requires an explicit read-only adapter and never falls back
- action flags accept only `true` or `false` and default false
- payment execution requires checkout, public application URL, and server-only Stripe configuration
- browser-prefixed secrets are rejected; service-role material is prohibited in client code
- `/api/ready` exposes only sanitized status and booleans
- privacy guard detects bearer, Supabase, Railway, OAuth, email-provider, private-key, and credential canaries without echoing values

## Remaining risks

Railway source branch and Lovable runtime metadata are not verified. Performance advisors remain open for a later reviewed migration. All founder decisions and the rollback owner remain unresolved. These conditions block A3.2b.

Any suspected secret disclosure stops activation: revoke/rotate through the owning platform, preserve sanitized evidence, inspect history and artifacts, and rerun the complete gate before review.
