
-- Enums
DO $$ BEGIN
  CREATE TYPE public.carrier_code AS ENUM ('aramex','dhl','fedex','talabat','local_courier','pickup','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.shipment_status AS ENUM ('prepared','in_transit','delivered','returned','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_kind AS ENUM ('order_placed','order_confirmed','shipped','delivered','payout_paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Shipments
CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  carrier carrier_code NOT NULL,
  tracking_number text,
  tracking_url text,
  label_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  weight_grams integer,
  cost_aed numeric(10,2),
  notes text,
  status shipment_status NOT NULL DEFAULT 'prepared',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipments: seller own all" ON public.shipments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM sellers s WHERE s.id = shipments.seller_id AND s.user_id = auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM sellers s WHERE s.id = shipments.seller_id AND s.user_id = auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE POLICY "Shipments: buyer read own order" ON public.shipments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = shipments.order_id AND o.buyer_id = auth.uid()));

CREATE TRIGGER tg_shipments_updated_at BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX idx_shipments_order ON public.shipments(order_id);
CREATE INDEX idx_shipments_seller ON public.shipments(seller_id);

-- order_items.shipment_id
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL;

-- Notifications log
CREATE TABLE IF NOT EXISTS public.order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  kind notification_kind NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb
);

GRANT SELECT, INSERT ON public.order_notifications TO authenticated;
GRANT ALL ON public.order_notifications TO service_role;

ALTER TABLE public.order_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OrderNotifs: buyer/admin/seller read" ON public.order_notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_notifications.order_id AND o.buyer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM order_items oi JOIN sellers s ON s.id = oi.seller_id WHERE oi.order_id = order_notifications.order_id AND s.user_id = auth.uid())
    OR has_role(auth.uid(),'admin')
  );

CREATE INDEX idx_order_notifs_order ON public.order_notifications(order_id);
