-- Restrict EXECUTE on SECURITY DEFINER RPCs to authenticated only
REVOKE EXECUTE ON FUNCTION public.admin_update_order_state(uuid, public.order_status, public.payment_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_state(uuid, public.order_status, public.payment_status) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.seller_update_order_item_fulfillment(uuid, public.order_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_update_order_item_fulfillment(uuid, public.order_status) TO authenticated;

-- Move pg_net extension out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_net SET SCHEMA extensions;

-- Tighten coupons read: require authentication
DROP POLICY IF EXISTS "Coupons: public read active" ON public.coupons;
CREATE POLICY "Coupons: authenticated read active" ON public.coupons
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

-- Storage policy: authenticated users can read product-images
CREATE POLICY "product-images authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');
