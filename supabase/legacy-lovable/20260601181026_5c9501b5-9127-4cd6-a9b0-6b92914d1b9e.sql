-- ============ Coupons ============
CREATE TYPE public.coupon_kind AS ENUM ('percent', 'fixed');

CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  kind coupon_kind NOT NULL,
  value numeric NOT NULL,
  min_subtotal_aed numeric NOT NULL DEFAULT 0,
  max_discount_aed numeric,
  seller_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coupons TO anon;
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coupons: public read active" ON public.coupons
  FOR SELECT TO public
  USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));

CREATE POLICY "Coupons: admin all" ON public.coupons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Coupons: seller manage own" ON public.coupons
  FOR ALL TO authenticated
  USING (seller_id IS NOT NULL AND EXISTS (SELECT 1 FROM sellers s WHERE s.id = coupons.seller_id AND s.user_id = auth.uid()))
  WITH CHECK (seller_id IS NOT NULL AND EXISTS (SELECT 1 FROM sellers s WHERE s.id = coupons.seller_id AND s.user_id = auth.uid()));

CREATE TRIGGER tg_coupons_touch BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ Coupon redemptions ============
CREATE TABLE public.coupon_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id uuid NOT NULL,
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  discount_aed numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Redemptions: own read" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- ============ Orders: coupon fields ============
ALTER TABLE public.orders
  ADD COLUMN coupon_id uuid,
  ADD COLUMN coupon_code text,
  ADD COLUMN discount_aed numeric NOT NULL DEFAULT 0;

-- ============ Promo banners ============
CREATE TABLE public.promo_banners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  image_url text,
  link_url text,
  cta_label text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.promo_banners TO anon;
GRANT SELECT ON public.promo_banners TO authenticated;
GRANT ALL ON public.promo_banners TO service_role;

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Banners: public read active" ON public.promo_banners
  FOR SELECT TO public
  USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));

CREATE POLICY "Banners: admin all" ON public.promo_banners
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tg_promo_banners_touch BEFORE UPDATE ON public.promo_banners
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ Newsletter subscribers ============
CREATE TABLE public.newsletter_subscribers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  locale text NOT NULL DEFAULT 'en',
  source text,
  status text NOT NULL DEFAULT 'subscribed',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.newsletter_subscribers TO anon;
GRANT INSERT, SELECT ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Newsletter: anyone subscribe" ON public.newsletter_subscribers
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Newsletter: admin read" ON public.newsletter_subscribers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Newsletter: admin all" ON public.newsletter_subscribers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_coupons_code ON public.coupons (code);
CREATE INDEX idx_coupon_redemptions_order ON public.coupon_redemptions (order_id);
CREATE INDEX idx_promo_banners_active ON public.promo_banners (is_active, sort_order);