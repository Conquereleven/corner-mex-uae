-- CornerMex MX bootstrap finalize — applied to project bdknutgpbflenzefussq on
-- 2026-10-05 as Supabase migration `cm_mx_2_bootstrap_finalize`.
--
-- Reference seed: the category taxonomy only. No price, product, customer or
-- supplier is seeded (docs/cornermex-mx/DATABASE-BOOTSTRAP.md).
insert into public.categories (slug, name_en, name_es, is_active, sort_order) values
  ('salsas-moles',   'Salsas & moles',    'Salsas y moles',     true, 10),
  ('chiles-spices',  'Chiles & spices',   'Chiles y especias',  true, 20),
  ('pantry-staples', 'Pantry staples',    'Despensa',           true, 30),
  ('tortillas-masa', 'Tortillas & masa',  'Tortillas y masa',   true, 40),
  ('snacks-sweets',  'Snacks & sweets',   'Botanas y dulces',   true, 50),
  ('drinks',         'Drinks',            'Bebidas',            true, 60)
on conflict (slug) do nothing;

-- The bootstrap runner has done its job. The record of what it applied stays.
drop function if exists cm_mx_bootstrap.apply_file(text, text, text);
comment on table cm_mx_bootstrap.applied is
  'Audit record of the CornerMex MX bootstrap: each migration file, its SHA-256 and when it was applied, from commit ad0b2e7fa41d6afbc374301b9636969430b51283.';
alter table cm_mx_bootstrap.applied enable row level security;
alter table cm_mx_bootstrap.applied force row level security;
revoke all on table cm_mx_bootstrap.applied from public, anon, authenticated, service_role;
