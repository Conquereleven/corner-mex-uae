
# Shopify-style Orders, Customers & Seller Studio polish

Focused patch on top of the existing OrderDetailView, admin/seller orders routes, Supabase schema and Intermex seed. No data resets, no auth/RLS rewrites.

## 1. Reusable status & layout primitives

New `src/components/site/orders/` folder:
- `OrderStatusBadge.tsx` — order lifecycle (pending/confirmed/shipped/delivered/cancelled/refunded).
- `PaymentStatusBadge.tsx` — pending/paid/partially_paid/refunded/failed/cancelled.
- `FulfillmentStatusBadge.tsx` — unfulfilled/preparing/fulfilled/shipped/delivered/returned/cancelled (derived from `orders.status` + `shipments`).
- `ShopifyLikeTable.tsx` — shared table shell (sticky header, hover row, checkbox column slot, responsive horizontal scroll, mobile card fallback).
- `OrderDetailCard.tsx`, `CustomerSummaryCard.tsx`, `OrderTimeline.tsx` — extracted from current `OrderDetailView.tsx` so admin/seller share them.

All badges share one color map in `src/lib/dashboard-tokens.ts` (extend, don't fork).

## 2. Admin orders list — Shopify Admin look (`admin.orders.tsx`)

Rebuild layout, not the data layer:
- Page header: title "Orders / Pedidos", secondary "Export CSV" (client-side from current rows), primary "Create order" hidden behind feature flag (not implemented yet — render disabled with tooltip "Coming soon" so no dead CTA).
- Tabs: All / Unfulfilled / Unpaid / Open / Closed — filter the same query result client-side.
- Filter row: search (order #, customer name, email), Status dropdown, Payment status dropdown, Sort dropdown (date desc/asc, total desc/asc).
- Table columns: checkbox, Order #, Date, Customer, Total, Payment, Fulfillment, Items count. Row click → `/admin/orders/$id`.
- Responsive: <md collapses to stacked card list reusing the same row component.

Bulk actions: out of scope this pass — checkbox column wired but actions menu shows only "Export selected" (CSV).

## 3. Seller orders list (`seller.orders.tsx`)

Same redesign as admin but scoped to seller. Hide payment-status dropdown writes (read-only badge). Fulfillment dropdown writes allowed (uses existing `sellerSetOrderItemStatus` / equivalent).

## 4. Order detail page polish (`OrderDetailView.tsx`)

Keep file, refactor sections to match the Shopify reference:

Top bar:
- Back link → list, order number `#1367`-style, payment + fulfillment badges, date + channel ("Web"), right side: Refund (admin only, opens confirm dialog → `adminRefundOrder` stub call), Edit (disabled tooltip), More actions menu (Cancel order w/ confirm, Mark as delivered w/ confirm), Prev/Next arrows using sibling order ids from list query (best-effort, hidden if not in cache).

Left column:
- Fulfillment card: status header, item rows with thumbnail (first `product_images` url, fallback placeholder), name, SKU, qty × price, line total. Primary CTA "Mark as fulfilled / Marcar como preparado" → updates order status to `shipped` (admin) or seller-scoped item status (seller). Confirmation dialog.
- Payment card: status, Subtotal / Shipping / Tax / Discount / Total / Paid by customer. Admin: payment-status select with confirm on `refunded`/`cancelled`. Seller: read-only.
- Timeline (`order_events`): chronological list with icons and actor. Empty state with illustration. Internal notes composer (`order_notes`) below.

Right column:
- Notes card (customer note from `orders.notes`, editable by admin via `adminUpdateOrderNote`).
- Customer card: name, "View customer" button → `/admin/customers/$id` (admin) or `/seller/customers/$id` (seller). Shows order count for that buyer (cheap count query in detail server fn). If `buyer_id` null → disabled button with helper text.
- Contact card: email + phone with copy buttons.
- Shipping address card: full address with copy button.

## 5. Admin customer detail (`admin.customers.$id.tsx`)

Route already exists — rebuild content to Shopify style:
- Header: back, customer name, optional tag badge (VIP if total_spent > threshold — derived, not stored).
- Contact info card, default address card (latest from `addresses`), order history card (list, links back to `/admin/orders/$id`), stats card (total orders, total spent, last order date), notes card (free text on `profiles.notes` — add column if missing… **scope check below**).

Note: skip adding new `customer_notes` table this pass — store admin note in existing `profiles` if a text column exists; otherwise read-only notes card showing "—". Avoid schema churn.

## 6. Seller Studio Customers page (`seller.customers.index.tsx` + `seller.customers.$id.tsx`)

New routes + sidebar entry in `DashboardShell.tsx` for sellers.
- Server fn `sellerListCustomers`: aggregate from `orders` joined to `order_items` where `seller_id = current seller`, group by `buyer_id`, return name (from profiles), email (from auth admin lookup), phone (latest shipping_address.phone), order count, last order date, total spent (sum of seller's `line_total_aed` on that buyer's orders).
- Server fn `sellerGetCustomerDetail`: same but for one buyer, plus order list (only orders containing the seller's items).
- Detail page mirrors admin customer layout but scoped — no global admin data leakage.
- Sidebar: add "Customers / Clientes" under existing seller nav.

## 7. Seller Studio Intermex banner

In `DashboardShell.tsx` (or `seller.tsx` layout): if current user owns the Intermex seller, render a slim banner strip at the top of Seller Studio using the same `banner_url` already on `sellers`. Component: `SellerStudioBanner.tsx`. Fallback: gradient with seller name if image fails (`onError` swap).

## 8. Manual status controls

- Admin: payment status select (with confirm on refund/cancel) + fulfillment select on detail page. Reuse `adminSetOrderStatus` + new `adminSetPaymentStatus` (already exists per prior pass).
- Seller: fulfillment-only select. Use existing seller fn or add `sellerSetOrderStatus` constrained to {preparing, shipped, delivered}.

All mutations log to `order_events` via existing helper.

## 9. Backend additions (small, surgical)

New server fns in `src/lib/admin.functions.ts` / `src/lib/seller.functions.ts`:
- `adminGetCustomerDetail({ id })` (if missing).
- `sellerListCustomers()`, `sellerGetCustomerDetail({ id })`.
- `adminRefundOrder({ id })` — sets payment_status=refunded + order status=refunded + event log (no Stripe refund call — out of scope; flag in note).
- `adminCancelOrder({ id })` / `adminMarkDelivered({ id })` — wrappers around existing status setter + event log.

No new tables. No migrations unless `order_events` / `order_notes` not yet present (they are, per prior pass).

## 10. QA

Manual walkthrough on preview:
- `/admin/orders` → new layout, tabs filter, row click opens detail.
- `/admin/orders/$id` → all cards render, View customer goes to `/admin/customers/$id`, status changes persist + appear in timeline.
- `/admin/customers/$id` → loads real data + order history links work.
- `/seller/orders` + `/seller/orders/$id` → seller-scoped, no admin-only controls.
- `/seller/customers` + `/seller/customers/$id` → only Intermex buyers visible for Intermex seller.
- `/seller` → Intermex banner visible at top, fallback when URL broken (test by temporarily wrong src).
- `bun run build` clean, `bunx tsc --noEmit` clean.
- Mobile (375px) layout: tables collapse, detail cards stack, no horizontal overflow.

## Out of scope

- Real Stripe refunds, real "Create order" admin flow, bulk-action menu beyond CSV export, prev/next pager queries, customer notes schema, Storage uploads for customer avatars, i18n strings table (use inline ES/EN copy where already mixed).

## Open question

Should the seller-side Intermex banner appear on **every** Seller Studio page (sticky strip), or only on `/seller` dashboard + `/seller/storefront`? Default plan: only on dashboard + storefront to avoid clutter — confirm if you want it sitewide.
