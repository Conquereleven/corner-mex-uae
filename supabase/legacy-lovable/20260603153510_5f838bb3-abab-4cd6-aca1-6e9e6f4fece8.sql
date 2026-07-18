
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS support_phone text,
  ADD COLUMN IF NOT EXISTS contact_address text,
  ADD COLUMN IF NOT EXISTS processing_days integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS auto_accept_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vacation_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacation_message text,
  ADD COLUMN IF NOT EXISTS payout_method text NOT NULL DEFAULT 'bank',
  ADD COLUMN IF NOT EXISTS bank_swift text,
  ADD COLUMN IF NOT EXISTS notify_new_order boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_low_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_payout boolean NOT NULL DEFAULT true;
