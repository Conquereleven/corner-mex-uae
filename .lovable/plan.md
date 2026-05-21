
# Corner Mex — Marketplace de productos mexicanos para EAU

Marketplace B2B/B2C multi-seller para distribuir productos mexicanos (snacks, salsas, chiles secos, supplies) a restaurantes, hoteles, caterings y supermercados en Emiratos Árabes Unidos.

## 1. Alcance funcional del MVP

**Compradores (público y B2B)**
- Catálogo navegable con filtros (categoría, seller, marca, picante, sin gluten, halal, formato bulk/retail)
- Búsqueda con autocompletar
- Página de producto con galería, variantes (tamaño/peso), descuentos por volumen
- Carrito multi-seller (split por vendor en checkout)
- Checkout con dirección de entrega EAU (emirato, área, edificio)
- Historial de pedidos, tracking de estado, facturas descargables
- Cuenta de empresa opcional (TRN para VAT, datos de facturación)

**Sellers (vendedores)**
- Onboarding: registro, datos fiscales EAU (TRN), cuenta bancaria/payout
- CRUD de productos (con imágenes, variantes, inventario)
- Gestión de pedidos (aceptar, marcar listo, enviar, completar)
- Dashboard con métricas: ventas (día/semana/mes), AOV, top productos, conversión, pedidos pendientes, ingresos netos vs comisión, gráficos
- Configuración de tienda (logo, descripción, horarios)

**Admin (tú)**
- Aprobación de sellers y productos
- Gestión de usuarios, sellers, categorías, comisión por seller
- Dashboard global: GMV, comisiones, sellers activos, top categorías, top sellers, pedidos por emirato, crecimiento MoM, alertas de inventario bajo
- Moderación y soporte (ver pedidos, reembolsos manuales)
- Configuración de la plataforma (idiomas, monedas, métodos de pago activos)

**Plataforma**
- Trilingüe: Inglés, Árabe (RTL completo), Español — selector de idioma persistente
- Moneda AED por defecto
- SEO por ruta (cada categoría/producto con metadatos propios, og:image desde la imagen del producto)
- Responsive mobile-first

## 2. Pagos

Soporte para múltiples métodos en el mismo checkout, configurables por el admin:

- **Stripe** (tarjeta, Apple/Google Pay) — vía Lovable Payments (Stripe seamless)
- **Cash on Delivery** — método nativo, muy usado en EAU
- **Transferencia bancaria** — instrucciones con referencia + confirmación manual por admin
- **Cotización B2B** — para pedidos grandes: el comprador solicita, el seller/admin responde con quote y factura

Una segunda iteración puede sumar Tabby/Tamara (BNPL populares en EAU) y Apple Pay nativo si requieren cuentas dedicadas.

## 3. Direcciones de diseño

Antes de construir generaré **3 direcciones visuales** (Awwwards-level) para que elijas:
- Todas minimalistas, fluidas, con foco en mostrar producto
- Cada una con una personalidad distinta (ej. editorial cálido / mercado moderno / lujo desértico)
- Tipografía, paleta, composición y motion definidos en cada prototipo
- Tras tu elección, los tokens (colores, fuentes, radii) se copian textualmente al proyecto

## 4. Arquitectura técnica

**Stack**
- Frontend: TanStack Start + React + Tailwind v4 + shadcn/ui
- Backend: Lovable Cloud (Postgres + Auth + Storage + Server Functions)
- i18n: `i18next` con namespaces por sección; soporte RTL via `dir="rtl"` en `<html>` cuando el idioma es árabe
- Pagos: Lovable Payments (Stripe seamless) + tablas propias para COD/transferencia/quotes

**Modelo de datos (resumen)**
```text
profiles          (id, full_name, phone, preferred_lang, company_name, trn)
user_roles        (user_id, role: buyer|seller|admin)  ← seguridad en tabla aparte
sellers           (id, user_id, store_name, slug, logo, status, commission_rate, bank_*)
categories        (id, parent_id, slug, name_translations jsonb)
products          (id, seller_id, category_id, slug, status, attrs jsonb, halal, …)
product_translations (product_id, lang, name, description)
product_variants  (id, product_id, sku, price_aed, stock, weight_g, bulk_tiers jsonb)
product_images    (id, product_id, url, sort)
addresses         (id, user_id, emirate, area, building, …)
orders            (id, buyer_id, status, totals, currency, payment_method, address)
order_items       (id, order_id, seller_id, variant_id, qty, unit_price, commission)
quotes            (id, buyer_id, status, items jsonb, replies)
payments          (id, order_id, provider, status, external_id, raw jsonb)
seller_payouts    (id, seller_id, period, gross, commission, net, status)
audit_log         (id, actor, action, target, meta)
```
RLS estricto: buyers solo ven sus pedidos; sellers solo sus productos/pedidos; admin todo. Roles en `user_roles` con función `has_role()` security-definer.

**Server functions clave**
- `createCheckoutSession` (multi-seller split)
- `submitQuoteRequest` / `respondQuote`
- `sellerMetrics(range)` y `adminMetrics(range)` — agregaciones SQL
- Webhooks de Stripe en `/api/public/stripe-webhook` con verificación de firma

**Rutas (TanStack Start, separadas para SEO)**
```text
/                       landing
/shop                   catálogo
/shop/$category
/product/$slug
/sellers/$slug          tienda del seller
/cart  /checkout  /orders  /orders/$id
/account  /account/addresses
/login  /signup  /reset-password
/seller (layout)
  /seller/dashboard /seller/products /seller/orders /seller/payouts /seller/settings
/admin (layout)
  /admin/dashboard /admin/sellers /admin/products /admin/orders /admin/categories /admin/users /admin/settings
```

## 5. Plan de entrega por fases

1. **Diseño**: generar 3 direcciones, tú eliges una.
2. **Fase 1 — Fundaciones**: Cloud + auth + roles + i18n (EN/AR/ES con RTL) + layout público + landing.
3. **Fase 2 — Catálogo**: categorías, productos, página de producto, búsqueda y filtros, tienda de seller.
4. **Fase 3 — Carrito y checkout**: carrito multi-seller, direcciones EAU, checkout con Stripe + COD + transferencia.
5. **Fase 4 — Seller**: onboarding, gestión de productos/pedidos, dashboard con métricas.
6. **Fase 5 — Admin**: aprobaciones, gestión global, dashboard con métricas.
7. **Fase 6 — B2B quotes** y refinamientos (facturas PDF, notificaciones por email).

Cada fase es entregable y revisable por separado.

## 6. Preguntas abiertas (puedo decidir por ti si no respondes)

- ¿Comisión fija (ej. 12%) o configurable por seller? → por defecto: configurable, default 12%.
- ¿Envío gestionado por seller o por plataforma? → por defecto: seller fija tarifas por emirato; flat rate inicial.
- ¿Necesitas integración con un courier real (Aramex, Quiqup) en MVP? → por defecto: no, solo estados manuales.

Al aprobar este plan, arranco generando las 3 direcciones de diseño.
