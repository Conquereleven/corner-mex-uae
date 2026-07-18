-- Remove public exposure of sensitive seller fields (bank info, contact, TRN).
-- All public-facing seller reads go through server functions that use the
-- admin client and explicitly project safe columns only.
DROP POLICY IF EXISTS "Sellers: public read active" ON public.sellers;
REVOKE SELECT ON public.sellers FROM anon;