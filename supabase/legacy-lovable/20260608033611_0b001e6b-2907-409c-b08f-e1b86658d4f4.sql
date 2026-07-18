-- Sequential, Shopify-style order numbers (#1000, #1001, ...)
CREATE SEQUENCE IF NOT EXISTS public.orders_display_seq START WITH 1000 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.orders_display_seq TO authenticated, service_role;

-- Backfill existing orders chronologically starting at 1000
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM public.orders
)
UPDATE public.orders o
SET order_number = '#' || (999 + r.rn)::text
FROM ranked r WHERE r.id = o.id;

-- Advance sequence past current max so the next insert is one above
SELECT setval(
  'public.orders_display_seq',
  GREATEST(999, (SELECT COUNT(*) FROM public.orders) + 999)
);

-- New orders auto-number via default
ALTER TABLE public.orders
  ALTER COLUMN order_number SET DEFAULT '#' || nextval('public.orders_display_seq')::text;