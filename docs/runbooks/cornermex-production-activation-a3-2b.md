# CornerMex production activation runbook A3.2b

This runbook is not authorization. A3.2b is separate from A3.2a.

## Entry gates

- A3.2a merged and Claude Code approves the exact head
- founder gives explicit activation authorization
- fresh live read-only verification is complete and unexpired
- exact commit, Railway project/environment/service, source branch, schema fingerprint, callbacks, and rollback anchor are recorded
- no unresolved Critical/High finding
- all required founder decisions are answered
- rollback owner, observation owner, support plan, and objective thresholds are assigned

## Sequence

1. Freeze configuration changes and record all fingerprints.
2. Create or confirm the Railway production environment only if authorized; do not create duplicate services.
3. Enter values through the secure platform UI. Confirm every action flag remains false.
4. Deploy the exact reviewed commit and verify root, `/api/health`, `/api/ready`, SSR routes, and built assets.
5. Perform Auth or Storage bootstrap only under separate explicit authorization and their dedicated gates.
6. Keep catalog and inventory empty unless separately authorized.
7. Change callbacks and DNS only under separate explicit authorization and immediately validate them.
8. Begin the named observation window and record metrics and incidents.

## Rollback triggers

Rollback on health/readiness or SSR failure; asset failure; Auth/session/RLS regression; secret exposure; unexpected product, inventory, order, or payment state; exposed payment path; callback failure; DNS/TLS failure; or error/latency above founder-approved thresholds.

## Rollback

Stop target writes, disable production flags, restore prior callbacks and host/DNS when changed, retain Lovable as anchor until observation closes, preserve logs, reconcile all created state, and open an incident record. The rollback owner confirms completion.

## Prohibitions

No dual-write, CornerOps direct write, OpenClaw, unreviewed commit, automatic catalog/inventory activation, or payment enablement without a separate gate.
