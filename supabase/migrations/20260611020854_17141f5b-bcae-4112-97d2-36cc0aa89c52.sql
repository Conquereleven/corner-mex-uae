
CREATE TYPE public.catalog_event_type AS ENUM (
  'card_impression','card_click','product_view','add_to_cart','wishlist_add','b2b_lead_submit'
);

CREATE TABLE public.catalog_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.catalog_event_type NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  user_id uuid,
  session_hash text,
  source text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX catalog_events_created_idx ON public.catalog_events (created_at DESC);
CREATE INDEX catalog_events_type_created_idx ON public.catalog_events (event_type, created_at DESC);
CREATE INDEX catalog_events_session_idx ON public.catalog_events (session_hash, event_type, product_id, created_at DESC);
CREATE INDEX catalog_events_product_idx ON public.catalog_events (product_id, created_at DESC);

GRANT INSERT ON public.catalog_events TO anon, authenticated;
GRANT SELECT ON public.catalog_events TO authenticated;
GRANT ALL ON public.catalog_events TO service_role;

ALTER TABLE public.catalog_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert catalog events"
  ON public.catalog_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "admins read catalog events"
  ON public.catalog_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
