# Migration Rehearsal Security A3

- The canonical Supabase project is inspected read-only during A3.1.
- No service-role key, database password, connection string, customer row or Storage path is committed.
- Rehearsal uses deterministic synthetic data and writes only to memory/stdout.
- Synthetic output is inactive, zero-stock and non-transactional.
- The privacy guard scans changed A3 artifacts for database URLs, JWTs, Supabase/Stripe secrets, bearer tokens and email addresses.
- Temporary exports, dumps, rehearsal output, local volumes, manifests, CLI state and credentials are ignored.
- Target clean-state verification requires zero business/Auth/Storage data and zero rehearsal schemas.
- Logs may include contract checksums and aggregate counts only.
- Cleanup proof is the absence of generated files and `a3_rehearsal_*` schemas.

Reviewers must rerun all A1/A2/A3 gates, inspect the fixture and transformation code, verify target aggregates independently and confirm no migration was applied.
