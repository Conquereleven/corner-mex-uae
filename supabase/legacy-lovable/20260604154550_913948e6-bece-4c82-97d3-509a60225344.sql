ALTER TABLE public.seller_payouts ADD COLUMN IF NOT EXISTS requested_at timestamptz;

ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS featured_product_ids uuid[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS business_hours jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS tax_inclusive_pricing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_payment_methods text[] DEFAULT ARRAY['card']::text[],
  ADD COLUMN IF NOT EXISTS notify_review boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_return boolean DEFAULT true;