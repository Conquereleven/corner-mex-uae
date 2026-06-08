
-- Add seller banner_url
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS banner_url text;

-- order_notes: internal admin/seller notes on an order
CREATE TABLE IF NOT EXISTS public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_role text NOT NULL DEFAULT 'admin',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO authenticated;
GRANT ALL ON public.order_notes TO service_role;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_notes_admin_all" ON public.order_notes;
CREATE POLICY "order_notes_admin_all" ON public.order_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "order_notes_seller_own" ON public.order_notes;
CREATE POLICY "order_notes_seller_own" ON public.order_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.sellers s ON s.id = oi.seller_id
      WHERE oi.order_id = order_notes.order_id AND s.user_id = auth.uid()
    )
  );
CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON public.order_notes(order_id);

-- order_events: simple timeline (status changes, shipment, notes)
CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_role text NOT NULL DEFAULT 'system',
  kind text NOT NULL,
  message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_events_admin_all" ON public.order_events;
CREATE POLICY "order_events_admin_all" ON public.order_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "order_events_seller_own" ON public.order_events;
CREATE POLICY "order_events_seller_own" ON public.order_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.sellers s ON s.id = oi.seller_id
      WHERE oi.order_id = order_events.order_id AND s.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "order_events_buyer_own" ON public.order_events;
CREATE POLICY "order_events_buyer_own" ON public.order_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_events.order_id AND o.buyer_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON public.order_events(order_id);
