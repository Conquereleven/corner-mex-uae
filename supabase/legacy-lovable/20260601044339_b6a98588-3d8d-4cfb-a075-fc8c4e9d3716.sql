
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS assigned_admin_id uuid,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS converted_order_id uuid;

CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_buyer ON public.quotes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_assigned ON public.quotes(assigned_admin_id);

DROP TRIGGER IF EXISTS quotes_touch_updated_at ON public.quotes;
CREATE TRIGGER quotes_touch_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Admin can read & update all quotes (separate from buyer policy)
DROP POLICY IF EXISTS "Quotes: admin all" ON public.quotes;
CREATE POLICY "Quotes: admin all" ON public.quotes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
