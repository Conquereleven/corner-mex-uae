## Objetivo

Llevar los dashboards de **Admin** y **Seller** a nivel "master admin" tipo Garnet Place / Shopify Admin: navegación lateral profesional, agrupación lógica de secciones, KPIs ricos, tablas pulidas y bilingüe (EN/ES). **Sin tocar lógica de negocio** ni añadir features nuevos del backend (mass upload, messaging, shipping engine, white-label vienen en una fase posterior).

## Alcance (Fase 1)

Solo presentación + métricas que ya podemos calcular desde el schema existente. Cero migraciones, cero secrets nuevos, cero edge functions.

## Cambios

### 1. Nuevo `DashboardShell` con sidebar shadcn colapsable

Reescribir `src/components/site/DashboardShell.tsx` usando el sistema `Sidebar` de shadcn ya disponible (`src/components/ui/sidebar.tsx`):
- `SidebarProvider` + `Sidebar collapsible="icon"` → colapsa a tira de iconos (no desaparece).
- Cabecera del sidebar: logo Corner**Mex** + badge del rol ("Admin" / "Seller — store name").
- Grupos del menú con label, icono Lucide por item, item activo resaltado vía `useRouterState`.
- `SidebarTrigger` siempre visible en la topbar.
- Topbar interna con: breadcrumb (sección actual), selector de idioma (i18n existente), avatar/menú usuario con "Sign out", "Back to site".
- Wrapper `w-full` (regla Tailwind 4) y `w-[var(--sidebar-width)]` explícito.

Acepta `nav` con grupos: `{ label, items: [{ to, label, icon }] }`.

### 2. Grupos de navegación

**Admin** (`src/routes/_authenticated/admin.tsx`):
- **Overview** → `/admin` (LayoutDashboard)
- **Catálogo**: Sellers (`/admin/sellers`, Store), Orders (`/admin/orders`, ShoppingCart)
- **Operación** (placeholders deshabilitados con tooltip "Coming soon"): Payouts, Categories, Customers
- **Configuración** (placeholder): Settings

**Seller** (`src/routes/_authenticated/seller.tsx`):
- **Overview** → `/seller` (LayoutDashboard)
- **Catálogo**: Products (`/seller/products`, Package), New product (`/seller/products/new`, Plus)
- **Ventas**: Orders (`/seller/orders`, ShoppingCart)
- **Finanzas** (placeholder coming soon): Payouts, Commissions
- **Tienda** (placeholder coming soon): Storefront, Settings

Los items "Coming soon" se renderizan deshabilitados (no rompen rutas inexistentes).

### 3. Seller Overview rediseñado (`seller.index.tsx`)

Expandir `getSellerOverview` en `src/lib/seller.functions.ts` para calcular:
- GMV 30d + delta vs 30d previos, GMV hoy, GMV 7d, AOV.
- Órdenes (total, 30d, 7d, hoy), unidades vendidas, clientes únicos 30d.
- Comisión acumulada + neto.
- Conteos: productos activos/draft, low-stock (≤5).
- Pending fulfillment, breakdown por status (pending/confirmed/shipped/delivered…).
- Serie diaria 30d (gmv + orders) para gráficos.
- Top 5 productos propios por GMV.
- Últimas 8 órdenes.

Render con `recharts` (ya instalado): grid de KPIs, Area chart de revenue 30d, Pie chart de status, Bar chart de órdenes diarias, leaderboard productos, lista recientes — mismo patrón visual que el admin overview rediseñado.

### 4. Admin: pulir páginas existentes

- `admin.sellers.tsx` y `admin.orders.tsx`: usar `Table` de shadcn en vez de `<ul>`, filtros por status (Select), búsqueda por texto en cliente, badges con colores semánticos consistentes con el overview.
- Mantener `adminSetSellerStatus` / `adminSetOrderStatus` intactos.

### 5. i18n

Añadir bloque `dash` a `src/lib/i18n.ts` en `en` y `es` con todas las etiquetas nuevas (Overview, Catalog, Sales, Orders, Products, Sellers, KPIs, etc.). Componentes consumen vía `t("dash.overview")`. AR queda en EN como fallback en esta fase.

### 6. Estilos

Tokens semánticos existentes (`--primary`, `--muted`, etc.). Colores de status centralizados en `src/lib/dashboard-tokens.ts` (mapa `status → var(--…)` ya derivado de la paleta, sin hex hard-coded en componentes).

## Lo que NO se toca

- Schema, RLS, migraciones, secrets.
- Rutas públicas, checkout, auth.
- `routeTree.gen.ts` (regenerado por el plugin).
- Lógica de productos / órdenes existente.
- Features nuevos del backend (mass upload, messaging, shipping engine, white-label, vendor discounts, automated payouts) — esos van en Fase 2 con su propio plan.

## Archivos

**Editar**:
- `src/components/site/DashboardShell.tsx` (reescritura con sidebar)
- `src/routes/_authenticated/admin.tsx` (nuevos grupos)
- `src/routes/_authenticated/seller.tsx` (nuevos grupos)
- `src/routes/_authenticated/seller.index.tsx` (rediseño con charts)
- `src/routes/_authenticated/admin.index.tsx` (i18n + tokens centralizados)
- `src/routes/_authenticated/admin.sellers.tsx` (Table + filtros)
- `src/routes/_authenticated/admin.orders.tsx` (Table + filtros)
- `src/lib/seller.functions.ts` (expandir `getSellerOverview`)
- `src/lib/i18n.ts` (bloque `dash`)

**Crear**:
- `src/lib/dashboard-tokens.ts` (mapa de colores por status)

## Verificación post-implementación

1. Build pasa sin errores.
2. Sidebar colapsa a iconos y vuelve a expandirse.
3. Item activo resaltado correctamente al navegar entre secciones.
4. Overview de admin y seller cargan KPIs + 3 gráficos sin errores en consola.
5. Cambio de idioma EN↔ES actualiza todos los labels del shell.
6. Mobile: sidebar entra como sheet/drawer.
