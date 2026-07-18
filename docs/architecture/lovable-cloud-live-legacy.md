# Lovable Cloud Live Legacy

DB1 status is `live_legacy_production`. Joel / Founder is the business-data
custodian. At the approved decision point it contained 150 products, 4 orders,
7 Auth users and 1 seller. These are aggregate counts only; no PII, identities
or order contents are stored in this repository. Final disposition is deferred
and no destructive action is authorized.

The May-July 2026 migration lineage describes Lovable Cloud DB1, not canonical
CornerMex DB2. It remains immutable in `supabase/legacy-lovable/` with checksums
and evidence in the ownership contract. Git moves preserve history.

Active migrations under `supabase/migrations/` describe the applied canonical
20-table DB2 baseline only. The unapplied A3.2b catalog foundation is isolated
under `supabase/pending-canonical/` pending PR #8 rebase and review.

No migration was applied to either database during this remediation.
