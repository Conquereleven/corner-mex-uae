ALTER TYPE public.catalog_event_type ADD VALUE IF NOT EXISTS 'checkout_started';
ALTER TYPE public.catalog_event_type ADD VALUE IF NOT EXISTS 'purchase_completed';

ALTER TABLE public.catalog_events
  ADD COLUMN IF NOT EXISTS revenue_aed numeric(12,2),
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS catalog_events_event_type_created_idx
  ON public.catalog_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS catalog_events_order_id_idx
  ON public.catalog_events (order_id) WHERE order_id IS NOT NULL;