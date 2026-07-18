begin;
create table public.catalog_import_executions (
  id uuid primary key default gen_random_uuid(), contract_version text not null check(contract_version='cornermex-catalog-import-execution-v1'),
  source_repo_sha text not null check(source_repo_sha ~ '^[0-9a-f]{40}$'), source_fingerprint text not null unique check(source_fingerprint ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null unique, status text not null default 'previewed' check(status in ('previewed','executed','verified','rolled_back')),
  source_count integer not null check(source_count>=0), imported_count integer not null default 0 check(imported_count>=0), review_count integer not null default 0 check(review_count>=0),
  public_count integer not null default 0 check(public_count=0), inventory_total integer not null default 0 check(inventory_total=0), created_at timestamptz not null default now()
);
create table public.catalog_import_reviews (
  id uuid primary key default gen_random_uuid(), execution_id uuid not null references public.catalog_import_executions(id) on delete restrict,
  stable_product_identity text not null, source_row integer not null check(source_row>1), source_id text, sku text, name text,
  classification text not null check(classification in ('ready_to_import','needs_review','missing_media','duplicate','compliance_blocked','price_blocked','identity_blocked','invalid_data','excluded_non_catalog_record')),
  blocking_reasons jsonb not null default '[]', source_fingerprint text not null, publication_state text not null default 'draft' check(publication_state='draft'),
  inventory integer not null default 0 check(inventory=0), created_at timestamptz not null default now(), unique(execution_id,stable_product_identity)
);
create table public.catalog_import_product_ownership (
  execution_id uuid not null references public.catalog_import_executions(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (execution_id, product_id), unique(product_id)
);
create table public.catalog_import_media_objects (
  execution_id uuid not null references public.catalog_import_executions(id) on delete restrict,
  object_path text not null check(object_path !~ '(^|/)\.\.(/|$)'), content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
  content_mime text not null check(content_mime in ('image/jpeg','image/png','image/webp')), content_bytes bigint not null check(content_bytes between 1 and 10485760),
  created_at timestamptz not null default now(), primary key(execution_id,object_path), unique(object_path)
);
alter table public.catalog_import_executions enable row level security;
alter table public.catalog_import_reviews enable row level security;
alter table public.catalog_import_product_ownership enable row level security;
alter table public.catalog_import_media_objects enable row level security;
create policy catalog_import_executions_admin_read on public.catalog_import_executions for select to authenticated using (commerce_private.is_admin(auth.uid()));
create policy catalog_import_reviews_admin_read on public.catalog_import_reviews for select to authenticated using (commerce_private.is_admin(auth.uid()));
create policy catalog_import_product_ownership_admin_read on public.catalog_import_product_ownership for select to authenticated using (commerce_private.is_admin(auth.uid()));
create policy catalog_import_media_objects_admin_read on public.catalog_import_media_objects for select to authenticated using (commerce_private.is_admin(auth.uid()));
revoke all on public.catalog_import_executions, public.catalog_import_reviews, public.catalog_import_product_ownership, public.catalog_import_media_objects from public, anon;
grant select on public.catalog_import_executions, public.catalog_import_reviews, public.catalog_import_product_ownership, public.catalog_import_media_objects to authenticated;
create index catalog_import_reviews_execution_class_idx on public.catalog_import_reviews(execution_id,classification);
commit;
