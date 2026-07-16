# A3.2b CM-2A Remediation Acceptance

## Verified locally

- Base: `06d1c71d56a4e343dfeda4eaff28b2a7dba828d1`; source pin: `a8a751bdbaf2b12fef3f94c83769bac52fffbaad`.
- Fresh preview: 190 records = 148 ready + 41 review + 1 missing media; 189 media references; public exposure and inventory remain zero.
- Saved previews are recomputed from the exact pinned Git object and fail closed on source, count, classification or media fingerprint drift.
- Railway production source was observed read-only on `main` at the base commit with deployment `SUCCESS`.
- Founder decisions are resolved with Joel / Founder as rollback owner and a 48-hour observation window.

## Execution gate

Execution remains blocked. The 189 media references are safe at URL level but content validation is deferred until an explicit pre-execution run. The ephemeral PostgreSQL rollback proof must pass in CI, a fresh live read-only preflight is still required, and the exact remediation head requires independent review.

No Supabase migration, database write, Auth user, Storage object, Railway deployment, DNS change, Lovable change, catalog import, inventory activation, checkout, payment, email or customer communication occurred.
