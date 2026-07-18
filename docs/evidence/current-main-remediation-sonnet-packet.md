# Current-Main Remediation Sonnet Packet

## Review identity

- Base: `a558785d3fc2c1eb2aa9298087bba7f940094bcb`
- Sonnet prereview head: `14fd13282e7c2da71345d1172433895248aa74cb`
- Remediation implementation heads: `708f579`, `2bb9172`
- CODEOWNERS micro-remediation base: `c5a63a6e33889946b51e7082152eb27473a8ff18`
- Branch: `fix/lovable-schema-authority-main-remediation`
- Canonical Supabase: `wlrfknmrhowldygmvtvn`
- Lovable project: `d9495376-339d-44dd-9c8a-db0f7b451f96`
- PR #8 reviewed only for overlap; its head was not changed.

## Review focus

1. Confirm all 42 DB1 migrations are checksum-pinned and quarantined.
2. Confirm active DB2 replay is exactly four applied migrations, 20 tables,
   2 public functions, 20 RLS tables and 37 policies.
3. Confirm unapplied A3.2b remains pending and PR #8 must correct its
   `public.is_admin()` policy references after rebase.
4. Confirm generated types came from canonical DB2 through read-only Supabase MCP.
5. Confirm the application reference baseline permits existing Lovable-only
   runtime debt but fails on new unclassified or invalid identities.
6. Confirm `schema-authority` is a required protected-main check.
7. Confirm package/lock reconciliation retains Lovable config `2.7.6`, bridge
   `1.2.0` and HMR gate `1.1.4`.
8. Confirm the compatible Vite/Cloudflare security updates leave npm audit at
   zero Critical and zero High; one Moderate and one Low remain transitive.

## Sonnet findings closed

1. DB1 custody now records the approved founder decision and aggregate facts in
   the decision registry, architecture, acceptance and custody evidence.
2. `merged-tree-verification` is a dedicated GitHub Actions job and a strict
   required check on protected `main`.
3. Canonical type provenance now fails closed on project reference, generation
   method, generator version, timestamp and schema fingerprint drift.
4. Application schema reference classifications are reduced to the three
   reachable values and reject dead values.
5. CODEOWNERS comments now use one aligned governance explanation without
   changing ownership coverage.
6. The targeted Sonnet rereview found one new governance gap: founder-decision
   and evidence documents were outside CODEOWNERS coverage. The micro-remediation
   adds explicit playbook, governance, architecture and evidence ownership to
   both byte-identical CODEOWNERS files without changing existing rules.

## Validation evidence

- GitHub Actions run: `29630472262`
- `contract-and-migration`: passed
- `type-and-runtime`: passed
- `schema-authority`: passed
- `merged-tree-verification`: passed against the exact event merge SHA
- Focused remediation tests: 5/5 passed
- DB1 custody contract: 8 required facts preserved across 5 documents
- Canonical schema: 20 tables and 2 public functions
- Application references: 43 classified identities
- Ruleset evidence: `docs/evidence/main-ruleset-19129376.md`
- CODEOWNERS adversarial coverage verifies founder decisions, governance,
  architecture and evidence resolve to `@Conquereleven`; missing coverage,
  copy divergence and later ownership overrides fail closed.

The evidence-only commit containing this packet necessarily cannot embed its
own final SHA. The exact final PR head is recorded in PR #9 and the final
remediation report after push.

## Safety

No database, Auth, Storage, Railway, Lovable runtime, DNS, checkout, payment or
communication write was performed. The proposed PR must remain draft and must
not be merged before independent review.

The only platform governance write was the approved update to GitHub ruleset
`19129376`, adding `merged-tree-verification` after its first successful run.
