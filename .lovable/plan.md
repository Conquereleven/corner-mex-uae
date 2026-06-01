# Fase 2 — Admin: Categorías + Customers

## Alcance
Activar las dos entradas "Coming soon" del sidebar admin con CRUD real, manteniendo el patrón visual de Payouts/Orders (shadcn Table + dialogs + i18n ES/EN).

## 1. Categorías (CRUD completo)

**Server functions** (`src/lib/admin.functions.ts`)
- `adminListCategories` — lista jerárquica (parent → children) con conteo de productos por categoría
- `adminCreateCategory` — inputs: `slug`, `name_en`, `name_ar`, `name_es`, `parent_id?`, `description_*?`, `image_url?`, `sort_order`, `is_active`
- `adminUpdateCategory` — mismos campos, por `id`
- `adminToggleCategoryActive` — flip `is_active`
- `adminDeleteCategory` — bloquea si tiene productos o subcategorías; mensaje claro

Validación Zod: slug `^[a-z0-9-]+$`, nombres min 1 / max 120, sort_order int ≥ 0.

**Ruta** `src/routes/_authenticated/admin.categories.tsx`
- KPIs: total, activas, inactivas, con productos
- Tabla con: imagen mini, nombre (EN/ES), slug, parent, # productos, orden, estado (badge), acciones
- Filtros: buscar por nombre/slug, filtro estado (all/active/inactive), filtro parent
- Dialog "Nueva categoría" + "Editar" (mismo formulario): tabs ES/EN/AR para nombres y descripciones, selector de parent (excluye self/descendientes en edición), preview de imagen por URL
- Switch para activar/desactivar inline en cada fila
- Confirmación shadcn AlertDialog antes de eliminar

## 2. Customers (read + light actions)

**Server functions** (`src/lib/admin.functions.ts`)
- `adminListCustomers` — join `profiles` + agregados: # órdenes, GMV total, última orden, idioma preferido, rol(es); filtros opcionales por search
- `adminGetCustomer` — detalle: profile completo, direcciones, últimas 20 órdenes con status/total, lifetime stats (orders, GMV, AOV, primera/última compra)

Sin update/delete de profiles (respeta RLS y modelo auth).

**Rutas**
- `src/routes/_authenticated/admin.customers.tsx` — lista
  - KPIs: total customers, nuevos (30d), con órdenes, GMV promedio por customer
  - Tabla: nombre, email (de auth via admin), teléfono, # órdenes, GMV, última orden, idioma; click → detalle
  - Search por nombre / email / teléfono
- `src/routes/_authenticated/admin.customers.$id.tsx` — detalle drawer/page
  - Card de perfil + direcciones
  - Historial de órdenes con link a `/admin/orders` filtrado
  - Stats panel

## 3. Navegación + i18n
- `admin.tsx`: quitar `soon: true` de Categories y Customers, apuntar a las rutas reales
- `src/lib/i18n.ts`: agregar bloque `dash.categories.*` y `dash.customers.*` en ES + EN (labels, columnas, dialogs, estados, mensajes de error)

## Detalles técnicos
- Tablas con shadcn `Table` + `Skeleton` loading, igual que `admin.orders.tsx`
- Mutations con `useMutation` + `toast` (sonner) + `qc.invalidateQueries`
- Para emails de customers: `supabaseAdmin.auth.admin.listUsers()` paginado y mergeado por `id` con `profiles` (evita exponer auth.users vía PostgREST)
- Sin cambios de schema DB: tabla `categories` y `profiles` ya existen con los campos necesarios
- Sin cambios de RLS (todo pasa por server fns con `assertAdmin`)

## Archivos
**Editar:** `src/lib/admin.functions.ts`, `src/routes/_authenticated/admin.tsx`, `src/lib/i18n.ts`
**Crear:** `src/routes/_authenticated/admin.categories.tsx`, `src/routes/_authenticated/admin.customers.tsx`, `src/routes/_authenticated/admin.customers.$id.tsx`

## Fuera de alcance (Fase 3+)
- Edición/merge de customers, envío de emails, notas internas
- Drag & drop para reordenar categorías (usaremos input numérico `sort_order`)
- Upload de imagen de categoría (por ahora solo URL)
