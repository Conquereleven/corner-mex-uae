# Lovable Automation and Direct Main Governance

Lovable and all bots are prohibited from direct writes to `main`. The branch
`lovable/live` is the only intended automation target. Every promotion requires
a pull request, independent review and all required CI checks.

Schema-affecting changes require canonical ownership, migration replay,
generated type validation and Opus review for RLS, Auth, grants, revokes or
`SECURITY DEFINER`. Emergency access follows the audited break-glass runbook.
