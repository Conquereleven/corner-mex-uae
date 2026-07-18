
-- Sellers: schedule + KYC + theme
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS payout_schedule text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS min_payout_aed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_auto_payout_at timestamptz,
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason text,
  ADD COLUMN IF NOT EXISTS kyc_documents jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sellers
  DROP CONSTRAINT IF EXISTS sellers_payout_schedule_chk,
  ADD CONSTRAINT sellers_payout_schedule_chk CHECK (payout_schedule IN ('manual','weekly','biweekly','monthly')),
  DROP CONSTRAINT IF EXISTS sellers_kyc_status_chk,
  ADD CONSTRAINT sellers_kyc_status_chk CHECK (kyc_status IN ('unverified','pending','verified','rejected'));

-- seller_payouts: review fields
ALTER TABLE public.seller_payouts
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- currency_rates
CREATE TABLE IF NOT EXISTS public.currency_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base text NOT NULL DEFAULT 'AED',
  quote text NOT NULL,
  rate numeric NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base, quote)
);

GRANT SELECT ON public.currency_rates TO anon, authenticated;
GRANT ALL ON public.currency_rates TO service_role;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Currency rates public read" ON public.currency_rates;
CREATE POLICY "Currency rates public read" ON public.currency_rates FOR SELECT TO anon, authenticated USING (true);

-- Seed defaults so the UI works before the cron runs once
INSERT INTO public.currency_rates (base, quote, rate) VALUES
  ('AED','USD',0.2723),('AED','EUR',0.2510),('AED','SAR',1.0210),('AED','MXN',5.5400),('AED','GBP',0.2150)
ON CONFLICT (base, quote) DO NOTHING;

-- Storage policies for new private buckets (buckets are created via storage_create_bucket)
-- seller-kyc: seller owns folder = seller_id; admins read all
DROP POLICY IF EXISTS "kyc seller insert" ON storage.objects;
CREATE POLICY "kyc seller insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'seller-kyc'
    AND EXISTS (SELECT 1 FROM public.sellers s WHERE s.user_id = auth.uid() AND s.id::text = split_part(name, '/', 1))
  );

DROP POLICY IF EXISTS "kyc seller read" ON storage.objects;
CREATE POLICY "kyc seller read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'seller-kyc' AND (
      has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.user_id = auth.uid() AND s.id::text = split_part(name, '/', 1))
    )
  );

DROP POLICY IF EXISTS "kyc seller delete" ON storage.objects;
CREATE POLICY "kyc seller delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'seller-kyc' AND (
      has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.user_id = auth.uid() AND s.id::text = split_part(name, '/', 1))
    )
  );

-- payout-receipts: admins write/read, seller reads own payout's receipt
DROP POLICY IF EXISTS "payout receipts admin all" ON storage.objects;
CREATE POLICY "payout receipts admin all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'payout-receipts' AND has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'payout-receipts' AND has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "payout receipts seller read own" ON storage.objects;
CREATE POLICY "payout receipts seller read own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payout-receipts' AND (
      has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.seller_payouts p
        JOIN public.sellers s ON s.id = p.seller_id
        WHERE s.user_id = auth.uid() AND p.receipt_path = name
      )
    )
  );
