Plan de corrección enfocado y seguro:

1. Corregir CTAs de productos en Seller Studio
- Revisar y ajustar los botones principales de `/seller/products`, `/seller/products/new` y `/seller/products/$id` para que naveguen de forma consistente.
- Cambiar el flujo de creación para que, al crear un producto nuevo, el usuario sea llevado automáticamente a la página funcional de edición del producto recién creado, en vez de quedarse en una pantalla ambigua.
- Mantener los CTAs existentes: crear/publicar, guardar borrador, editar, preview, cancelar y eliminar.
- No cambiar server functions ni lógica de base de datos.

2. Evitar que los CTAs “parezcan rotos”
- Asegurar que “New product / Agregar producto” siempre apunte a `/seller/products/new`.
- Asegurar que “Edit” siempre apunte a `/seller/products/$id` con el ID correcto.
- Añadir estados visuales claros en botones de guardado/carga para que el usuario vea si una acción está en proceso o falló.
- Mejorar mensajes de error visibles cuando una acción no se puede completar.

3. Activar acceso visible a KYC Verification
- En Seller Studio, añadir una entrada directa de navegación a “KYC Verification” apuntando al tab de verificación dentro de settings o a la sección correspondiente existente.
- En Admin, mantener y reforzar el acceso a `/admin/sellers/kyc` para que sea fácil de encontrar desde el dashboard de sellers/admin.
- No crear tablas, no cambiar RLS, no cambiar permisos; usar las server functions existentes de KYC que ya están implementadas.

4. Mejorar UX del módulo KYC existente
- Ajustar el tab de verificación en `/seller/settings` para que pueda abrirse directamente desde un link/CTA.
- Hacer que los botones Upload / Submit for review tengan feedback claro y no parezcan inactivos sin explicación.
- Mejorar estado vacío en admin KYC cuando no hay submissions.

5. Verificación
- Verificar rutas registradas: `/seller/products`, `/seller/products/new`, `/seller/products/$id`, `/seller/settings`, `/admin/sellers/kyc`.
- Revisar que no se modifique `routeTree.gen.ts` manualmente.
- Revisar imports/JSX para evitar errores TypeScript/build.

Archivos previstos:
- `src/components/site/ProductForm.tsx`
- `src/routes/_authenticated/seller.products.tsx`
- `src/routes/_authenticated/seller.products.new.tsx`
- `src/routes/_authenticated/seller.products.$id.tsx`
- `src/routes/_authenticated/seller.tsx`
- `src/routes/_authenticated/seller.settings.tsx`
- `src/routes/_authenticated/admin.sellers.kyc.tsx`
- Opcionalmente `src/routes/_authenticated/admin.sellers.tsx` solo para añadir CTA visible a KYC si ya existe un header/actions adecuado.