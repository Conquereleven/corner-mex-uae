# Fase 7d — Cierre de pendientes Seller/Admin

Ocho bloques. Reutilizamos el patrón actual (`createServerFn` + Tanstack Query + shadcn). Migraciones agrupadas en un solo archivo.

## 1. Cron automático de payouts (semanal)

- **Migración**: nueva columna `sellers.payout_schedule text default 'manual'` (`manual|weekly|biweekly|monthly`) + `sellers.min_payout_aed numeric default 0`.
- **Server route** `src/routes/api/public/hooks/auto-payouts.ts` (POST, valida `apikey` header = anon key):
  - Itera sellers con `payout_schedule != 'manual'` cuya última solicitud/payout sea anterior a la ventana.
  - Calcula `availableBalance` (reusa lógica de `getSellerCommissions`) y, si ≥ `min_payout_aed`, inserta `seller_payouts` con `status='pending'`, `requested_at=now()`, `period_*` correspondiente.
  - Crea notificación admin (`type='payout_auto_requested'`) y seller (`type='payout_requested'`).
- **pg_cron** (vía `supabase--insert`): job diario 02:00 que llama al endpoint con anon key.
- **UI**: en `/seller/settings` pestaña "Payout" añadir Select `payout_schedule` y Input `min_payout_aed`. La solicitud manual sigue funcionando (sin tocar).

## 2. Editor de temas/colores del storefront

- **Migración**: `sellers.theme jsonb default '{}'` con shape `{ primary, accent, bg, text, font, radius, layout }`.
- **Backend** (`seller.functions.ts`): `getSellerStorefront`/`updateSellerStorefront` incluyen `theme` (zod). Validar colores hex y `radius` ∈ `none|sm|md|lg|xl`, `layout` ∈ `grid|masonry|list`.
- **UI** `/seller/storefront`: nueva tarjeta **Theme** con 4 color pickers (input type=color + hex), Select font (`Inter|Playfair|Space Grotesk|System`), Select radius, Select layout. Preview en vivo con `style={{ '--store-primary': ... }}`.
- **Público** `sellers.$slug.tsx`: aplica el tema vía `style` inline en el wrapper raíz (CSS vars), sin sobreescribir el theme global del sitio.

## 3. Multi-divisa real (conversión)

- **Migración**: tabla `currency_rates` (`base text default 'AED'`, `quote text`, `rate numeric`, `fetched_at timestamptz`), índice único `(base, quote)`. GRANT select a `anon,authenticated`, all a `service_role`. RLS read-public.
- **Server route** `src/routes/api/public/hooks/refresh-rates.ts` (POST, anon-key gated): fetch a API pública (exchangerate.host, no key) para `AED→USD,EUR,SAR,MXN,GBP`. Upsert.
- **pg_cron**: job diario 03:00.
- **Helper isomorphic** `src/lib/currency.ts`: `convert(amount, from, to, rates)` + `formatMoney(amount, currency)`.
- **Backend**: `getCurrencyRates` server fn (cached por request) + lo expone en `getMyAccount` / loaders relevantes.
- **UI**: 
  - Header: Select de moneda (persistido en `localStorage`, default seller currency o AED).
  - `ProductCard`, página de producto, cart, checkout: muestran precio convertido + sufijo de moneda. El **cobro** sigue en AED (nota visible en checkout: "Charged in AED at current rate").
  - `/seller/settings` Business currency ahora se usa como display default del seller.

## 4. Verificación KYC del trade license

- **Migración**: `sellers.kyc_status text default 'unverified'` (`unverified|pending|verified|rejected`), `kyc_submitted_at`, `kyc_reviewed_at`, `kyc_rejection_reason text`, `kyc_documents jsonb default '[]'` (`[{ kind, path, uploaded_at }]`). Bucket existente `product-images` no sirve por privacidad → nuevo **bucket privado `seller-kyc`**.
- **Storage policies** (migración): solo el seller dueño puede insertar/leer su carpeta `{seller_id}/...`; admins (`has_role('admin')`) leen todo.
- **Backend** (`seller.functions.ts`): `uploadKycDocument` (kind: `trade_license|emirates_id|passport|other`), `submitKycForReview` (cambia a `pending`), `getKycStatus`. (`admin.functions.ts`): `adminListKycSubmissions`, `adminReviewKyc({ seller_id, decision, reason? })` con notificación al seller.
- **UI seller** `/seller/settings` nueva pestaña **Verification**: estado actual, uploader por documento (signed URLs), botón "Submit for review" deshabilitado hasta tener al menos `trade_license`. Banner en dashboard si `unverified|rejected`.
- **UI admin** nueva ruta `/admin/sellers/kyc` (lista pendientes, modal con preview de docs + aprobar/rechazar + razón).
- **Gating**: solo bloquea **payouts** (no ventas) si `kyc_status != 'verified'`. `requestSellerPayout` y cron lo verifican.

## 5. Historial de solicitudes de payout (seller)

`seller.payouts.tsx` ya tiene tabla; ampliamos:
- Toggle/tabs **Todas | Pendientes | Pagadas | Rechazadas**.
- Columnas añadidas: `Requested at`, `Reviewed at`, `Reviewer note` (collapsible), `Receipt` (link a archivo si existe).
- KPI extra: "Tiempo promedio de procesamiento" (días entre `requested_at` y `paid_at` de payouts pagados).
- Reuso del estado `cancelled` como **rechazado** (ya existe en STATUS_TONE) + label "Rejected" cuando `review_note` exista.

## 6. Tabla detallada de comisiones por periodo

`seller.commissions.tsx`:
- Nueva sección **"Detalle por periodo"** con Select de granularidad (Semana | Mes | Trimestre) + rango de fechas (DateRangePicker).
- Tabla columnas: Periodo · Pedidos · Unidades · GMV bruto · Reembolsos · GMV neto · % comisión efectiva · Comisión · **Ganancia neta** · Acción "Export CSV".
- Backend: ampliar `getSellerCommissions({ granularity, from, to })` para devolver `periods[]` con esos campos. Reembolsos se obtienen de `returns` con `status='refunded'` cruzando `order_items`.
- Botón global "Export CSV" genera blob client-side desde los datos cargados.

## 7. Storefront: categorías + drag-and-drop de destacados

`seller.storefront.tsx`:
- Selector de productos destacados ahora muestra **filtro por categoría** (Select cargado desde `categories` activas que tiene el seller).
- Lista de seleccionados con drag-and-drop usando `@dnd-kit/core` + `@dnd-kit/sortable` (ya disponible en el proyecto; si no, `bun add`). Reordenar actualiza `featured_product_ids` antes de guardar.
- Backend ya guarda el orden — solo respetar el array.

## 8. Admin: aprobación/rechazo de payouts

Nueva ruta `/admin/payouts` se amplía (o se reescribe `admin.payouts.tsx`):
- Tabla pendientes con KPIs (pending count, monto pendiente).
- Acción por fila: **Approve & mark paid** y **Reject**.
- Dialog: Textarea `note` obligatoria + uploader opcional `receipt` (PDF/imagen) → bucket privado nuevo **`payout-receipts`** (RLS: insert/select admin, select seller dueño del payout).
- **Migración**: `seller_payouts.review_note text`, `seller_payouts.receipt_path text`, `seller_payouts.reviewed_by uuid`, `reviewed_at timestamptz`.
- **Backend** (`admin.functions.ts`): `adminApprovePayout({ id, note?, receipt_path? })` → `status='paid'`, `paid_at=now()`. `adminRejectPayout({ id, note, receipt_path? })` → `status='cancelled'`. Ambos crean notificación al seller (`payout_paid` | `payout_rejected`).
- Link visible desde `/admin/commissions`/sidebar Finance.

## Detalles técnicos comunes

- Una sola migración cubre §1, §2, §3, §4, §5(none), §8 + buckets.
- Buckets nuevos: `seller-kyc` (privado), `payout-receipts` (privado). Se crean con `supabase--storage_create_bucket` + policies en la migración.
- Notificaciones nuevas: `payout_auto_requested`, `payout_paid`, `payout_rejected`, `kyc_submitted`, `kyc_approved`, `kyc_rejected`.
- Cron jobs registrados vía `supabase--insert` (no migración) con `apikey` header.
- `requestSellerPayout` bloquea si KYC no verificado (toast claro).

## Fuera de alcance

- Pasarela real de transferencia bancaria (los pagos siguen marcados manualmente por admin).
- Sub-rates de comisión por categoría.
- Multi-currency en el cobro (sólo display + tasa informativa).
- OCR automático del trade license (revisión humana).

## Orden de implementación sugerido

1. Migración única + buckets.
2. Backend (`seller.functions.ts`, `admin.functions.ts`, `currency.ts`).
3. Cron routes + registro de jobs.
4. UIs en este orden: payouts (admin + seller history) → comisiones detalladas → storefront (tema + dnd) → KYC → multi-divisa.
