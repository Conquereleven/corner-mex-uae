# Founder Decisions Index

Observed: `2026-07-22T00:43:40Z`

| Decision                                | Status                                 | Scope                                                              | Repository authority                                                           | Execution state                                                                                     |
| --------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `FD-CM-A3.2B-EXEC-001`                  | approved with exact gates              | A3.2b production foundation                                        | `docs/engineering-playbook/founder-decisions/FD-CM-A3.2B-EXEC-001.md`          | blocked pending exact-head review, fresh preflight, green deployment and remaining gates            |
| `FD-CM-LOVABLE-GOV-001`                 | binding                                | Lovable governance and authority boundary                          | `docs/engineering-playbook/founder-decisions/FD-CM-LOVABLE-GOV-001.md`         | Lovable remains constrained by the recorded boundary                                                |
| `FD-CM-LOVABLE-DB1-CUSTODY-001`         | binding                                | legacy DB1 custody                                                 | `docs/engineering-playbook/founder-decisions/FD-CM-LOVABLE-DB1-CUSTODY-001.md` | custody only; no movement, deletion, archival or shutdown                                           |
| `FD-CM-CO-JOINT-P0-001`                 | approved for controlled implementation | this P0 branch, read-only discovery and PR creation                | joint package dated `2026-07-18`                                               | implementation authorized; production mutation not authorized                                       |
| `FD-CM-PR10-AUTODEPLOY-DISPOSITION-001` | template only; not adopted             | temporary disposition of the already-running PR #10 deployments    | response pack dated `2026-07-19`                                               | unavailable until the specified Opus acceptance verdict is recorded; does not authorize deployment  |
| `FD-CM-STAGING-READINESS-001`           | executed and verified                  | one `CORNERMEX_COMMERCE_MODEL` correction in staging/cornermex-web | `docs/program/STAGING_READINESS_EXECUTION_EVIDENCE.json`                       | staging ready; no production, Supabase, commercial, A3.2b, or communication authorization           |
| `FD-CM-PROD-LAUNCH-001`                 | executed and verified                  | exact-SHA production frontend launch with commercial execution off | `docs/program/PRODUCTION_FRONTEND_LAUNCH_EVIDENCE.json`                        | production frontend live and ready; no Supabase write, migration, payment, order, message, or A3.2b |

## Active prohibitions

No direct push to `main`; no merge without independent review; no further Railway change, Supabase write, migration application, DNS, checkout, payment, email, customer communication, live media ingestion, DB1 movement, or public price/stock activation is authorized by this sprint.

Chat summaries and historical evidence do not create execution authority. Every production action remains bound to the exact reviewed identity and the applicable Founder gate.
