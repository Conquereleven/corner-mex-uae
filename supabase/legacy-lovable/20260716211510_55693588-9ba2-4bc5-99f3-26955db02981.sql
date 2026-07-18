-- Revoke EXECUTE from PUBLIC and anon on SECURITY DEFINER functions so unauthenticated
-- callers cannot invoke privileged logic. Keep authenticated access where the function
-- performs its own auth.uid()/role checks. handle_new_user is invoked by an auth trigger
-- (runs as the definer regardless of grants), so we lock it down entirely.

REVOKE EXECUTE ON FUNCTION public.create_verified_review(uuid, integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_verified_review(uuid, integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_order_state(uuid, public.order_status, public.payment_status) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seller_update_order_item_fulfillment(uuid, public.order_status) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_guard_privileged_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sellers_guard_privileged_fields() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_verified_review(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_verified_review(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order_state(uuid, public.order_status, public.payment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_update_order_item_fulfillment(uuid, public.order_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- track_product_view is intentionally callable by anon (session-based product view tracking).
-- Keep anon EXECUTE — the function only inserts telemetry and reads product public fields.
