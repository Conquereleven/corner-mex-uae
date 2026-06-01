## Fase 4 — Quotes B2B + Shipping/Fulfillment

Objetivo: cerrar el ciclo B2B (cotización → orden) y profesionalizar la operación de envíos por emirato con tracking y notificaciones.

Plan en **3 mensajes** (uno por mensaje, ya tienes la app en producción y queremos cambios seguros).

---

### Mensaje 1 — Quotes B2B (cotizaciones admin ↔ buyer)

**DB (migración nueva, no rompe existente)**
- Mantener tabla `quotes` actual. Añadir:
  - `assigned_admin_id uuid` (nullable)
  - `valid_until date` (nullable)
  - `accepted_at`, `rejected_at`, `converted_order_id uuid` (nullable)
- Nueva tabla `quote_items` (id, quote_id, product_id?, seller_id?, name, qty, unit_price_aed, line_total_aed, notes). RLS: buyer/admin pueden leer las suyas.
- Trigger `tg_touch_updated_at` ya existe — reutilizar.
- GRANTs + RLS estándar (buyer own + admin all).

**Server functions (`src/lib/quotes.functions.ts`)**
- `listMyQuotes` (buyer), `getQuote(id)` (buyer/admin), `submitQuote(items, contact, notes)` (buyer crea desde formulario público en `/b2b`).
- `adminListQuotes(filters)`, `adminRespondQuote(id, items[], totalEstimate, validUntil, notes)` → status `quoted`.
- `acceptQuote(id, shippingAddressId)` (buyer) → crea `orders` + `order_items` desde la respuesta, status `accepted`, `converted_order_id` set, `payment_status: pending`.
- `rejectQuote(id, reason)` (buyer).
- `adminCancelQuote(id)`.

**UI**
- `/b2b/quote` (público para auth users): formulario multi-línea con productos, qty, notas, contacto, empresa.
- `/account` → tab “Mis cotizaciones” con estados (open/quoted/accepted/rejected/expired) + botón "Aceptar y crear pedido".
- `/admin/quotes` (CRUD): lista con filtros (status, asignado, fecha), búsqueda por nº cotización, drawer de respuesta con item editor (precio, qty, comisión preview), validez (default +14 días), totales calculados.
- KPI cards: abiertas, cotizadas, aceptación rate, valor pipeline.

**i18n**: bloque `dash.quotes.*` y `b2b.quote.*` (EN/ES/AR parcial).

---

### Mensaje 2 — Shipping zones + tarifas + cálculo en checkout

**DB**
- Tabla `shipping_zones` (id, name, slug, emirates `emirate[]`, is_active, sort_order). Seed con 3 zonas: "Dubai/Sharjah", "Northern Emirates", "Western Region".
- Tabla `shipping_rates` (id, seller_id (nullable = default marketplace), zone_id, base_aed, per_kg_aed, free_above_aed, sla_min_days, sla_max_days, is_active).
- Migración liviana en `orders`: añadir `shipping_zone_id`, `weight_grams_total`, `sla_min_days`, `sla_max_days`.

**Server**
- `getShippingQuote({ items[], emirate })` → calcula coste por seller y total, devuelve breakdown (cliente lo llama en checkout antes de pagar).
- `adminListZones`, `adminUpsertZone`, `adminDeleteZone`.
- `adminListRates(zoneId?)`, `adminUpsertRate`, `adminDeleteRate`.
- `sellerListMyRates`, `sellerUpsertMyRate` (solo overrides para su propio seller_id; tarifa por defecto la define admin).

**UI**
- `/admin/shipping` — dos tabs: **Zonas** (CRUD con emirates picker) y **Tarifas por defecto** (CRUD por zona).
- `/seller` → nueva ruta `/seller/shipping`: tabla de zonas con sus tarifas (default vs override propio) y formulario inline.
- Integración en `/checkout`: tras elegir address, se llama `getShippingQuote` y se muestra breakdown por vendedor con SLA estimado. El total de `shipping_aed` ahora viene de la cotización, no es 0.

**i18n**: `dash.shipping.*`, `checkout.shipping.*`.

---

### Mensaje 3 — Fulfillment: carriers, tracking, etiquetas y notifs

**DB**
- ENUM `carrier_code` (`aramex`, `dhl`, `fedex`, `talabat`, `local_courier`, `pickup`, `other`).
- Tabla `shipments` (id, order_id, seller_id, carrier `carrier_code`, tracking_number, tracking_url, label_url, shipped_at, delivered_at, weight_grams, cost_aed, notes, status `shipment_status` enum: `prepared|in_transit|delivered|returned|lost`).
- En `order_items` añadir `shipment_id uuid` (nullable) para items multi-paquete.
- Tabla `order_notifications` (id, order_id, kind: `order_placed|order_confirmed|shipped|delivered|payout_paid`, sent_at, channel `email`, status, payload jsonb).

**Server**
- `sellerCreateShipment({ orderId, itemIds[], carrier, trackingNumber, weight, cost })` → setea fulfillment_status="shipped" en items asociados; si todos los items del order están shipped, marca `orders.status="shipped"`.
- `sellerUpdateShipment`, `sellerMarkDelivered`.
- `sellerGenerateTrackingUrl(carrier, trackingNumber)` helper (mapea a URL pública de cada carrier).
- `adminListShipments(filters)` para panel global.
- `sendOrderEmail(orderId, kind)` — usa Resend (connector). Trigger automático en `sellerCreateShipment` y en cambio de status. Plantillas EN/ES en `src/lib/email-templates.ts`.

**UI**
- `/seller/orders` → drawer por pedido con sección **Shipping**: form rápido (carrier select, tracking, peso, coste, items a incluir), historial de shipments, botón "Marcar como entregado".
- `/admin/orders` → tab **Shipments** con tabla global filtrable.
- `/account/orders/$id` → buyer ve tracking number, link al carrier y SLA estimado.
- Email layout simple HTML branded (logo, color primario, tabla de items, CTA "Ver pedido").

**i18n**: `dash.shipping.shipments.*`, `email.*`.

**Secret a pedir antes del mensaje 3**: `RESEND_API_KEY` (a través del connector Resend, no API key directa).

---

### Fuera de alcance (Fase 5+)
- Etiquetas reales (Aramex/DHL API) → ahora solo guardamos `label_url` que sube el seller manualmente.
- Webhooks de carriers para auto-actualizar status.
- Notificaciones push / WhatsApp / centro in-app (eso es Fase 4-C que no elegiste).
- Devoluciones / RMA.

---

### Orden recomendado
Sugiero empezar por **Mensaje 1 (Quotes B2B)** porque desbloquea el flujo /b2b que ya está promocionado en la home pero hoy es estático. Luego shipping y luego fulfillment + emails.

¿Confirmo y arranco con **Mensaje 1 (Quotes B2B)**?