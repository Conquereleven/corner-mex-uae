# CornerMex production readiness A3.2a

## Decision

`a3_2a_valid_but_blocked`. This sprint prepares evidence and gates only. It does not activate production.

## Observed baseline

- Source commit: `100bb57fc92938a0b803c088abf57a03fa1e8a27`
- Canonical Supabase project: `wlrfknmrhowldygmvtvn`, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.141`
- Database: 20 public tables, 20 with RLS, 37 policies, zero Auth users, zero Storage objects and zero commercial rows
- Schema fingerprint: `ffce61d5cca7d6e92699f72f4e593bb1`
- Railway: project `06d2ecdd-3c03-4480-8299-48c539595a94`, staging, service `cornermex-web`, HTTP 200 for root, health, readiness and one asset
- Production Railway environment: absent; duplicate service: absent
- Lovable Cloud remains the documented rollback anchor; its runtime metadata was not independently verified
- CornerOps remains a separate read-only system; OpenClaw and CornerOps writes remain disabled

Evidence was observed at `2026-07-15T14:49:24-06:00` and expires at `2026-07-16T14:49:24-06:00`. After expiry it is historical, not current.

## Environment contract

Only variable names are documented. `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are required for readiness. `CORNERMEX_APPLICATION_ENV`, `CORNERMEX_PUBLIC_APPLICATION_URL`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are server configuration. No secret may use a `VITE_` prefix.

The following default to false and accept only `true` or `false`: marketplace, seller auth, payouts, commissions, checkout, real payment execution, external email, external messages, automatic import, automatic inventory sync, OpenClaw, and CornerOps writes. Real payment execution additionally requires checkout, a public application URL, and both Stripe server secrets.

`/api/ready` reports only reachability, missing variable names, sanitized validation errors, and boolean capability status. It does not expose URLs or credentials.

## Blockers

- 11 founder decisions remain unanswered; only Railway production-environment execution for A3.2b and the 14-day Lovable rollback window are approved
- rollback owner is unassigned
- Railway source branch is not verified
- Lovable runtime metadata is not independently verified
- custom-domain metadata was not checked

Run `npm run verify:a3:activation-readiness` for committed evidence. Live mode is separate, explicit, read-only, and requires an injected approved adapter; it never silently falls back to static evidence.

## Approved founder decisions

- Railway production environment: approved for A3.2b execution only. It is not created, activated, or deployed. All runtime action flags remain false.
- Lovable rollback: approved for 14 full days after a successful future cutover. Cutover has not occurred, the window has not started, and Lovable remains the unmodified rollback anchor.

Decision timestamp: `2026-07-15T15:21:27-06:00`. Decider: Joel / Founder.
