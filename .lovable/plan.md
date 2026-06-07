
# CornerMex — Production Polish Plan

This is a **refinement pass**, not a rebuild. All existing routes, Supabase tables, RLS, roles, server functions and business logic stay in place. Work is broken into phases so you can approve/skip each one.

---

## Phase A — Design System Hardening (global UI polish)

Goal: every page reads as the same premium product.

- Audit `src/styles.css` tokens (already earthy: clay/sand/sage/obsidian) and add the missing semantic tokens used across admin/seller: `--success`, `--warning`, `--info`, surface elevations (`--surface-1/2/3`), and status-tone tokens for badges (pending/approved/paid/rejected/shipped/etc.) so we stop hand-coding `bg-amber-500/15`.
- Standardize shared primitives:
  - `PageHeader` (title + description + actions slot) — replace ad-hoc `<div className="flex justify-between">` headers on every dashboard route.
  - `KpiCard` — single component replacing the duplicate `SellerKpi` / admin KPI cards.
  - `DataTable` wrapper around shadcn `Table` with built-in search, column filters, sort, pagination, empty state, loading skeleton, row-actions menu.
  - `StatusBadge` driven by a status→tone map (one source of truth).
  - `EmptyState`, `LoadingState`, `ErrorState` components.
- Polish: card radii, shadow scale, font-display usage on H1/H2, consistent section spacing (`py-8/py-12`), mobile padding.
- Toaster: standardize on sonner success/error/info variants with tokens.

No business logic touched. Components are additive; existing pages opt in incrementally.

## Phase B — Customer Storefront Polish

- Home (`/`): refresh hero copy ("Authentic Mexican products delivered across the UAE"), CTAs (Shop / Request Wholesale Quote), featured categories strip, Best Sellers, New Arrivals, Restaurant Supply band, B2B CTA, trust strip.
- Category cards aligned to the canonical list (Dried Chiles, Sauces & Salsas, Tortillas & Masa, Snacks, Mexican Candy, Beverages, Canned Goods, Spices & Seasonings, Beans/Rice/Pantry, Restaurant Supply, Combo Boxes). Uses existing `categories` table; no schema change.
- `ProductCard`: show seller line ("Sold by CornerMex" vs "Sold by {seller}"), wholesale-available badge when applicable, stock status pill, clearer price/AED treatment.
- Product detail (`product.$slug`): gallery polish, ingredients/origin/storage block, seller card, related products, B2B "Request bulk price" button for eligible products.
- Shop / category / search: filter sidebar polish, skeleton grid, empty state.

## Phase C — Auth & Account Polish

- Login / signup / reset pages reskinned with the new design system (split-screen with brand panel on the right, form on the left). Keep existing Supabase auth calls and Google OAuth via `lovable.auth.signInWithOAuth`.
- Account area (`/account`, wishlist, returns, loyalty, quotes, notifications): unified `AccountShell` with sidebar, breadcrumbs, consistent page headers.
- Role-based redirect after login: admin → `/admin`, seller → `/seller`, buyer → `/account`. (Already partially in place — verify and tighten.)

## Phase D — Admin Operations Console

- New `AdminShell` with a real sidebar (shadcn Sidebar) grouping: Overview, Orders, Products, Sellers, Customers, Categories, Banners, Coupons, B2B Quotes, Returns, Reviews, Shipping, Newsletter, Payouts, KYC, Performance, Settings.
- `/admin` overview rebuilt with KPI grid + charts (Recharts):
  - Total sales, direct vs marketplace split, AOV, commission revenue, active sellers, pending seller approvals, pending product approvals, low-stock count, new B2B leads, top products, orders-by-status donut, sales-by-category bar, 30-day revenue line.
- All admin tables migrated to the new `DataTable` (search, filters, status badges, row actions, pagination, mobile-friendly).
- Product approval workflow surface: filter products by `status` (draft/pending/approved/rejected/archived) with one-click approve/reject + reason. Adds `products.status` enum if not present (extend, not replace) and an `approval_note` column. Sellers' submissions default to `pending`.
- Manual payment-status control for COD / Bank transfer (the still-pending piece from the previous turn) — `<Select>` + Confirmar on `cod` / `bank_transfer` orders only; writes via `adminUpdateOrderPaymentStatus` server fn with Zod validation, sets `paid_at`, inserts buyer notification.

## Phase E — Seller Portal Polish

- `SellerShell` sidebar mirroring admin style: Overview, Products, Add Product, Orders, Inventory, Sales, Payouts, Commissions, Coupons, Storefront, Shipping, Returns, Notifications, Settings.
- Seller overview rebuilt with KPIs (sales, orders this month, active products, pending approval, low stock, estimated payout, commission) + recent orders table + 30-day sales chart.
- Product form: ensure all marketplace fields exist (name, brand, category, description, ingredients, country of origin, photos, price AED, wholesale price optional, stock, MOQ, expiration optional, SKU, delivery notes, status). Submissions are forced to `status='pending'` regardless of input.
- Sellers see only their own data (already enforced by RLS + server fns — verify, do not loosen).

## Phase F — Marketplace Distinction (Direct vs Seller)

- Add `sellers.is_house_account boolean` (or reuse an existing flag) so the CornerMex direct-inventory seller record is marked. ProductCard / product page read from this to render "Sold by CornerMex" vs "Sold by {seller}".
- Commission is already tracked per seller in `seller_payouts`; no schema change required.
- Admin marketplace overview card on `/admin`: direct sales revenue vs marketplace GMV vs commission revenue.

## Phase G — B2B / Wholesale CRM Polish

- `/b2b` landing page refresh with the agreed hero/sub copy and CTAs.
- Quote request form (already at `/b2b/quote`) gains: business type, products of interest (multi-select from categories), estimated monthly volume, delivery frequency, WhatsApp field, city/emirate, source tracking (`source` column on `quotes`).
- Admin `/admin/quotes` becomes a lightweight CRM:
  - Statuses: new → contacted → quoted → negotiating → won → lost (extends current quote status; additive enum values).
  - Columns: internal notes, priority (low/med/high), estimated deal value.
  - Lead source filter + status kanban view (optional, nice-to-have).
- WhatsApp CTA helper component with templated messages by intent (product question, wholesale quote, restaurant supply, seller application, supplier). Surfaced in header, footer, product page, B2B page, seller signup, contact page, order confirmation.

## Phase H — Catalog Structure Verification

- Ensure the 13 canonical categories exist (seed missing ones into `categories` if absent; do not delete existing extras).
- Product detail completeness pass (gallery, ingredients, origin, weight, storage, seller info, delivery estimate, related products, B2B CTA when applicable).

## Phase I — Safety & Verification

- Run linter + build after each phase.
- Smoke test critical flows: signup/login (buyer/seller/admin), add to cart → checkout, seller product submit → admin approve → public visibility, B2B quote submit → admin pipeline, manual COD/bank-transfer payment confirm.
- No table drops, no policy deletions, no removal of existing routes/components.

---

## Technical details

- **Schema deltas (all additive, behind one migration per phase that needs it):**
  - Phase D: `products.status` enum (`draft|pending|approved|rejected|archived`) with default `pending` for seller-submitted, `approved` for admin-created. `products.approval_note text`. `orders.paid_at timestamptz`.
  - Phase F: `sellers.is_house_account boolean default false` (mark the existing CornerMex seller `true`).
  - Phase G: extend `quotes` status enum with `contacted|quoted|negotiating|won|lost` (keep existing values); add `priority text`, `estimated_value_aed numeric`, `internal_notes text`, `source text`.
- **RLS:** unchanged except adding "sellers can insert products only with status=pending" check and "only admin can update products.status".
- **Server fns:** new `adminApproveProduct`, `adminRejectProduct`, `adminUpdateOrderPaymentStatus`, `adminUpdateQuoteCrm`; everything else reuses existing functions.
- **No edge functions added** — TanStack server fns only, per stack rules.
- **Charts:** Recharts (already in deps).
- **Sidebar:** shadcn `Sidebar` primitive; `collapsible="icon"` so it shrinks but never disappears.

---

## Out of scope (will not touch)

- Stripe / payments rewiring, real bank reconciliation, automated payouts cron.
- Email infrastructure (already pending its own approval — separate flow).
- Real currency conversion (still preference-only).
- KYC verification automation.
- Mobile native app, i18n changes beyond existing en/es/ar keys.

---

## Suggested execution order

If you approve the whole plan, I'll execute **A → B → D → E → F → G → C → H**, with Phase I checks after each. If you'd rather slice it, the highest-leverage single phase is **A + D** (design system + admin console) because every other phase inherits from those.

Tell me: **whole plan**, **A+D first**, or pick the phases you want.
