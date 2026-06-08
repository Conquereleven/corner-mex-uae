Plan de corrección senior, sin cambiar esquema ni lógica financiera

1. Restaurar el preview primero
- Corregir `src/styles.css` moviendo todos los `@import` al inicio del archivo, antes de `@source`/`@theme`/reglas CSS.
- Esto elimina el 500 actual de Vite (`@import rules must precede all rules`) que hoy impide verificar cualquier CTA.

2. Corregir CTAs de productos en Seller Studio
- Revisar y ajustar `seller.products.tsx`, `seller.products.new.tsx`, `seller.products.$id.tsx` y `ProductForm.tsx`.
- Usar navegación TanStack Router tipada de forma consistente:
  - `New product` -> `/seller/products/new`
  - `Edit` -> `/seller/products/$id` con `params={{ id }}`
  - después de crear producto -> redirigir a `/seller/products/$id` con el `productId` real devuelto por backend
  - `Cancel/Delete` -> volver a `/seller/products`
- Evitar que el formulario navegue fuera de edición después de un guardado normal si eso corta el flujo de imágenes/variantes.
- Mejorar estados de guardado/error para que el usuario sepa si el CTA está ejecutando algo.

3. Corregir el formulario de producto con datos reales
- Reemplazar la lista hardcoded de categorías en `ProductForm` por categorías reales existentes desde backend, sin crear tablas ni cambiar schema.
- Mantener `upsertSellerProduct`, variantes e imágenes existentes; solo ajustar UI y llamadas necesarias.
- Confirmar que creación/edición preserve producto, traducciones, categoría, imágenes y variantes.

4. Activar KYC Verification de Seller Studio
- Convertir KYC en una ruta/entrada navegable de verdad, no solo un label duplicado a Settings.
- Implementar deep-link seguro hacia la pestaña Verification en `/seller/settings` usando search param o estado de URL, manteniendo la ruta existente.
- Ajustar `seller.tsx` para que “KYC Verification” abra directamente esa vista.
- Mejorar `seller.settings.tsx` para que la pestaña activa responda al deep-link, muestre status, upload, remove y submit con feedback claro.

5. Corregir backend sin tocar schema/RLS
- Mantener Lovable Cloud, server functions, queries, mutations y permisos existentes.
- Corregir el patrón riesgoso de imports server-only en `seller.functions.ts` y `admin.functions.ts`: no dejar `client.server` importado a nivel de módulo en archivos alcanzables desde rutas/componentes.
- Mover el acceso admin a carga server-only dentro de handlers/helpers seguros para evitar errores de build/runtime en TanStack Start.
- No cambiar estructura de tablas, RLS, nombres de rutas ni lógica financiera.

6. Reforzar Admin KYC
- Mantener `/admin/sellers/kyc` existente.
- Mejorar estados vacíos/loading/error y acciones approve/reject.
- Confirmar que los documentos privados siguen usando URLs firmadas y que admin review actualiza el estado KYC existente.

7. Verificación
- Revisar dev-server logs después del cambio de CSS.
- Verificar rutas relevantes en preview:
  - `/seller/products`
  - `/seller/products/new`
  - `/seller/products/$id`
  - `/seller/settings` con la vista Verification
  - `/admin/sellers/kyc`
- Corregir errores TypeScript/build que salgan de estos cambios, sin editar `routeTree.gen.ts` manualmente.

Archivos esperados a tocar
- `src/styles.css`
- `src/components/site/ProductForm.tsx`
- `src/routes/_authenticated/seller.products.tsx`
- `src/routes/_authenticated/seller.products.new.tsx`
- `src/routes/_authenticated/seller.products.$id.tsx`
- `src/routes/_authenticated/seller.tsx`
- `src/routes/_authenticated/seller.settings.tsx`
- `src/routes/_authenticated/admin.sellers.kyc.tsx`
- `src/lib/seller.functions.ts`
- `src/lib/admin.functions.ts`

No voy a hacer
- No migraciones de base de datos.
- No cambios de RLS.
- No rutas nuevas innecesarias ni renombrar rutas.
- No fake backend.
- No reemplazar la lógica financiera o de payouts.
- No editar `src/routeTree.gen.ts`.