-- A2 advisor remediation: keep role authorization outside the exposed API schema.
create schema if not exists commerce_private;
revoke all on schema commerce_private from public, anon;
grant usage on schema commerce_private to authenticated, service_role;

alter function public.is_admin(uuid) set schema commerce_private;
revoke all on function commerce_private.is_admin(uuid) from public, anon;
grant execute on function commerce_private.is_admin(uuid) to authenticated, service_role;

comment on function commerce_private.is_admin(uuid) is
  'RLS-only CornerMex admin authorization helper; not exposed as a public RPC.';
