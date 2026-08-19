-- CM-LAUNCH-1 corrective ACL hardening.
-- Pending canonical only: this file is not authorization to mutate production.
begin;

revoke all privileges on table public.order_lifecycle_events from service_role;
grant select on table public.order_lifecycle_events to service_role;

do $$
begin
  if not has_table_privilege('service_role', 'public.order_lifecycle_events', 'select')
     or has_table_privilege(
       'service_role',
       'public.order_lifecycle_events',
       'insert,update,delete,truncate,references,trigger'
     ) then
    raise exception 'CM_LAUNCH_1_LIFECYCLE_ACL_HARDENING_FAILED';
  end if;
end;
$$;

commit;
