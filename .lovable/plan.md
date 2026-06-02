## Fase 7 — Pulido, editor de producto completo y bug fixes

Objetivo: dejar la plataforma lista para producción cerrando los huecos funcionales (especialmente el editor de producto del seller), arreglando bugs visibles y completando todos los CTAs.

### 1. Editor de producto completo (Seller Studio)

Hoy `ProductForm.tsx` solo permite una imagen vía URL y una variante única. Vamos a transformarlo en un editor real:

- **Galería de imágenes**
  - Crear bucket `product-images` (público) vía la herramienta de storage.
  - Políticas RLS: lectura pública; insert/update/delete solo para el seller dueño del producto o admin.
  - Componente `ProductImagesEditor`: drag-and-drop múltiple, preview, reorder (sort_order), borrar, fijar portada.
  - Server fns nuevos en `seller.functions.ts`: `addProductImage`, `removeProductImage`, `reorderProductImages`.
  - Reemplazar el campo "Image URL" actual por este editor.

- **Variantes múltiples**
  - Editor de tabla para `product_variants` (formato, SKU, precio, compare-at, stock, peso en g, bulk tiers JSON, `is_default`).
  - Server fns: `upsertVariant`, `deleteVariant`, `setDefaultVariant`.
  - Validación: al menos una variante, una sola `is_default`.

- **Traducciones ES/AR completas**
  - Hoy solo se guarda `name_es` / `name_ar`. Añadir `description_es` y `description_ar` en el form y persistirlos en `product_translations`.

- **Atributos avanzados**
  - Campos faltantes en el form: `is_halal`, `attrs` (JSON libre con key/value editor simple), peso por defecto, `category_id` real (ya existe slug, vincularlo a la tabla `categories` por id).

- **Acciones de ciclo de vida**
  - Botones explícitos: Guardar borrador, Publicar, Archivar, Duplicar producto, Eliminar (con confirm).

### 2. Bug fixes generales

- **Home**: en la tarjeta sobre la imagen de chiles dice `SKUs · 18 sellers`. Dejar solo `120+ SKUs` (eliminar "· 18 sellers" de `src/routes/index.tsx`).
- Revisar y arreglar:
  - Links/botones rotos o sin `to`/`onClick` (auditoría rápida en Header, Footer, Hero, Categories, B2BBlock, ProductCard, dashboards).
  - Estados vacíos sin CTA (carrito vacío, wishlist vacía, sin pedidos, sin cupones, sin notificaciones).
  - Toasts/errores silenciosos en mutaciones (asegurar `onError` con mensaje).
  - Imágenes con `alt=""` en contenido relevante.
  - Validación de formularios de signup/login (mensajes claros).

### 3. CTAs faltantes

Auditar y añadir acción real a botones decorativos:
- Footer: botón newsletter ya tiene; revisar enlaces de "About", "B2B", "Sellers", "Contact".
- Header móvil: asegurar que todos los items navegan.
- Tarjetas de seller en `/sellers`: botón "Visit store" → `/sellers/$slug`.
- ProductCard: botón secundario (wishlist) con feedback.
- Dashboards: items marcados `soon: true` mostrar tooltip "Coming soon" en vez de quedar muertos.
- Páginas `about`, `b2b`: CTA final hacia `/shop` o `/b2b/quote`.
- Página `order-confirmed`: botones "Continue shopping" y "Track order".

### 4. Cambios técnicos

```text
DB migration
  - storage bucket: product-images (público) + políticas RLS

Files (nuevos)
  - src/components/site/ProductImagesEditor.tsx
  - src/components/site/ProductVariantsEditor.tsx

Files (editados)
  - src/components/site/ProductForm.tsx   (integra los dos editores + nuevos campos)
  - src/lib/seller.functions.ts           (imágenes, variantes, duplicar, archivar)
  - src/routes/index.tsx                  (quita "18 sellers")
  - Header/Footer/SiteLayout, ProductCard, dashboards          (CTAs)
  - src/routes/_authenticated/seller.products.$id.tsx          (usa nuevo form)
  - src/routes/_authenticated/seller.products.new.tsx          (idem)
```

### Fuera de alcance (para Fase 8)

- i18n completo + RTL Arabic.
- Multi-currency / multi-warehouse.
- Campañas de email transaccional automáticas (más allá de capturar subs).
- Editor visual de bulk tiers con curvas de descuento.

¿Apruebo y empiezo a construir?
