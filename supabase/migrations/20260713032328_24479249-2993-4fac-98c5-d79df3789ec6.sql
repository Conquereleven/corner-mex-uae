
-- 1. Drop overly permissive INSERT policy on catalog_events (server writes only via service role)
DROP POLICY IF EXISTS "anyone can insert catalog events" ON public.catalog_events;

-- 2. Revoke EXECUTE from anon on privileged SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.admin_update_order_state(uuid, public.order_status, public.payment_status) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_verified_review(uuid, integer, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_verified_review(uuid, integer, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seller_update_order_item_fulfillment(uuid, public.order_status) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reviews_guard_privileged_fields() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sellers_guard_privileged_fields() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
-- track_product_view intentionally supports anonymous session tracking; keep anon EXECUTE
