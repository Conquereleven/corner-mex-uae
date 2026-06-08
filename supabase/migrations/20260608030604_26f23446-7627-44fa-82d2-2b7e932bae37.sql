
DO $$
DECLARE
  intermex_id uuid;
BEGIN
  SELECT id INTO intermex_id FROM public.sellers WHERE slug = 'intermex-prueba' LIMIT 1;
  IF intermex_id IS NULL THEN
    RAISE EXCEPTION 'Aborting reset: seller "intermex-prueba" not found';
  END IF;

  DELETE FROM public.order_events;
  DELETE FROM public.order_notes;
  DELETE FROM public.order_notifications;
  DELETE FROM public.shipments;
  DELETE FROM public.returns;
  DELETE FROM public.payments;
  DELETE FROM public.coupon_redemptions;
  DELETE FROM public.order_items;
  DELETE FROM public.orders;

  DELETE FROM public.product_reviews
    WHERE product_id IN (SELECT id FROM public.products WHERE seller_id <> intermex_id);
  DELETE FROM public.product_images
    WHERE product_id IN (SELECT id FROM public.products WHERE seller_id <> intermex_id);
  DELETE FROM public.product_translations
    WHERE product_id IN (SELECT id FROM public.products WHERE seller_id <> intermex_id);
  DELETE FROM public.product_variants
    WHERE product_id IN (SELECT id FROM public.products WHERE seller_id <> intermex_id);
  DELETE FROM public.products WHERE seller_id <> intermex_id;

  DELETE FROM public.seller_payouts WHERE seller_id <> intermex_id;
  DELETE FROM public.shipping_rates WHERE seller_id IS NOT NULL AND seller_id <> intermex_id;
  DELETE FROM public.coupons WHERE seller_id IS NOT NULL AND seller_id <> intermex_id;

  DELETE FROM public.sellers WHERE id <> intermex_id;
END$$;
