-- CornerMex MX platform prelude — applied to project bdknutgpbflenzefussq on
-- 2026-10-05 as Supabase migration `cm_mx_0_platform_prelude`.
--
-- A fresh Supabase project lacks the one object the first canonical migration
-- expects to already exist.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  null;
end;
$$;

create extension if not exists http with schema extensions;

-- Temporary bootstrap runner: fetches one migration file from the pinned commit
-- of the public repository, refuses it unless its SHA-256 matches the expected
-- value, executes it, and records it. Dropped when the bootstrap is complete
-- (02_finalize.sql).
create schema if not exists cm_mx_bootstrap;
create table if not exists cm_mx_bootstrap.applied (
  file text primary key,
  sha256 text not null,
  bytes integer not null,
  applied_at timestamptz not null default now()
);
revoke all on schema cm_mx_bootstrap from public, anon, authenticated;
revoke all on table cm_mx_bootstrap.applied from public, anon, authenticated;

create or replace function cm_mx_bootstrap.apply_file(p_commit text, p_file text, p_sha256 text)
returns text
language plpgsql
as $$
declare
  v_response record;
  v_actual text;
  v_sql text;
begin
  if exists (select 1 from cm_mx_bootstrap.applied where file = p_file) then
    return 'already_applied';
  end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '60');
  select status, content into v_response
  from extensions.http_get(
    'https://raw.githubusercontent.com/Conquereleven/corner-mex-uae/' || p_commit || '/' || p_file
  );
  if v_response.status <> 200 then
    raise exception 'BOOTSTRAP_FETCH_FAILED: % (%)', p_file, v_response.status;
  end if;
  v_actual := encode(extensions.digest(convert_to(v_response.content, 'UTF8'), 'sha256'), 'hex');
  if v_actual <> p_sha256 then
    raise exception 'BOOTSTRAP_HASH_MISMATCH: % expected % got %', p_file, p_sha256, v_actual;
  end if;
  -- The hash is checked on the file as published. A file that wraps itself in
  -- begin;/commit; cannot run inside EXECUTE, so those two lines alone are
  -- dropped; the surrounding call is already one transaction.
  v_sql := regexp_replace(v_response.content, '^\s*(begin|commit)\s*;\s*$', '', 'gin');
  execute v_sql;
  insert into cm_mx_bootstrap.applied (file, sha256, bytes)
  values (p_file, p_sha256, octet_length(v_response.content));
  return 'applied';
end;
$$;
revoke all on function cm_mx_bootstrap.apply_file(text, text, text) from public, anon, authenticated;
