
ALTER TABLE public.product_reviews
  DROP CONSTRAINT IF EXISTS product_reviews_product_id_buyer_id_order_id_key;

ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_verified_purchase boolean NOT NULL DEFAULT false;

ALTER TABLE public.product_reviews ALTER COLUMN order_id SET NOT NULL;
ALTER TABLE public.product_reviews ALTER COLUMN order_item_id SET NOT NULL;
ALTER TABLE public.product_reviews ALTER COLUMN seller_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_unique_per_item
  ON public.product_reviews(buyer_id, order_item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON public.product_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON public.product_reviews(order_id);

CREATE OR REPLACE FUNCTION public.reviews_guard_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.buyer_id := auth.uid();
    NEW.is_verified_purchase := false;
    NEW.status := COALESCE(NEW.status, 'approved');
    RETURN NEW;
  END IF;

  NEW.buyer_id := OLD.buyer_id;
  NEW.product_id := OLD.product_id;
  NEW.seller_id := OLD.seller_id;
  NEW.order_id := OLD.order_id;
  NEW.order_item_id := OLD.order_item_id;
  NEW.is_verified_purchase := OLD.is_verified_purchase;
  NEW.status := OLD.status;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_guard_privileged_fields ON public.product_reviews;
CREATE TRIGGER reviews_guard_privileged_fields
  BEFORE INSERT OR UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_guard_privileged_fields();

CREATE OR REPLACE FUNCTION public.create_verified_review(
  p_order_item_id uuid,
  p_rating int,
  p_title text DEFAULT NULL,
  p_comment text DEFAULT NULL
)
RETURNS public.product_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item public.order_items;
  v_order public.orders;
  v_existing uuid;
  v_title text;
  v_comment text;
  v_row public.product_reviews;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Tu sesión expiró. Inicia sesión de nuevo.' USING ERRCODE = '42501';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'La puntuación debe ser entre 1 y 5 estrellas.' USING ERRCODE = '22023';
  END IF;

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  v_comment := NULLIF(btrim(COALESCE(p_comment, '')), '');
  IF v_title IS NOT NULL AND length(v_title) > 120 THEN
    RAISE EXCEPTION 'El título no puede superar los 120 caracteres.' USING ERRCODE = '22001';
  END IF;
  IF v_comment IS NOT NULL AND length(v_comment) > 1500 THEN
    RAISE EXCEPTION 'El comentario no puede superar los 1500 caracteres.' USING ERRCODE = '22001';
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'No encontramos una compra elegible para este producto.' USING ERRCODE = '42704';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_item.order_id;
  IF v_order.id IS NULL OR v_order.buyer_id <> v_user THEN
    RAISE EXCEPTION 'No encontramos una compra elegible para este producto.' USING ERRCODE = '42704';
  END IF;

  IF v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'Esta compra aún no está disponible para reseña.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_existing FROM public.product_reviews
  WHERE buyer_id = v_user AND order_item_id = p_order_item_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Ya enviaste una reseña para este producto.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.product_reviews(
    product_id, buyer_id, seller_id, order_id, order_item_id,
    rating, title, body, status, is_verified_purchase
  ) VALUES (
    v_item.product_id, v_user, v_item.seller_id, v_item.order_id, v_item.id,
    p_rating, v_title, v_comment, 'approved', true
  );

  UPDATE public.product_reviews SET is_verified_purchase = true
  WHERE buyer_id = v_user AND order_item_id = p_order_item_id;

  SELECT * INTO v_row FROM public.product_reviews
  WHERE buyer_id = v_user AND order_item_id = p_order_item_id;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_verified_review(
  p_review_id uuid,
  p_rating int,
  p_title text DEFAULT NULL,
  p_comment text DEFAULT NULL
)
RETURNS public.product_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.product_reviews;
  v_title text;
  v_comment text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Tu sesión expiró. Inicia sesión de nuevo.' USING ERRCODE = '42501';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'La puntuación debe ser entre 1 y 5 estrellas.' USING ERRCODE = '22023';
  END IF;

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  v_comment := NULLIF(btrim(COALESCE(p_comment, '')), '');
  IF v_title IS NOT NULL AND length(v_title) > 120 THEN
    RAISE EXCEPTION 'El título no puede superar los 120 caracteres.' USING ERRCODE = '22001';
  END IF;
  IF v_comment IS NOT NULL AND length(v_comment) > 1500 THEN
    RAISE EXCEPTION 'El comentario no puede superar los 1500 caracteres.' USING ERRCODE = '22001';
  END IF;

  SELECT * INTO v_row FROM public.product_reviews WHERE id = p_review_id;
  IF v_row.id IS NULL OR v_row.buyer_id <> v_user THEN
    RAISE EXCEPTION 'No tienes permiso para realizar esta acción.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.product_reviews
  SET rating = p_rating, title = v_title, body = v_comment, updated_at = now()
  WHERE id = p_review_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_verified_review(uuid, int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_verified_review(uuid, int, text, text) TO authenticated;
