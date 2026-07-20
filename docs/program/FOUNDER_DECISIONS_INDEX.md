# Founder Decisions Index

Observed: `2026-07-20T00:01:26Z`

| Decision                                | Status                                 | Scope                                                           | Repository authority                                                           | Execution state                                                                                    |
| --------------------------------------- | -------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `FD-CM-A3.2B-EXEC-001`                  | approved with exact gates              | A3.2b production foundation                                     | `docs/engineering-playbook/founder-decisions/FD-CM-A3.2B-EXEC-001.md`          | blocked pending exact-head review, fresh preflight, green deployment and remaining gates           |
| `FD-CM-LOVABLE-GOV-001`                 | binding                                | Lovable governance and authority boundary                       | `docs/engineering-playbook/founder-decisions/FD-CM-LOVABLE-GOV-001.md`         | Lovable remains constrained by the recorded boundary                                               |
| `FD-CM-LOVABLE-DB1-CUSTODY-001`         | binding                                | legacy DB1 custody                                              | `docs/engineering-playbook/founder-decisions/FD-CM-LOVABLE-DB1-CUSTODY-001.md` | custody only; no movement, deletion, archival or shutdown                                          |
| `FD-CM-CO-JOINT-P0-001`                 | approved for controlled implementation | this P0 branch, read-only discovery and PR creation             | joint package dated `2026-07-18`                                               | implementation authorized; production mutation not authorized                                      |
| `FD-CM-PR10-AUTODEPLOY-DISPOSITION-001` | template only; not adopted             | temporary disposition of the already-running PR #10 deployments | response pack dated `2026-07-19`                                               | unavailable until the specified Opus acceptance verdict is recorded; does not authorize deployment |

## Active prohibitions

No direct push to `main`; no merge without independent review; no Railway redeploy, Supabase write, migration application, DNS, checkout, payment, email, customer communication, live media ingestion, DB1 movement, or public price/stock activation is performed by this sprint.

Chat summaries and historical evidence do not create execution authority. Every production action remains bound to the exact reviewed identity and the applicable Founder gate.
