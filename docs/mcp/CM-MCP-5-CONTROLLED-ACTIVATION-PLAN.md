# CM-MCP-5 — controlled activation plan

## Status

**Readiness and planning only. This document is not authorization to execute any production action.**

CM-MCP-5 defines the smallest auditable sequence for a future first remote MCP rehearsal. This change does not apply CM-MCP-DB2, enable OAuth, register a client, provision a live grant, deploy an Edge Function, deploy the application, or mutate Railway.

## Repository baseline

- `main`: `14c8b58ccf05abb45659b3634158c5d0bff133f9` (PR #58 merged).
- SEC-RLS-1: issue #55 closed with canonical production reconciliation on `main`.
- PR #58: merged from exact head `ab102761df3b96c5c16f20fd7eddb209fde2017b` as merge commit `14c8b58ccf05abb45659b3634158c5d0bff133f9`.
- PR #59: ready but unmerged at `4de02a90e8603b68ba4428142ffdd82d62728fe8`.

The heads above are evidence inputs, not merge authorizations. Any head change requires fresh CI, independent review, and a new exact-head Founder decision. CM-MCP-5 cannot advance to a production gate until PR #59 is merged and its merge commit is reconciled into the activation evidence. The merge of PR #58 does not authorize applying CM-MCP-DB2 to production.

## First rehearsal boundary

The first rehearsal remains deliberately small:

- dynamic client registration remains disabled;
- exactly one separately approved static OAuth client is planned;
- initial CornerMex permissions are limited to `catalog:read`, `inventory:read`, and `ops:read`;
- order and B2B reads remain absent;
- every write permission remains absent;
- browser Origin allowlists remain empty;
- the MCP path never receives a service-role credential;
- Railway is outside the activation path and must not be mutated.

## Separately authorized gates

Each row is an independent stop/go decision. Approval for one row never authorizes the next row.

| Gate             | Planned action                                                                                          | Required evidence before execution                                                                                              | Stop / rollback evidence                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| DB2 apply        | Apply the exact reviewed CM-MCP-DB2 migration to the canonical production project                       | PR #58 merged; exact canonical migration hash and runtime target; fresh read-only ledger/privilege preflight; reviewed rollback | Abort on identity drift; if execution starts, preserve runtime ledger and transaction outcome before any next gate |
| DB2 postflight   | Verify runtime ledger, RLS, grants, function ownership, execute privileges, and all nine RPC boundaries | Exact apply evidence from the preceding gate                                                                                    | Any mismatch stops the sequence and keeps OAuth inactive                                                           |
| OAuth enable     | Enable the Supabase OAuth server with the reviewed consent path and dynamic registration disabled       | PR #59 merged; asymmetric signing readiness; exact consent URL; current DB2 postflight green                                    | Disable OAuth server if discovery or consent behavior differs from the approved plan                               |
| Static client    | Register one production OAuth client with exact redirect URI matching                                   | OAuth discovery and consent path verified; client identity and redirect URI independently reviewed                              | Disable or remove the client on any mismatch                                                                       |
| Initial grants   | Provision only the exact user + client grants for the three initial read permissions                    | Verified token subject and `client_id`; grant rows reviewed before write                                                        | Deactivate the exact grant rows; do not broaden permissions                                                        |
| Edge deploy      | Deploy `cornermex-mcp` with the reviewed public URL and hostname boundary                               | Exact reviewed function artifact; no service-role credential; empty browser Origin allowlist                                    | Remove or disable the function and retain OAuth/client/grants in a non-operational posture                         |
| Remote rehearsal | Run the bounded read-only smoke sequence                                                                | All prior gate evidence green and fresh                                                                                         | On first failure, stop; deactivate grants, then disable client/OAuth or remove the function as required            |

No execution command, credential, client secret, user identifier, redirect URI, or live grant value belongs in this planning PR. Those values must be resolved and reviewed only inside the separately authorized gate that needs them.

## Evidence packet required per gate

Every future gate request must identify:

1. the exact repository head or immutable artifact hash;
2. the exact canonical project and intended mutation;
3. fresh read-only preflight evidence and its timestamp;
4. a bounded rollback or disable action prepared before execution;
5. the expected postflight assertions;
6. the independent reviewer and exact reviewed identity;
7. a single-gate Founder authorization that cannot carry forward.

## Explicit non-activation evidence

The machine-readable contract at `contracts/cm-mcp-5-controlled-activation-readiness-v1.json` records every production mutation as false and every future production gate as `not_authorized`. CI rejects an expanded permission set, combined authorization, execution commands, service-role access, browser origins, or a Railway dependency.
