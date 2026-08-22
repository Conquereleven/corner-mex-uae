# Pending Canonical Migrations

This directory holds canonical DB2 work that is merged in Git but not part of
the verified live baseline. Files here are excluded from active replay until
their owning PR is rebased, corrected, independently reviewed and authorized
for execution.

The A3.2b migration remains owned by PR #8. This remediation does not alter PR
#8 or authorize applying the migration.

The CM-LAUNCH-1 lifecycle ACL hardening is a corrective, unapplied migration.
Applying it to the canonical production project requires explicit Founder
authorization and a separately controlled database execution.

`20260822004500_cm_mcp_3_read_boundary.sql` is the CM-MCP-3 grant and read-RPC
boundary. It is intentionally unapplied. Merging its source code does not
enable OAuth, create live MCP grants, alter the production database or expose a
remote MCP endpoint. Database execution, OAuth activation, OAuth client setup
and Edge Function deployment are separate controlled gates that require fresh
explicit Founder authorization.
