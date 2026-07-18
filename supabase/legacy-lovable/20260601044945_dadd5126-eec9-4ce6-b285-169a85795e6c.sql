-- Shipping zones (admin-managed)
CREATE TABLE public.shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  emirates emirate[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shipping_zones TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_zones TO authenticated;
GRANT ALL ON public.shipping_zones TO service_role;

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Zones: public read active" ON public.shipping_zones
  FOR SELECT USING (is_active = true);
CREATE POLICY "Zones: admin all" ON public.shipping_zones
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_zones_touch BEFORE UPDATE ON public.shipping_zones
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Shipping rates (default when seller_id is NULL, override per seller otherwise)
CREATE TABLE public.shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  base_aed numeric NOT NULL DEFAULT 0,
  per_kg_aed numeric NOT NULL DEFAULT 0,
  free_above_aed numeric,
  sla_min_days integer NOT NULL DEFAULT 1,
  sla_max_days integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX shipping_rates_default_zone_uniq
  ON public.shipping_rates (zone_id) WHERE seller_id IS NULL;
CREATE UNIQUE INDEX shipping_rates_seller_zone_uniq
  ON public.shipping_rates (seller_id, zone_id) WHERE seller_id IS NOT NULL;

GRANT SELECT ON public.shipping_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_rates TO authenticated;
GRANT ALL ON public.shipping_rates TO service_role;

ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rates: public read active" ON public.shipping_rates
  FOR SELECT USING (is_active = true);
CREATE POLICY "Rates: admin all" ON public.shipping_rates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Rates: seller manage own" ON public.shipping_rates
  FOR ALL TO authenticated
  USING (seller_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sellers s WHERE s.id = shipping_rates.seller_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (seller_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sellers s WHERE s.id = shipping_rates.seller_id AND s.user_id = auth.uid()
  ));

CREATE TRIGGER trg_rates_touch BEFORE UPDATE ON public.shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Orders: add shipping context columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_zone_id uuid REFERENCES public.shipping_zones(id),
  ADD COLUMN IF NOT EXISTS weight_grams_total integer,
  ADD COLUMN IF NOT EXISTS sla_min_days integer,
  ADD COLUMN IF NOT EXISTS sla_max_days integer;
