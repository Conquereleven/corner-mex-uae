# Founder Decision Record
## Ratification of the Executed Exact-Head Production Deployment

**Decision ID:** FD-CM-PROD-EXACT-HEAD-001
**Status:** RECORDED / RATIFIED AFTER EXECUTION
**Owner:** Joel / Founder
**Authorization recorded at:** 2026-08-07T19:35:00-06:00
**Authorization type:** Post-execution ratification and temporary-source disposition
**Related decisions:** FD-CM-PROD-LAUNCH-001, FD-CM-A3.2B-EXEC-001

## Nature of this record

This decision records and ratifies a production deployment action that had
already occurred before this document was written. It is NOT backdated
pre-execution authorization: the deployment was Founder-executed manually,
and the formal decision record was created afterwards, at the timestamp
above, to close the governance gap identified during CM-GOV-3.

## Ratified action

| Field | Value |
| --- | --- |
| Railway deployment | `18dc25e0-1244-44ff-9e66-3a5cc1f02208` |
| Environment / service | production / `corner-mex-uae` |
| Exact deployed source | `c9f82892b4bbe029f2b709eb6a3f00f24026c7c8` |
| Source branch | `feature/cm-com-1c-b2b-catalog-manual-quote` |
| Source review status | PR #21 independently reviewed exact head |
| Containment | The deployed source is contained in merged `main` (`77e5d24e8a3c9589dac7535480ed7d9dbc60a512`) |

During and after this deployment, commercial execution remained disabled:
checkout, payment and external messaging were NOT authorized and remained
off per `/api/ready` capability gates.

## Temporary source disposition

Production is authorized to REMAIN TEMPORARILY on
`c9f82892b4bbe029f2b709eb6a3f00f24026c7c8`, because that source is the
independently reviewed PR #21 exact head and is contained in merged main.

**The NEXT manual production deployment MUST originate from `main`.**
This temporary disposition expires at that deployment; the SHA-pinned
provenance exception in program-state validation must be retired when
production truly runs a main-sourced deployment, and not before.

## Explicitly NOT authorized by this decision

- No new platform write of any kind (Railway, Supabase, DNS, domains).
- No A3.2b execution; no catalog population.
- No checkout, payment, or external messaging enablement.
- No inventory, order, seller, or OAuth configuration change.
- No merge or Ready transition of any open PR.

Chat summaries do not create execution authority. Any future production
action remains bound to the exact reviewed identity and applicable
Founder gates.
