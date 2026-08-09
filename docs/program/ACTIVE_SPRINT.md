# Active Sprint: CM-COM-3A — Commercial Active MVP (Cash on Delivery)

- Owner: Claude
- Reviewer: Codex (independent)
- Branch: `feature/cm-com-3a-commercial-active-mvp`
- Base/main source: `af822ba00866ccd75a8a0cf4431570f044317ad7`
- Status: implementation complete; draft PR #25 pending independent review

This sprint makes the **repository** ready for commercial activation with a single bounded
order path: cash on delivery, single merchant, AED only. It does **not** activate commerce.
No production write of any kind was performed or authorized.

## Founder reorder decision

`CM-COM-3A` runs **ahead of** `CM-COM-2B1 — Domain Cutover` under explicit Founder
authorization. The domain cutover is not blocked by a defect; it is **ON HOLD** because no
custom domain is purchased or approved, and revenue readiness does not depend on it. The
canonical priority order in `COMMERCIAL_ROADMAP.md` is updated to record this reorder rather
than being silently bypassed.

## Verified repository facts

- `main` is `af822ba00866ccd75a8a0cf4431570f044317ad7` — the merge commit of PR #24.
- **CM-COM-2B0 is COMPLETE / MERGED.** PR #24; reviewed head
  `92845d3d903d8843679db6cd68fe3a9ebb279534`. R1 and R2 were each independently rejected and
  remediated before approval. That trail is preserved in git history and in `CURRENT_STATE.json`
  and is deliberately not rewritten.
- **CM-COM-2B1 is ON HOLD**, not in progress.

## Runtime facts — carried forward, NOT re-observed by this sprint

**Verified governance fact:** CM-COM-3A performed no deployment, and no deployment was
authorized by it.

**Last-observed runtime fact (CM-GOV-3):** production served the PR #21 exact head
`c9f82892b4bb…`; staging served `77e5d24e8a3c…`.

**Unknown:** what commit either environment serves _now_. This sprint re-observed nothing, and
staging auto-deploy is enabled, so staging may have advanced. Production auto-deploy remains
disabled and production deployment remains separately gated.

## Founder-attested commercial facts

- Legal selling entity: **RodMor TradeCo LLC**.
- VAT registered: **yes**; TRN `105514792800001`; VAT rate **5%**.
- COD delivery rates (AED): Dubai 15, Abu Dhabi 15, Sharjah 20, Ajman 20, Umm Al Quwain 20,
  Ras Al Khaimah 20, Fujairah 20. All seven emirates are supported.
- CornerMex price mirrors the current public effective Intermex price. **No markup.**
- Opening stock policy: source `AVAILABLE` → `1`; `SOLD_OUT` → `0`; `UNKNOWN` → `0`. A quantity
  above 1 is never invented and no infinite inventory exists. Source availability and CornerMex
  transactional stock remain separate fields.

## Sprint scope

1. Transactional COD order function `place_cod_order_v1` — **prepared and unapplied**, held in
   `supabase/pending-canonical/` under the migration-ownership contract.
2. Server-authoritative commercial configuration: per-emirate shipping, VAT rate and TRN, with
   fail-closed evaluation.
3. COD order execution path (`src/lib/cod-order.functions.ts`) accepting no client-supplied money.
4. Real checkout UI wired to that path only, COD-only, with legal acceptance and a
   server-computed live total.
5. Intermex UAE public catalog ingestion (unauthenticated HTTPS GET only) and a dry-run
   activation manifest/plan.
6. Activation runbook, program reconciliation and focused tests.

## Explicitly not done

No Supabase migration applied. No catalog loaded. No Railway variable, service or domain change.
No deployment. No checkout enabled. No real order, payment, bank transfer, Stripe, DNS or
external email. No write to Intermex, CornerOps, Lovable or any production database. Canonical
`public.products` remains empty and A3.2b remains NOT AUTHORIZED / NOT EXECUTED.

## Next

Independent review of PR #25 by Codex, then Founder-authorized execution of the sequence in
`CM-COM-3A_ACTIVATION_RUNBOOK.md`. `CM-COM-2B1 — Domain Cutover` remains **ON HOLD** until an
approved, owned domain exists and the Founder authorizes it.
