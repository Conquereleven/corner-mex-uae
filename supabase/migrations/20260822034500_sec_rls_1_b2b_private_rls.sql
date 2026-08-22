-- SEC-RLS-1
-- Defense-in-depth RLS for canonical private B2B operational tables.
--
-- These tables are not direct application APIs. Valid access continues through
-- reviewed SECURITY DEFINER RPCs owned by postgres. RLS is intentionally
-- ENABLED but not FORCED so those owner-executed RPCs keep their existing
-- semantics while browser/application roles remain unable to access rows
-- directly.
--
-- No RLS policies are created here. Direct table privileges stay revoked.

alter table commerce_private.b2b_lead_status_history enable row level security;
alter table commerce_private.b2b_lead_notes enable row level security;
alter table commerce_private.b2b_intake_abuse_budget enable row level security;

revoke all on table commerce_private.b2b_lead_status_history
  from public, anon, authenticated, service_role;
revoke all on table commerce_private.b2b_lead_notes
  from public, anon, authenticated, service_role;
revoke all on table commerce_private.b2b_intake_abuse_budget
  from public, anon, authenticated, service_role;
