
-- Extend product_status with 'rejected'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='rejected' AND enumtypid='product_status'::regtype) THEN
    ALTER TYPE product_status ADD VALUE 'rejected';
  END IF;
END $$;

-- Extend quote_status with CRM stages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='contacted' AND enumtypid='quote_status'::regtype) THEN
    ALTER TYPE quote_status ADD VALUE 'contacted';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='negotiating' AND enumtypid='quote_status'::regtype) THEN
    ALTER TYPE quote_status ADD VALUE 'negotiating';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='won' AND enumtypid='quote_status'::regtype) THEN
    ALTER TYPE quote_status ADD VALUE 'won';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='lost' AND enumtypid='quote_status'::regtype) THEN
    ALTER TYPE quote_status ADD VALUE 'lost';
  END IF;
END $$;

-- products: approval note
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS approval_note text;

-- orders: paid_at
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- sellers: house account flag
ALTER TABLE public.sellers ADD COLUMN IF NOT EXISTS is_house_account boolean NOT NULL DEFAULT false;

-- quotes: CRM fields
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS estimated_value_aed numeric(12,2);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_priority_chk CHECK (priority IS NULL OR priority IN ('low','medium','high'));
