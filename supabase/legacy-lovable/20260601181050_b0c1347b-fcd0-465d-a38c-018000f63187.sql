DROP POLICY IF EXISTS "Newsletter: anyone subscribe" ON public.newsletter_subscribers;

CREATE POLICY "Newsletter: anyone subscribe" ON public.newsletter_subscribers
  FOR INSERT TO public
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 254
    AND email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
    AND status = 'subscribed'
  );