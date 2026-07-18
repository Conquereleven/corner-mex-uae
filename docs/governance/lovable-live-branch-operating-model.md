# Lovable Live Branch Operating Model

Lovable automation must target `lovable/live`, never `main`. Each sync is
reviewed through a PR after schema ownership, generated types, lockfile and
runtime effects are classified.

Retarget procedure: confirm the current published Lovable project, snapshot its
Git integration settings, select `lovable/live`, perform a no-op sync, verify the
commit landed only on that branch, then document evidence. If branch selection
is unavailable, leave the integration unchanged and escalate; do not disconnect
or freeze the published runtime automatically.

Current status: `lovable_sync_retarget_not_verified`.
