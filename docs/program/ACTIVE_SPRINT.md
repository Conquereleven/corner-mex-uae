# Active Sprint: CM-COM-2B0 — Domain Readiness & Program Reconciliation

- Owner: Claude
- Reviewer: Codex (independent)
- Branch: `chore/cm-com-2b0-domain-readiness`
- Base/main source: `acb1723095471786e904825042c1b9745f120504`
- Status: implementation complete; draft PR pending independent review

This sprint prepares the repository and governance state for a future custom-domain cutover
**without performing it**, and reconciles canonical program documents that went stale after the
PR #22 and PR #23 merges. It does **not** complete CM-COM-2B.

## Verified repository facts

- `main` is `acb1723095471786e904825042c1b9745f120504` — the merge commit of PR #23.
- **CM-COM-2A is COMPLETE / MERGED.** PR #23; independently reviewed exact head
  `f0dfbb71a8978583c78aed0181078aa25b36f8f7`; final independent review returned
  `APPROVED_CM_COM_2A_R3_FOR_FOUNDER_VISUAL_ACCEPTANCE`.
- Founder Visual Acceptance: **APPROVED** — desktop approved, mobile approved, no observations.
- CM-COM-2A required three remediation rounds. **R1 and R2 were each independently
  rejected and remediated; R3 was independently approved.** Founder Visual Acceptance followed
  the R3 approval. That trail is preserved in git history, in the structured record in
  `CURRENT_STATE.json`, and in `docs/commercial/cm-com-2a-trust-architecture.md`. It is
  deliberately not rewritten.

## Runtime facts — last observed, NOT re-observed by this sprint

**Verified governance fact:** CM-COM-2B0 performed no production deployment, and no production
deployment was authorized by it.

**Last-observed runtime fact (CM-GOV-3):** production served the PR #21 exact head
`c9f82892b4bb…`; staging served `77e5d24e8a3c…`.

**Unknown:** what commit either environment serves _now_. This sprint re-observed nothing, and
staging auto-deploy is enabled, so staging may have advanced. Production auto-deploy remains
disabled and production deployment remains separately gated. Do not read the last-observed
values above as current state.

## Founder-attested facts

- `cornermex.ae` is **not purchased and not operational**.
- The temporary public contact mailbox stands under `FD-CM-PUBLIC-CONTACT-001`
  (evidence class: FOUNDER-ATTESTED / TEMPORARY).
- Business identity is FOUNDER-ATTESTED under `FD-CM-BUSINESS-IDENTITY-001`.

## Sprint scope

1. Reconcile `CURRENT_STATE.json`, `DEPLOYMENT_REGISTRY.json`, this file,
   `COMMERCIAL_ROADMAP.md` and `NEXT_READINESS_SPRINT.md` to verified repository reality,
   keeping runtime facts explicitly marked as carried forward.
2. Record CM-COM-2A closure in the program record.
3. Publish `CM-COM-2B0_DOMAIN_READINESS.md`: domain approval contract, URL authority
   inventory, CM-COM-2B1 cutover runbook, and the pre-activation email debt register.
4. Add domain-safety invariant tests.

## Explicitly not done

No domain purchased or configured. No DNS, MX or TLS action. No Railway custom-domain binding
or variable change. No Railway, Supabase, OAuth, email-provider or CornerOps write. No
deployment. No checkout, payment, bank transfer, COD, external email, external messaging,
A3.2b, catalog population or inventory mutation. CM-COM-3 implementation has not started.

## Next

`CM-COM-2B1 — Domain Cutover` remains **BLOCKED** until an approved, owned domain exists and
the Founder authorizes it. Entry conditions are the domain approval contract in
`CM-COM-2B0_DOMAIN_READINESS.md`.
