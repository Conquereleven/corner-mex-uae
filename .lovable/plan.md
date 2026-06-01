## Cierre de Fase 6

Tareas pendientes para dejar Fase 6 completa:

### 1. `robots.txt` + sitemap discovery
- Crear `public/robots.txt` con `User-agent: *` / `Allow: /` y directiva `Sitemap: https://corner-mex-uae.lovable.app/api/public/sitemap.xml`.
- Bloquear rutas privadas: `Disallow: /account`, `/admin`, `/seller`, `/checkout`, `/login`, `/signup`.

### 2. Regenerar tipos de Supabase
- Tras las migraciones de Fase 6 (coupons, coupon_redemptions, promo_banners, newsletter_subscribers, columnas nuevas en `orders`), refrescar `src/integrations/supabase/types.ts` para que los server functions tengan tipos correctos y desaparezcan los `any` residuales.

### 3. Página de cupones para sellers
- Nueva ruta `src/routes/_authenticated/seller.coupons.tsx`: listar cupones propios del seller, crear/editar/desactivar (scope = su `seller_id`).
- Extender `src/lib/coupons.functions.ts` con `sellerListCoupons`, `sellerUpsertCoupon`, `sellerToggleCoupon` (middleware `requireSupabaseAuth` + verificación de `seller_id` del usuario).
- Añadir entrada "Coupons" en el sidebar de `src/routes/_authenticated/seller.tsx`.
- Ajustar `evaluateCoupon` si hace falta para respetar `seller_id` cuando un cupón es por-seller (verificar que ya filtra por items del seller en el carrito).

### 4. SEO menor
- Añadir `head()` con title/description/og en rutas públicas que aún no lo tengan claro (revisión rápida de `about.tsx`, `b2b.tsx`, `sellers.tsx`).
- Confirmar JSON-LD `Organization` en `__root.tsx` (si falta, añadir).

### Out of scope (para fases siguientes)
- i18n completo + RTL Arabic.
- Dashboard analítico avanzado (más allá de `admin.performance`).
- Campañas de email transaccional desde newsletter (solo capturamos subs por ahora).

¿Procedo con estas 4 tareas en build mode?
