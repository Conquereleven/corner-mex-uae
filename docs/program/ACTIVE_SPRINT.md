# Active Sprint: CM-COM-4A — Post-Order Lifecycle Foundation

- Owner: Codex
- Reviewer: independent reviewer
- Branch: `feature/cm-com-4a-post-order-lifecycle`
- Base/main source: `e02960f0887d98e624b22a9333fde59175299847`
- Status: R1 remediation in progress after independent `REQUEST_CHANGES_CM_COM_4A`; repository-only; not activated or deployed

## Independent review R1

The exact reviewed head `db5550b9d9d14702ad2b0d60e2eb1a20f235317a` received
`REQUEST_CHANGES_CM_COM_4A`. Remediation is limited to the five recorded findings:

- P1 combined order/payment lifecycle invariants;
- P1 audit ACL and truthful read integration;
- P1 seller order-detail regression;
- P2 truthful customer order-detail backend errors;
- P2 executable behavioral and parity coverage.

Remediation is not yet independently re-reviewed or Founder accepted. The pending migration remains
unapplied.

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
