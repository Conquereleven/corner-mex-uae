# Founder Decision
## Lovable Main Remediation and Governance

**Decision ID:** FD-CM-LOVABLE-GOV-001
**Status:** APPROVED
**Owner:** Joel / Founder
**Effective scope:** CornerMex UAE repository governance and current-main remediation
**Effective immediately:** Yes

## Approved decision

1. Preserve the eight Lovable commits in Git history for auditability.
2. Do not wholesale-revert all eight commits.
3. Remove or quarantine the two phantom Supabase migrations that reference functions absent from canonical.
4. Regenerate `src/integrations/supabase/types.ts` strictly from canonical CornerMex Supabase: `wlrfknmrhowldygmvtvn`.
5. Reconcile `package.json` and `package-lock.json` so `npm ci` passes.
6. Expand CI so phantom legacy references and schema drift cannot pass silently.
7. Prohibit Lovable and all bots from pushing directly to `main`.
8. Require Lovable changes through a dedicated branch and pull request.
9. Require Opus review for migrations, RLS, Auth, grants and `SECURITY DEFINER` changes.
10. Keep A3.2b execution unauthorized until current `main` is remediated, independently approved, PR #8 is updated onto the remediated `main`, its new exact head is independently reviewed, and the Founder explicitly authorizes merge and later production execution.

## Canonical schema authority

`wlrfknmrhowldygmvtvn`

## Explicit prohibitions

This approval does not authorize production deployment, Supabase writes, Storage, Auth bootstrap, catalog import, inventory activation, DNS, checkout, payments, communications, PR #8 merge, direct commits to `main`, or Lovable production writes.

## Required next steps

1. Complete the Fable 5 architecture review.
2. Give this decision and the Fable report to Codex.
3. Codex creates a focused remediation PR against current `main`.
4. Sonnet performs pre-review.
5. Opus performs final independent review.
6. Founder decides whether to merge the remediation PR.
7. Codex then updates PR #8 onto remediated `main`.
8. The new PR #8 head receives a fresh exact-head review.

## Repository placement

Primary file:

`docs/engineering-playbook/founder-decisions/FD-CM-LOVABLE-GOV-001.md`

Registry entry:

`docs/engineering-playbook/04_Founder_Decision_Registry.md`

Recommended registry record:

```text
Decision ID: FD-CM-LOVABLE-GOV-001
Title: Lovable Main Remediation and Governance
Status: approved
Owner: Joel / Founder
Scope: CornerMex repository governance and current-main remediation
Execution state: approved_not_executed
```
