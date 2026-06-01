## Cableado restante Fase 5

Conectar los módulos ya creados (reviews, wishlist, loyalty, returns) al resto de la app.

### 1. Wishlist en cards de producto
- Insertar `<WishlistButton productId={...} />` en `ProductCard` (esquina superior derecha de la imagen, absolute).
- Asegurar que funciona también en la grilla de la home, categorías, búsqueda y storefront del seller.

### 2. Reviews en ficha de producto
- En `routes/products.$slug.tsx` (o equivalente), añadir sección `<ProductReviews productId={...} />` debajo de la descripción.
- Mostrar promedio de estrellas + número de reseñas junto al título del producto (usando `getProductRatingSummary` desde `reviews.functions.ts`).
- En las cards de producto, mostrar mini-rating (★ 4.5 · 12) bajo el nombre cuando exista.

### 3. Navegación seller y admin
- **Seller sidebar** (`routes/_authenticated/seller.tsx`): añadir link "Devoluciones" → `/seller/returns`.
- **Admin sidebar** (`routes/_authenticated/admin.tsx`): añadir links "Reseñas" → `/admin/reviews` y "Devoluciones" → `/admin/returns`.

### 4. Acumulación de puntos de fidelidad
- En `orders.functions.ts` → `placeOrder`, después de crear la orden llamar `awardOrderPoints({ userId, orderId, subtotalAed })`.
- Disparar también notificación in-app "Has ganado X puntos" y actualización de tier si corresponde (la lógica ya vive en `loyalty.functions.ts`).
- Mostrar badge de tier (bronze/silver/gold/platinum) en el header del `/account` junto al nombre.

### 5. Detalles técnicos
- Invalidar queries: tras toggle wishlist → `["wishlist"]`; tras review submit → `["reviews", productId]` y `["product-rating", productId]`.
- El `WishlistButton` ya existe; solo cablearlo. Si el usuario no está autenticado, redirigir a `/login`.
- Reviews: filtrar por `status = 'approved'` en la vista pública (RLS ya lo hace, pero ser explícito en la query).
- Puntos: usar la fórmula ya definida en `loyalty.functions.ts` (multiplier por tier sobre `subtotal_aed`).

### Archivos a editar
- `src/components/site/ProductCard.tsx` (wishlist + rating)
- `src/routes/products.$slug.tsx` (reviews + rating en header)
- `src/routes/_authenticated/seller.tsx` (link returns)
- `src/routes/_authenticated/admin.tsx` (links reviews + returns)
- `src/routes/_authenticated/account.tsx` (badge de tier)
- `src/lib/orders.functions.ts` (llamar awardOrderPoints)
- `src/lib/reviews.functions.ts` (añadir `getProductRatingSummary` si no existe)
