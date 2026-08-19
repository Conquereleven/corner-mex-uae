# Active Sprint: CM-COM-4A — Post-Order Lifecycle Foundation

- Owner: Codex
- Reviewer: independent reviewer
- Branch: `feature/cm-com-4a-post-order-lifecycle`
- Base/main source: `e02960f0887d98e624b22a9333fde59175299847`
- Status: R3 behavioral-proof remediation in progress after independent `REQUEST_CHANGES_CM_COM_4A_R2`; repository-only; not activated or deployed

## Independent review R1

The exact R1 re-reviewed head `95894b002befbd77788e7279235e48c57012a9f8` received
`REQUEST_CHANGES_CM_COM_4A_R1`. P1 combined lifecycle invariants, P1 audit ACL/read integration,
and P1 seller regression are independently CLOSED. R2 remediation is limited to the two remaining
P2 findings:

- P2 truthful customer order-detail backend errors;
- P2 executable behavioral and parity coverage.

## Independent review R2

The exact R2 head `76dd0a51c19224e8492a1784cfbe8fb60fbc2fd0` received
`REQUEST_CHANGES_CM_COM_4A_R2`. P1-1, P1-2, P1-3 and P2-1 are independently CLOSED. R3 is
strictly limited to executable mounted/server/query evidence for the remaining P2-2 behavioral
coverage finding.

R3 is not independently reviewed or Founder accepted. The pending migration remains unapplied.

## Entry state

`CM-COM-3A.1` is **PRODUCTION ACCEPTED / COMPLETE**. Founder COD Acceptance Order #2 proved
atomic inventory consistency: both stock authorities decremented by the ordered quantity, exactly
one matching sale movement was recorded, and global stock/QOH drift remained zero. CM-COM-4A does
not reopen that hotfix.

## Current implementation scope

1. Repair authenticated customer order history using canonical A2 fields only.
2. Add a server-owned customer order-detail route with indistinguishable not-found/not-owned errors.
3. Establish canonical order and COD payment state machines with explicit transition allowlists.
4. Prepare an unapplied, admin-authorized, row-locked transition RPC.
5. Prepare append-only lifecycle audit evidence.
6. Replace legacy free-form master-dashboard states with fail-closed allowed-next actions.

## Platform boundary

The migration in `supabase/pending-canonical/` is Git-only and **UNAPPLIED**. This sprint performs
no Supabase write, Railway write, deployment, variable change, production status mutation, real
order, payment, inventory mutation, external message, DNS action, A3.2b action or CornerOps change.

## Deferred roadmap

- `CM-DESIGN-2 — Anime.js Motion Language`
- `CM-DESIGN-3 — Desert Glass v2`
- `CM-B2B — Dubai/Sharjah commercial development`

These lines remain planned and are not implemented by CM-COM-4A.
