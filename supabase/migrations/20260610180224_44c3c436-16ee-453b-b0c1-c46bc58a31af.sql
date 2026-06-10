CREATE INDEX IF NOT EXISTS products_active_created_id_idx
  ON public.products (created_at DESC, id DESC)
  WHERE status = 'active';