# Current-Main Remediation Sonnet Packet

## Review identity

- Base: `a558785d3fc2c1eb2aa9298087bba7f940094bcb`
- Branch: `fix/lovable-schema-authority-main-remediation`
- Canonical Supabase: `wlrfknmrhowldygmvtvn`
- Lovable project: `d9495376-339d-44dd-9c8a-db0f7b451f96`
- PR #8 reviewed only for overlap; its head was not changed.

## Review focus

1. Confirm all 42 DB1 migrations are checksum-pinned and quarantined.
2. Confirm active DB2 replay is exactly four applied migrations, 20 tables,
   2 public functions, 20 RLS tables and 37 policies.
3. Confirm unapplied A3.2b remains pending and PR #8 must correct its
   `public.is_admin()` policy references after rebase.
4. Confirm generated types came from canonical DB2 through read-only Supabase MCP.
5. Confirm the application reference baseline permits existing Lovable-only
   runtime debt but fails on new unclassified or invalid identities.
6. Confirm `schema-authority` is a required protected-main check.
7. Confirm package/lock reconciliation retains Lovable config `2.7.6`, bridge
   `1.2.0` and HMR gate `1.1.4`.
8. Confirm the compatible Vite/Cloudflare security updates leave npm audit at
   zero Critical and zero High; one Moderate and one Low remain transitive.

## Safety

No database, Auth, Storage, Railway, Lovable runtime, DNS, checkout, payment or
communication write was performed. The proposed PR must remain draft and must
not be merged before independent review.
