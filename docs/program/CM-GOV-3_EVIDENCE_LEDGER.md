# CM-GOV-3 Evidence Ledger — Accidental Railway Project `pr21-head`

Observed: `2026-08-08T00:45:00Z` · Founder confirmation recorded: `2026-08-07T19:35:00-06:00`

## Subject

| Field                      | Value                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Accidental Railway project | `pr21-head`                                                                                  |
| Project ID                 | `1a30d4d7-2ad6-4ba1-b274-8769a9eecd38`                                                       |
| Accidental service ID      | `9419a3d9-8cae-4ee2-9ef2-b343ac80b39a`                                                       |
| Accidental deployment      | `24baae0a-6f03-498f-9f6a-4db47a40dcf8`                                                       |
| Origin                     | Created 2026-08-07 by an unlinked `railway up` during the PR #21 production remediation flow |

## Previously observed agent evidence (pre-deletion, read-only)

The implementing agent verified before deletion, via Railway CLI:

- distinct project ID from the CornerMex production project (`06d2ecdd-3c03-4480-8299-48c539595a94`);
- distinct service ID from `corner-mex-uae` (`6702af28-...`) and from `cornermex-web` (`5a6b85da-...`);
- exactly one accidental deployment; no intended production domain;
- no reference in `DEPLOYMENT_REGISTRY.json` or deployment governance;
- no role in any rollback path (all rollback anchors live in the CornerMex UAE project).

Deletion was then performed during CM-GOV-3 implementation and confirmed by
Railway reporting `Project is deleted.` on a follow-up status query, with a
retry returning `Project not found`.

## Founder confirmation

The Founder explicitly confirms the deletion of `pr21-head`
(`1a30d4d7-2ad6-4ba1-b274-8769a9eecd38`) for the audit trail, recorded at
`2026-08-07T19:35:00-06:00` alongside `FD-CM-PROD-EXACT-HEAD-001`.

## Independent post-deletion continuity

Independent review (Opus) did not — and could not — directly observe the
Railway deletion; its verification was limited to production continuity:
the CornerMex production service remained reachable and healthy after the
deletion, serving the ratified deployment `18dc25e0-1244-44ff-9e66-3a5cc1f02208`
at source `c9f82892b4bb...`. No claim of independent observation of the
deletion itself is made by this record.
