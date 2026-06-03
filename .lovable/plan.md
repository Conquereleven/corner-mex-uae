# Fase 7b — Completar funciones "SOON" del Seller Studio

Reemplazar los tres items marcados como `SOON` en el sidebar del seller por páginas funcionales reales.

## 1. Commissions (`/seller/commissions`)

Página de transparencia de comisiones por venta.

- **Server fn nueva** en `seller.functions.ts`: `getSellerCommissions`
  - Lee `order_items` del seller (últimos 90 días + lifetime)
  - Agrupa por mes: GMV, comisión cobrada, neto
  - Calcula tasa efectiva (commission / gmv)
  - Devuelve breakdown por categoría/producto top
  - Devuelve la tasa configurada en `sellers.commission_rate` (si existe) o la default de plataforma
- **Ruta** `src/routes/_authenticated/seller.commissions.tsx`:
  - KPIs: tasa actual, comisión 30d, comisión lifetime, neto lifetime
  - Tabla mensual (mes, pedidos, GMV, comisión, neto, tasa efectiva)
  - Top 5 productos por comisión generada
  - Nota legal explicando cómo se calcula

## 2. Storefront (`/seller/storefront`)

Editor del perfil público del seller (la página `/sellers/$slug`).

- **Server fns nuevas** en `seller.functions.ts`:
  - `getSellerStorefront` — devuelve datos editables del row `sellers`
  - `updateSellerStorefront` — actualiza: `display_name`, `tagline`, `bio`, `logo_url`, `cover_url`, `country`, `social_links` (jsonb: instagram, website, whatsapp), `is_published`
  - `uploadSellerAsset` — sube logo/cover al bucket `product-images` (reutilizado) con signed URL a 10 años, o crear bucket `seller-assets` si conviene
- **Migración**: añadir columnas faltantes a `sellers` si no existen (`tagline`, `cover_url`, `social_links jsonb`, `is_published bool default true`)
- **Ruta** `src/routes/_authenticated/seller.storefront.tsx`:
  - Form con preview en vivo
  - Inputs para logo y cover (drag & drop, reusa patrón de `ProductImagesEditor`)
  - Toggle "Storefront público"
  - Link directo a `/sellers/{slug}` para previsualizar
  - Botón "Copiar link"

## 3. Settings (`/seller/settings`)

Configuración operativa de la cuenta seller.

- **Server fns nuevas** en `seller.functions.ts`:
  - `getSellerSettings` — devuelve campos no-públicos
  - `updateSellerSettings` — actualiza:
    - **Negocio**: `legal_name`, `trade_license`, `vat_number`
    - **Contacto**: `support_email`, `support_phone`, `contact_address`
    - **Operaciones**: `processing_days` (1–14), `auto_accept_orders` bool, `vacation_mode` bool + `vacation_message`
    - **Payout**: `payout_method` (bank|wallet), `bank_name`, `iban`, `swift`, `account_holder`
    - **Notificaciones**: `notify_new_order`, `notify_low_stock`, `notify_payout` (bool)
- **Migración**: añadir columnas faltantes a `sellers` para los campos arriba que no existen
- **Ruta** `src/routes/_authenticated/seller.settings.tsx`:
  - Tabs: Business · Contact · Operations · Payout · Notifications
  - Validación con zod, toasts de éxito/error
  - Banner si `vacation_mode = true` recordando que la tienda está pausada

## 4. Sidebar (`src/routes/_authenticated/seller.tsx`)

Quitar `soon: true` de los tres items y apuntar a las rutas reales:
- Commissions → `/seller/commissions`
- Storefront → `/seller/storefront`
- Settings → `/seller/settings`

## i18n

Añadir keys a `src/lib/i18n.ts` (EN/ES/AR) para los títulos y labels nuevos de las tres páginas.

## Fuera de alcance

- Editor visual avanzado del storefront (temas, colores custom).
- Reglas de comisión variables por categoría (sigue siendo flat).
- Verificación KYC del trade license (sólo se guarda el dato).
