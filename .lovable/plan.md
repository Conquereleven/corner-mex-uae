# Analítica de catálogo + cohortes de conversión

## 1. Eventos a medir

Una sola tabla `catalog_events` registra todo el embudo del catálogo, deduplicado por sesión:

| Evento             | Cuándo se dispara                                                 |
| ------------------ | ----------------------------------------------------------------- |
| `card_impression`  | Card visible ≥ 50% en `/shop` (IntersectionObserver, 1 vez/sesión por producto) |
| `card_click`       | Click en card → navega a detalle                                  |
| `product_view`     | Carga de `/product/$slug` (ya existe `product_views`, lo enlazamos) |
| `add_to_cart`      | Botón "Add to cart" en detalle                                    |
| `wishlist_add`     | Toggle wishlist a favorito                                        |
| `b2b_lead_submit`  | Envío de formulario B2B                                           |

Cada fila guarda: `event_type`, `product_id?`, `seller_id?`, `category_id?`, `user_id?`, `session_hash`, `source` (`shop`, `home`, `seller_page`, `search`), `created_at`. Dedupe a 30 min para impressions (igual que `track_product_view`).

## 2. Backend

**Migración** `catalog_events`:
- columnas arriba + índices en `(created_at)`, `(event_type, created_at)`, `(session_hash, event_type, product_id, created_at)`.
- RLS: `INSERT` permitido a `anon` y `authenticated` (con `WITH CHECK (true)` — son métricas); `SELECT` sólo admins.
- GRANT INSERT a `anon, authenticated`; SELECT/ALL a `service_role`.

**Server fns** en `src/lib/catalog-events.functions.ts`:
- `trackCatalogEvent({ eventType, productId?, source? })` — público, inserta con `supabaseAdmin` previa validación del tipo + rate dedupe por `(session_hash, event_type, product_id)` en 30 min.
- `getCatalogCohorts({ days, cohortBy })` — admin only. Devuelve cohortes semanales: por cada semana (de la primera impression de la sesión), # sesiones, # llegan a click, # a view, # a add_to_cart, % conversión paso a paso.
- `getCatalogFunnel({ days })` — totales y % por etapa.

## 3. Cliente

- `src/lib/track.ts`: helper `trackEvent(type, payload)` que asegura `session_hash` en `localStorage` y llama al server fn (fire-and-forget).
- `ProductCard`: IntersectionObserver para emitir `card_impression` 1 vez por producto/sesión; `onClick` del `<Link>` emite `card_click`.
- `product.$slug.tsx`: añadir `add_to_cart` al handler existente.
- `WishlistButton`: emitir `wishlist_add` al activar favorito.
- `b2b_.lead.tsx`: emitir `b2b_lead_submit` tras éxito.

## 4. Admin UI

Nueva pestaña en `admin.performance.tsx` ("Catálogo") o nueva ruta `/admin/catalog-analytics`:
- **Embudo** (barras): impressions → clicks → views → add_to_cart, con CTR / CVR.
- **Tabla de cohortes semanales**: filas = semana de primera impression, columnas = % que llegan a cada paso. Color heatmap.
- Selector de rango: 7 / 30 / 90 días.

## 5. Archivos

- crear `supabase/migrations/<ts>_catalog_events.sql`
- crear `src/lib/catalog-events.functions.ts`
- crear `src/lib/track.ts`
- crear `src/routes/_authenticated/admin.catalog-analytics.tsx`
- editar `src/components/site/ProductCard.tsx`, `WishlistButton.tsx`, `routes/product.$slug.tsx`, `routes/b2b_.lead.tsx`
- editar `admin.tsx` (nav link)

¿Procedo con todo, o prefieres priorizar (p. ej. sólo tracking + funnel ahora y cohortes después)?
