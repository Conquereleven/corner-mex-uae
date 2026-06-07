# Plan — Notificaciones por email + cambio manual de pagos

## 1. Infraestructura de email (prerrequisito)

Hoy el proyecto **no tiene dominio de email** configurado, así que las notificaciones por email no pueden salir aún. Antes de implementar las plantillas necesitamos:

1. Configurar un dominio de envío (subdominio tipo `notify.tudominio.com`) desde el diálogo de configuración de Lovable Emails.
2. Levantar la infraestructura compartida (cola de envío, suppression list, cron de procesamiento).
3. Generar el andamiaje de "app emails" (rutas `/lovable/email/transactional/send`, preview, unsubscribe).

> Para empezar necesito que abras el diálogo de configuración de dominio. Te lo voy a mostrar en cuanto pasemos a build. Mientras DNS propaga, todo el código y las plantillas quedan listas; los correos empezarán a salir en cuanto el dominio verifique.

## 2. Plantillas de email (React Email)

Crear en `src/lib/email-templates/` y registrar en `registry.ts`:

- `kyc-submitted.tsx` — al seller: "Recibimos tus documentos, están en revisión".
- `kyc-approved.tsx` — al seller: cuenta verificada, ya puede solicitar payouts.
- `kyc-rejected.tsx` — al seller: motivo + CTA para volver a subir.
- `kyc-admin-new.tsx` — a admins: nuevo KYC pendiente con link a `/admin/sellers/kyc`.
- `payout-requested.tsx` — al seller: confirmación de solicitud + monto.
- `payout-admin-new.tsx` — a admins: nueva solicitud pendiente con link a `/admin/payouts`.
- `payout-approved.tsx` — al seller: payout aprobado (en proceso de transferencia).
- `payout-paid.tsx` — al seller: payout pagado, con monto, fecha y link al recibo si existe.
- `payout-rejected.tsx` — al seller: motivo de rechazo.

Todas con branding del marketplace (colores y tipografía leídos de `src/index.css`), fondo `#ffffff`, footer de unsubscribe lo agrega el sistema.

## 3. Disparadores en server functions

Crear helper `src/lib/email/send.ts` (POST a `/lovable/email/transactional/send` con JWT). Para envíos disparados desde server functions, helper server-only `src/lib/email/send.server.ts` que llame internamente con service role. `idempotencyKey` derivado del evento.

Cablear en:

- `seller.functions.ts`:
  - `submitKycForReview` → `kyc-submitted` (seller) + `kyc-admin-new` (a todos los admins).
  - `requestSellerPayout` → `payout-requested` (seller) + `payout-admin-new` (admins).
- `admin.functions.ts`:
  - `adminReviewKyc` → `kyc-approved` o `kyc-rejected` según decisión.
  - `adminApprovePayout` → `payout-paid` (mantiene el comportamiento actual que marca como `paid`).
  - `adminRejectPayout` → `payout-rejected`.
  - Nueva `adminMarkPayoutApproved` (status `processing`/`approved`) → `payout-approved`, para tener el ciclo `pending → approved → paid`.

Helper `getAdminEmails()` (consulta `user_roles` + `auth.users` vía `supabaseAdmin`) para los correos a administradores. Cada envío respeta `notify_payout` del seller (ya existe en settings) y para KYC se envía siempre (compliance).

## 4. Cambio manual de estado de pago (COD / Bank transfer)

Hoy `admin.orders.tsx` solo muestra el `payment_status` como badge. Cambios:

- Nueva server fn `adminUpdateOrderPaymentStatus({ orderId, payment_status })` en `admin.functions.ts`:
  - Valida con Zod (`pending | paid | refunded | failed`).
  - Solo permite cambiar manualmente cuando `payment_method ∈ {cod, bank_transfer}` (los demás los maneja la pasarela/webhook).
  - Inserta notificación al buyer y registra `paid_at` cuando aplica.
- En `admin.orders.tsx`: si el método es `cod` o `bank_transfer`, el badge se reemplaza por un `Select` con los estados disponibles + botón "Confirmar". Para los demás métodos sigue read-only.
- Mismo control en `seller.orders.tsx` (solo para sus propias órdenes, vía nueva `sellerUpdateOrderPaymentStatus` con la misma restricción de método). Útil para que el seller confirme una transferencia recibida.

## 5. Detalles técnicos

- Estados de payout: se mantiene el enum actual (`pending | approved | paid | rejected`). El email `payout-approved` corresponde al estado `approved` (intermedio antes de `paid`).
- Todos los envíos son individuales (no bulk), pasan por la cola pgmq y respetan la suppression list.
- No se tocan flujos de pago automatizados (tarjeta, Stripe, BNPL).
- Migración mínima: agregar columna `orders.paid_at timestamptz null` si no existe, para registrar cuándo se confirmó manualmente.

## Fuera de alcance

- Rediseño de la página de órdenes.
- Reembolsos parciales o conciliación bancaria automática.
- Webhooks bancarios reales.
