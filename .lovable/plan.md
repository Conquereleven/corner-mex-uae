# Plan — Fix signup + Fase 5: Pagos reales

## Parte A — Diagnóstico del signup

Síntoma: al crear cuenta te redirige a `/` pero no quedas logueado.

Causa: `supabase.auth.signUp()` en `src/routes/signup.tsx` no crea sesión cuando la confirmación por email está activa (que es el default seguro). El usuario se crea, pero hasta que confirma el correo no hay `session`, así que el `navigate("/")` te deja deslogueado en la home.

Dos arreglos posibles — propongo hacer **ambos**:

1. **UX honesto en signup**: detectar si `data.session` viene null tras `signUp`. Si es null → mostrar pantalla "Revisa tu correo para confirmar tu cuenta" en vez de redirigir. Si viene con sesión (auto-confirm activo) → seguir con el redirect.
2. **Activar auto-confirmación de email** vía `supabase--configure_auth` con `auto_confirm_email: true` para que la experiencia en desarrollo sea inmediata (la doc lo permite si el usuario lo pide explícitamente — y lo estás pidiendo al reportar este bug).

También: añadir `redirect` search param al login (`useSearch`) para que tras login te devuelva al destino original (hoy se ignora).

## Parte B — Fase 5: Pagos

### B1. Integración Stripe (tarjeta + Apple Pay + Google Pay)

Usar la integración nativa de Lovable (`payments--enable_stripe_payments`). Esto evita pedirte claves y maneja webhooks por nosotros. Luego:

- **Server fn `createCheckoutSession`** (`src/lib/payments.functions.ts`): recibe `orderId`, busca la orden en DB, crea Stripe Checkout Session en modo `payment` con line items por cada `order_item` (precio en `aed`, qty), `success_url=/order-confirmed?order={id}`, `cancel_url=/checkout`. Guarda `external_id` en `payments`.
- **Reescribir `/checkout`**: en submit, primero llama `placeOrder` (ya existente, deja la orden en `payment_status='pending'`), luego según el método:
  - `card` / `apple_pay` / `google_pay` → `createCheckoutSession` y `window.location.href = url`.
  - `tabby` / `tamara` → simulación (ver B2).
- **Webhook Stripe** (`src/routes/api/public/stripe-webhook.ts`): verifica firma, en `checkout.session.completed` marca `orders.payment_status='paid'`, `status='confirmed'`, inserta/actualiza fila en `payments`, decrementa stock de `product_variants`. Usa `supabaseAdmin`.

### B2. Tabby / Tamara (modo simulación)

No hay integración nativa; los keys reales requieren cuenta merchant en EAU. Implemento un **flujo simulado realista** marcado como "Sandbox":
- Ruta `/checkout/bnpl/$provider/$orderId` que muestra UI tipo "Confirmar en 4 pagos sin interés" (Tabby) o "Págalo en 4" (Tamara) con su branding.
- Botón "Aprobar pago" → llama server fn `confirmBnplPayment(orderId, provider)` que marca la orden como pagada (mismo efecto que el webhook). Botón "Cancelar" → vuelve al checkout.
- Banner visible: "Pago simulado para demo. Conecta tu cuenta merchant real para producción."

Cuando consigas las API keys reales me lo dices y reemplazo la simulación por las llamadas a `api.tabby.ai` / `api.tamara.co` (estructura ya queda lista).

### B3. Confirmación post-pago

- `/order-confirmed?order=...`: cargar la orden vía server fn `getOrderForBuyer`, mostrar resumen real (número, items por seller, total), botón "Ver mis pedidos" → `/account`.
- Vaciar carrito **solo** cuando se confirma el pago, no antes.

### B4. Migración DB

Una migración pequeña para:
- Añadir índice en `payments(external_id)` (lookup desde webhook).
- Añadir columna `payments.provider_session_id` por si necesitamos distinguir session vs intent.

## Detalles técnicos

- Stripe en AED: Stripe soporta AED nativo, no hace falta conversión.
- Webhook URL estable: `https://project--d9495376-339d-44dd-9c8a-db0f7b451f96.lovable.app/api/public/stripe-webhook` — la registramos en la integración.
- Stock decrement: dentro del webhook, no en `placeOrder` (porque la orden puede no completarse).
- `placeOrder` ya valida stock antes de crear la orden — se queda igual.
- Seguridad: webhook verifica firma de Stripe con `STRIPE_WEBHOOK_SECRET`; rechaza con 401 si falla.

## Archivos a tocar

Fix signup:
- `src/routes/signup.tsx` — manejar session null
- `src/routes/login.tsx` — respetar `?redirect=`
- llamada a `supabase--configure_auth` con `auto_confirm_email: true`

Fase 5:
- `payments--enable_stripe_payments` (tool call)
- `src/lib/payments.functions.ts` (nuevo)
- `src/routes/checkout.tsx` (modificar submit)
- `src/routes/order-confirmed.tsx` (cargar orden real)
- `src/routes/api/public/stripe-webhook.ts` (nuevo)
- `src/routes/checkout.bnpl.$provider.$orderId.tsx` (nuevo, simulación)
- Nueva migración SQL

## Pregunta abierta

¿Confirmas que quieres **activar auto-confirm de email** para desarrollo? Si prefieres mantener la confirmación real, solo aplico el arreglo de UX (mostrar "revisa tu correo").
