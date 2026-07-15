# Storage bootstrap readiness A3.2a

Planning only. A3.2a creates no bucket or object.

## Proposed policy

- Purpose: first-party catalog media only; no automatic CornerOps media copy.
- Classification: public delivery only after review; original/private assets remain private when required.
- Naming: lowercase stable product identifier plus content checksum; no user-controlled traversal segments.
- MIME allowlist: `image/jpeg`, `image/png`, `image/webp`, and `image/avif` only after decoder validation.
- Maximum size: founder-approved bounded value before creation; undefined size blocks bootstrap.
- Integrity: calculate and retain SHA-256 before upload; reject mismatch.
- Paths: normalized, no `..`, backslashes, control characters, absolute paths, or duplicate semantic identities.
- URLs: signed for private objects; public URLs only for approved publishable catalog media.
- Ownership: named platform operator; product association recorded explicitly.
- Orphans: report first, delete only through a separately authorized reconciled cleanup.

## Bootstrap and rollback

After founder authorization, create one reviewed bucket with exact policy, upload only a bounded approved fixture, verify MIME/size/path/RLS behavior, then remove the fixture if the gate requires a clean state. Rollback disables upload paths, restores policy, preserves logs, and reconciles created objects before bucket removal.

Catalog publication must not infer availability from media presence. Storage creation, catalog activation, automatic import, and inventory sync remain separate gates.
