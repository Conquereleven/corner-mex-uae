-- CM-LAUNCH-1 canonical in-app notifications domain.
-- Browser roles remain closed; authenticated UI access is mediated by
-- requireSupabaseAuth server functions using the explicitly scoped service role.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (char_length(btrim(kind)) between 1 and 100),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  body text,
  link text,
  order_id uuid references public.orders(id) on delete set null,
  shipment_id uuid,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column public.notifications.shipment_id is
  'Nullable source reference only; canonical public.shipments does not yet exist.';

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

revoke all on table public.notifications from public, anon, authenticated, service_role;
grant select, insert, update on table public.notifications to service_role;
