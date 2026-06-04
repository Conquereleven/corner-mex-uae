# Fase 7c — Pulido final del Seller/Admin Studio

Cinco bloques. Todos los archivos clave ya existen; ampliamos lo que falta sin refactor mayor.

## 1. Comisiones + Solicitar Payout

**Backend** (`src/lib/seller.functions.ts`):
- `getSellerCommissions` se amplía para devolver `availableBalance` (neto lifetime − suma de payouts en estado `pending|processing|paid`) y `lastPayoutRequestAt`.
- Nueva `requestSellerPayout({ amount? })`:
  - Valida con zod (`amount > 0` y ≤ `availableBalance`, opcional → toma todo el saldo).
  - Bloquea si hay un payout `pending` o `processing` reciente (<24h) → toast informativo.
  - Inserta en `seller_payouts` con `status='pending'`, `period_start/end` = ventana desde el último payout pagado hasta hoy, `gross_aed`, `commission_aed`, `net_aed`, `requested_at = now()`.
  - Crea una notificación interna para admins (`notifications` con `type='payout_requested'`).

**Migración** (`supabase/migrations/...`): añadir columna `requested_at timestamptz` a `seller_payouts` si no existe.

**UI** (`src/routes/_authenticated/seller.commissions.tsx`):
- KPI nueva: "Available to withdraw" (`availableBalance`).
- Card con título "Request payout": Input AED + botón `Request payout` (deshabilitado si saldo = 0 o hay solicitud pendiente). Dialog de confirmación. Toast + invalidate.
- Link "Ver historial" → `/seller/payouts`.

**UI** (`src/routes/_authenticated/seller.payouts.tsx`):
- Mostrar columna `Requested at` cuando exista.
- Mismo botón `Request payout` arriba (reutiliza dialog).

## 2. Storefront — showcase de productos

**Migración**: `ALTER TABLE sellers ADD COLUMN IF NOT EXISTS featured_product_ids uuid[] DEFAULT '{}'::uuid[]; ADD COLUMN IF NOT EXISTS business_hours jsonb DEFAULT '{}'::jsonb;`

**Backend** (`src/lib/seller.functions.ts`):
- `getSellerStorefront` ahora también devuelve `featured_product_ids`, `business_hours` y la lista de productos activos del seller (`id`, `name`, `image`, `status`) para poder elegir.
- `updateSellerStorefront` acepta `featured_product_ids: string[]` (máx 8, todos deben pertenecer al seller y estar `active`) y `business_hours` (`{ mon: {open, close, closed}, … }` con zod).

**UI** (`src/routes/_authenticated/seller.storefront.tsx`):
- Nueva sección **"Productos destacados"**: grid de los productos activos con checkbox/toggle (máx 8). Vista previa lateral muestra los seleccionados.
- Nueva sección **"Horario"**: 7 filas (Lun–Dom) con `open`/`close` y switch "Cerrado".
- Preview en vivo del storefront público.

**Storefront público** (`src/routes/sellers.$slug.tsx`):
- Si `featured_product_ids.length > 0`, mostrar primero una sección "Featured" con esos productos en el orden elegido; el resto del catálogo queda debajo.
- Renderizar el bloque de horario debajo de la bio si tiene datos.

## 3. Settings — completar perfil + preferencias

**Migración**: añadir a `sellers` (`IF NOT EXISTS` para cada columna): `address_line1 text`, `address_line2 text`, `city text`, `country text`, `postal_code text`, `currency text DEFAULT 'AED'`, `tax_inclusive_pricing bool DEFAULT false`, `tax_rate numeric DEFAULT 0`, `accepted_payment_methods text[] DEFAULT ARRAY['card']`, `notify_review bool DEFAULT true`, `notify_return bool DEFAULT true`.

**Backend** (`src/lib/seller.functions.ts`):
- Ampliar `getSellerSettings`/`updateSellerSettings` schema con los campos arriba.

**UI** (`src/routes/_authenticated/seller.settings.tsx`):
- Nueva pestaña **"Address"** (líneas, ciudad, país via Select, CP).
- Pestaña **"Business"** añade Select de `currency` (AED/USD/EUR/MXN/SAR).
- Nueva pestaña **"Tax"**: switch `tax_inclusive_pricing` + input `tax_rate` (%).
- Pestaña **"Payout"** añade checkboxes `Accepted payment methods` (`card`, `apple_pay`, `google_pay`, `cod`, `bank_transfer`).
- Pestaña **"Notifications"** añade `notify_review` y `notify_return`.

## 4. Auditar y eliminar "SOON"

- `src/routes/_authenticated/admin.tsx`: el único item con `soon: true` (Settings → grupo Config) se elimina o se reemplaza por un placeholder real `/admin/settings`. **Decisión**: crear ruta mínima `/_authenticated/admin.settings.tsx` con tarjetas link a las páginas ya existentes (Categories, Coupons, Banners, Newsletter, Shipping) + nota "Más opciones próximamente con cambio reciente". Esto cumple "mensaje de estado con próximos pasos".
- Quitar la condición `item.soon` del sidebar (`DashboardShell.tsx`) o dejarla pero sin usos.
- `grep` final para confirmar 0 ocurrencias de `soon:` y `SOON` en `src/routes` y `src/components`.

## 5. Botón "Nuevo Producto" en Admin

Actualmente Admin solo tiene **Import CSV**. Añadir:

- **Backend** (`src/lib/admin.functions.ts`): nueva `adminUpsertProduct` que reutiliza la misma lógica que `upsertSellerProduct` pero recibe `seller_id` y usa `supabaseAdmin` (sin RLS de seller).
- **Ruta** `src/routes/_authenticated/admin.products.new.tsx`:
  - Header "New product (admin)" con Select de seller (de `adminListSellers` activos).
  - Reutiliza `<ProductForm>` (se le añade prop opcional `sellerId` que cuando viene fuerza el uso de `adminUpsertProduct` en vez de `upsertSellerProduct`).
- **Sidebar admin**: añadir item `New product` con icon `Plus` → `/admin/products/new` en el grupo Catalog (al lado de Import).
- **Seller**: el botón "New product" en `seller.products.tsx` ya enlaza a `/seller/products/new` — verificar visualmente que el `<Link>` envuelve correctamente y el click navega (es el patrón Shopify: lista + botón superior derecho → editor de página completa con tabs Images / Variants / Pricing / SEO / Status, todo eso ya vive en `ProductForm`).

## Fuera de alcance

- Cálculo automático de payouts por cron (sigue manual + solicitud).
- Editor de temas/colores custom del storefront.
- Conversión multi-divisa real (`currency` solo se guarda como preferencia).
- Verificación KYC del trade license.
