# Current-Main Remediation Acceptance

## Identity

- Assignment: Lovable schema authority current-main remediation after Fable 5
- Base SHA: `a558785d3fc2c1eb2aa9298087bba7f940094bcb`
- Branch: `fix/lovable-schema-authority-main-remediation`
- Main ruleset ID: `19129376`
- Lovable branch: `lovable/live` at the audited base SHA

## Results

- Migration ownership: 42 Lovable DB1 files quarantined; 4 applied DB2 files active; 1 unapplied A3.2b file pending.
- Canonical types: read-only generated from `wlrfknmrhowldygmvtvn`; 20 tables.
- Fingerprint: `f22d3d0db035425ab326aa791ec3de915d8e4e23c522755e84bfacb5eb89e8c5`.
- Replay: 20 public tables, 2 public functions, 20 RLS tables, 37 policies.
- Runtime references: 43 identities classified; existing Lovable-only references documented.
- Package lock: Lovable config `2.7.6`, dev-server bridge `1.2.0`, HMR gate `1.1.4`.
- Dependency security: Vite `7.3.6` and Cloudflare Vite plugin `1.45.1`; npm audit reports 0 Critical and 0 High (1 Moderate, 1 Low transitive remain).
- Lovable retargeting: not verified; published runtime remains at audited SHA.

## PR #8 gate

PR #8 remains draft and untouched. After this remediation is independently
approved and merged, PR #8 must be rebased. Its pending migration must use the
private admin helper correctly, pass merged-tree replay and receive a fresh
exact-head review before any merge or execution.

## Platform safety

No production deployment, Supabase write, Lovable Cloud write, Railway write,
Auth/Storage change, catalog import, inventory activation, DNS, checkout,
payment or communication occurred.
