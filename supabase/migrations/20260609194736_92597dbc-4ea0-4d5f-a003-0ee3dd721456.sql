
CREATE TYPE public.b2b_lead_status AS ENUM ('new', 'contacted', 'quoting', 'closed', 'lost');

CREATE TABLE public.b2b_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  company text,
  email text NOT NULL,
  phone text,
  country_city text,
  business_type text,
  products_interest text,
  estimated_volume text,
  message text,
  contact_preference text,
  status public.b2b_lead_status NOT NULL DEFAULT 'new',
  admin_note text,
  contacted_at timestamptz,
  source text DEFAULT 'b2b_page',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.b2b_leads TO authenticated;
GRANT INSERT ON public.b2b_leads TO anon, authenticated;
GRANT ALL ON public.b2b_leads TO service_role;

ALTER TABLE public.b2b_leads ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a lead
CREATE POLICY "Public can submit b2b leads"
ON public.b2b_leads FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(coalesce(full_name,'')) BETWEEN 2 AND 200
  AND length(coalesce(email,'')) BETWEEN 5 AND 320
);

-- Only admins can read
CREATE POLICY "Admins can read b2b leads"
ON public.b2b_leads FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update / delete
CREATE POLICY "Admins can update b2b leads"
ON public.b2b_leads FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete b2b leads"
ON public.b2b_leads FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER b2b_leads_touch_updated_at
BEFORE UPDATE ON public.b2b_leads
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE INDEX b2b_leads_status_created_at_idx ON public.b2b_leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS product_views_viewed_at_idx ON public.product_views (viewed_at DESC);
