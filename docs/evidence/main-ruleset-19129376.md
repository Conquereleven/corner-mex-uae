# Main Ruleset Evidence

## Identity

- Repository: `Conquereleven/corner-mex-uae`
- Ruleset ID: `19129376`
- Name: `CornerMex protected main`
- Enforcement: active
- Target: `refs/heads/main`
- API evidence captured after update: `2026-07-17T22:26:49.065-06:00`

## Required checks

The strict required-status policy contains exactly:

1. `contract-and-migration`
2. `type-and-runtime`
3. `schema-authority`
4. `merged-tree-verification`

The fourth check was added only after it passed on PR #9 in GitHub Actions run
`29630472262` against the exact event merge SHA.

## Pull request protections

- One approval required.
- Stale reviews dismissed on push.
- Code owner review required.
- Last-push approval required.
- Review threads must be resolved.
- Deletion and non-fast-forward updates are blocked.
- Allowed merge methods remain merge, squash and rebase.

## Bypass posture

- Bypass actors: none.
- Current user bypass: never.
- Lovable bot exemption: none.

The sanitized machine-readable capture is
`docs/evidence/main-ruleset-19129376.json`. It intentionally omits node IDs and
other unrelated API metadata.
