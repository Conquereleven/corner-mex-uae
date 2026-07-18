
-- =========================================================
-- 1. COUPONS: remove public-read policy
-- =========================================================
DROP POLICY IF EXISTS "Coupons: public read active" ON public.coupons;

-- =========================================================
-- 2. SELLERS: trigger guards privileged fields against
--    seller self-update; admin role bypasses the guard.
-- =========================================================
CREATE OR REPLACE FUNCTION public.sellers_guard_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins (or service role / superuser when auth.uid() is null) can change anything
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admin sellers: restore privileged fields from OLD
  NEW.user_id              := OLD.user_id;
  NEW.slug                 := OLD.slug;
  NEW.status               := OLD.status;
  NEW.commission_rate      := OLD.commission_rate;
  NEW.is_house_account     := OLD.is_house_account;
  NEW.kyc_status           := OLD.kyc_status;
  NEW.kyc_documents        := OLD.kyc_documents;
  NEW.kyc_rejection_reason := OLD.kyc_rejection_reason;
  NEW.bank_iban            := OLD.bank_iban;
  NEW.bank_swift           := OLD.bank_swift;
  NEW.bank_name            := OLD.bank_name;
  NEW.bank_account_holder  := OLD.bank_account_holder;
  NEW.trn                  := OLD.trn;
  NEW.vat_number           := OLD.vat_number;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sellers_guard_privileged_fields ON public.sellers;
CREATE TRIGGER sellers_guard_privileged_fields
BEFORE UPDATE ON public.sellers
FOR EACH ROW
EXECUTE FUNCTION public.sellers_guard_privileged_fields();

-- =========================================================
-- 3. PRODUCT VIEWS table + tracking RPC
-- =========================================================
CREATE TABLE IF NOT EXISTS public.product_views (
  id           bigserial PRIMARY KEY,
  product_id   uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_hash text,
  category_id  uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  seller_id    uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  viewed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_views_product_id_viewed_at_idx
  ON public.product_views (product_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS product_views_viewed_at_idx
  ON public.product_views (viewed_at DESC);
CREATE INDEX IF NOT EXISTS product_views_dedupe_idx
  ON public.product_views (product_id, COALESCE(user_id::text, session_hash), viewed_at);

GRANT SELECT ON public.product_views TO authenticated;
GRANT ALL ON public.product_views TO service_role;

ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;

-- Admin-only read (server uses service_role anyway)
CREATE POLICY "Product views: admin read"
  ON public.product_views
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No direct INSERT policy: inserts MUST go through the
-- SECURITY DEFINER RPC below, which dedupes recent views.
REVOKE INSERT ON public.product_views FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_product_view(
  p_product_id uuid,
  p_session_hash text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_recent timestamptz;
  v_cat uuid;
  v_seller uuid;
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  -- Dedupe: ignore if same product viewed by same user/session in last 30 min
  SELECT viewed_at INTO v_recent
  FROM public.product_views
  WHERE product_id = p_product_id
    AND viewed_at > (now() - interval '30 minutes')
    AND (
      (v_user IS NOT NULL AND user_id = v_user)
      OR (v_user IS NULL AND p_session_hash IS NOT NULL AND session_hash = p_session_hash)
    )
  ORDER BY viewed_at DESC
  LIMIT 1;

  IF v_recent IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT category_id, seller_id INTO v_cat, v_seller
  FROM public.products WHERE id = p_product_id;

  IF v_cat IS NULL THEN
    -- product not found / inactive: skip silently
    RETURN;
  END IF;

  INSERT INTO public.product_views (product_id, user_id, session_hash, category_id, seller_id)
  VALUES (p_product_id, v_user, p_session_hash, v_cat, v_seller);
END;
$$;

REVOKE ALL ON FUNCTION public.track_product_view(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_product_view(uuid, text) TO anon, authenticated;
