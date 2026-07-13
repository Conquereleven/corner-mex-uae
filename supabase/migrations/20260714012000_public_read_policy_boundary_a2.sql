-- Keep anonymous catalog reads independent from the private admin helper.
-- Existing authenticated admin policies continue to grant administrative access.

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active);

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated using (status = 'active');

drop policy if exists translations_public_read on public.product_translations;
create policy translations_public_read on public.product_translations
  for select to anon, authenticated using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    )
  );

drop policy if exists images_public_read on public.product_images;
create policy images_public_read on public.product_images
  for select to anon, authenticated using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    )
  );

drop policy if exists variants_public_read on public.product_variants;
create policy variants_public_read on public.product_variants
  for select to anon, authenticated using (
    is_active and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'active'
    )
  );

drop policy if exists reviews_public_approved on public.product_reviews;
create policy reviews_public_approved on public.product_reviews
  for select to anon, authenticated using (
    status = 'approved' or buyer_id = (select auth.uid())
  );

drop policy if exists coupons_public_valid_read on public.coupons;
create policy coupons_public_valid_read on public.coupons
  for select to anon, authenticated using (
    is_active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );
