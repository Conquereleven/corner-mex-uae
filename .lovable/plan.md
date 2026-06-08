## Plan: Senior-grade hardening of the marketplace (build, errors, Shopify-style orders/customers, data reset, Intermex banner)

This is a focused, incremental plan. No architecture rewrites. All work stays within the current TanStack Start + Supabase + Tailwind v4 stack.

---

### 1. Build, preview & CSS stability

- Audit `src/routes/__root.tsx`, `index.html` (if any), and `src/styles.css` to confirm CSS is imported via the Vite entry (it already is through `__root.tsx`). Remove any leftover direct `<link href="/src/styles.css">` references if present.
- Re-verify Google Fonts are loaded via `<link>` in `__root.tsx` head (not `@import`), per the tailwind4-gotchas rule that already caused the 500.
- Add a small `src/lib/build-info.ts` exporting `BUILD_VERSION` (timestamp at build time via `import.meta.env`) and log it once in dev.
- Confirm `bun run build` succeeds; no production code references `/src/...` paths.

### 2. Runtime error visibility

- Add `src/components/site/AppErrorBoundary.tsx` (React error boundary) and wrap `<Outlet />` in `__root.tsx`.
- Add `src/lib/runtime-error-logger.ts` registering `window.onerror`, `unhandledrejection`, and a `<link>`/`<script>` error listener. Dev-only floating panel; production shows a clean fallback.
- Surface Vite 500 transform errors by reading the response body when CSS/asset fetch fails in dev.

### 3. Shopify-style Order Detail

- New route `src/routes/_authenticated/admin.orders.$id.tsx` (admin, full controls) and `src/routes/_authenticated/seller.orders.$id.tsx` (seller, scoped controls).
- New component `src/components/site/OrderDetailView.tsx` rendering: header (order #, date, badges), items card (image, qty, price), totals card (subtotal/shipping/tax/total), customer card, shipping address, payment + fulfillment cards with status selectors, internal notes, timeline.
- New server functions in `src/lib/orders.functions.ts`:
  - `getOrderDetail({ id })` (admin + seller-scoped variants via role check)
  - `updateOrderPaymentStatus({ id, status })`
  - `updateOrderFulfillmentStatus({ id, status })`
  - `addOrderNote({ id, note })`
- Wire existing "View" CTAs in `admin.orders.tsx` and `seller.orders.tsx` to `<Link to="/admin/orders/$id" />` / `/seller/orders/$id`.
- Confirmation dialogs for refund/cancel.
- Add `order_events` table (id, order_id, actor_id, type, payload jsonb, created_at) for timeline; RLS: admin all, seller own orders only.
- Add `order_notes` table (id, order_id, author_id, body, created_at) with the same RLS shape.

### 4. Shopify-style Customer Detail

- New route `src/routes/_authenticated/admin.customers.$id.tsx` already exists — audit and upgrade to Shopify-style cards (profile, lifetime stats, address book, order history, notes/tags).
- New route `src/routes/_authenticated/seller.customers.$id.tsx` scoped to customers who ordered from this seller.
- Fix the dead "Customer info" CTA in order detail and customers list to link to these routes.
- New server functions: `getCustomerDetail`, `updateCustomerNotes`, `updateCustomerTags` (admin-only writes; seller read-only of own-buyer subset).
- Add `customer_notes` and optional `customer_tags` columns/tables only if the existing `profiles` schema lacks them; otherwise reuse.

### 5. Data reset (orders + sellers except Intermex)

- Single guarded SQL migration that:
  - Deletes all `orders`, `order_items`, `payments`, `shipments`, `returns`, `order_events`, `order_notifications`.
  - Deletes all `sellers` and dependent `products`/`product_variants`/`product_images`/`product_translations` **except** rows belonging to the seller whose slug or name matches "Intermex prueba".
  - Wrapped in a `DO $$ ... $$` block that aborts if the Intermex seller cannot be found (safety guard).
- No production-data deletion without explicit user approval at migration time (the migration tool already requires approval).

### 6. Intermex banner & profile polish

- Fetch banner/brand imagery from https://intermexuae.com via `websearch`/`fetch_website`; upload chosen image to the existing `product-images` bucket (or create `seller-banners` bucket if needed) using `supabase--storage_upload`.
- Update Intermex seller row with `banner_url` (add column if missing via migration) and ensure `sellers.$slug.tsx`, `admin.sellers.tsx`, and seller header in `seller.tsx` render it with a graceful fallback gradient.

### 7. UX consistency pass

- Reuse `PageHeader`, `EmptyState`, `Badge`, sticky action bars across order/customer detail pages.
- Audit CTAs in admin + seller order/customer lists for dead buttons; convert all `Link>Button` to `<Button asChild><Link/></Button>`.
- Loading skeletons + error states on every new query.

### 8. QA pass

- Manual walk-through: build succeeds, preview loads, CSS hashed, order detail CTA works (admin + seller), customer info CTA works, status updates persist, timeline updates, Intermex banner visible, no other sellers remain, no orders remain.
- `bunx tsc --noEmit` clean.

---

### Files to add

- `src/components/site/AppErrorBoundary.tsx`
- `src/components/site/OrderDetailView.tsx`
- `src/components/site/CustomerDetailView.tsx`
- `src/lib/runtime-error-logger.ts`
- `src/lib/build-info.ts`
- `src/routes/_authenticated/admin.orders.$id.tsx`
- `src/routes/_authenticated/seller.orders.$id.tsx`
- `src/routes/_authenticated/seller.customers.$id.tsx`
- 1 migration: order_events + order_notes + seller banner_url + grants/RLS
- 1 migration: guarded data reset (orders + non-Intermex sellers)

### Files to edit (minimal, surgical)

- `src/routes/__root.tsx` — wrap with `AppErrorBoundary`, register error logger
- `src/lib/orders.functions.ts` — add detail + status mutation server fns
- `src/lib/admin.functions.ts` — customer detail/update
- `src/lib/seller.functions.ts` — seller-scoped order + customer detail
- `src/routes/_authenticated/admin.orders.tsx` / `seller.orders.tsx` — wire CTAs
- `src/routes/_authenticated/admin.customers.tsx` / `admin.customers.$id.tsx` — Shopify-style upgrade + CTA wiring
- `src/routes/_authenticated/seller.tsx` — add Customers link if missing
- `src/routes/sellers.$slug.tsx` + `admin.sellers.tsx` — render banner

### Out of scope

- No payment provider changes, no shipping logic changes, no auth changes, no RLS rewrites beyond the two new tables and `banner_url` column. No marketplace expansion.

### Open question

The data reset is destructive. I will run it as a Supabase migration so you explicitly approve before it executes. Confirm "Intermex prueba" is matched by `name ILIKE 'Intermex prueba'` — if the slug differs, I'll match by slug instead.
