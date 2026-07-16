REVOKE EXECUTE ON FUNCTION public.track_product_view(uuid, text) FROM PUBLIC, anon;
-- Server calls this via service role (supabaseAdmin), which bypasses these grants.