# Live View → Commerce Cockpit Upgrade

Surgical upgrade of `/admin/live-view` for CornerMex (first-party retailer). Zero new dependencies, no schema changes, no touching unrelated admin routes.

## Files changed

1. `src/lib/live-view.functions.ts` — data correctness + activity feed
2. `src/components/site/LiveGlobe.tsx` — overlay + empty state (surgical)
3. `src/routes/_authenticated/admin.live-view.tsx` — full UI refactor with local sub-components
4. `src/routes/_authenticated/admin.tsx` — subtitle wording only ("Commerce cockpit")

No new files unless a sub-component exceeds ~80 lines (only `LiveActivityFeed` is a likely candidate; keep inline first).

## Phase 1 — Data correctness (`live-view.functions.ts`)

- **Paid-only geo**: filter `recentOrders` to `paid_at IS NOT NULL OR payment_status IN ('paid','succeeded','completed')` before building `orderPoints`, `arcs`, `locationAgg`.
- **Deterministic jitter**: replace `Math.random()` with a small hash of `order.id` (simple `charCodeAt` fold → [-0.03, 0.03]) so points don't jump between refreshes.
- **Clamp**: `conversionRate`, `cartAbandonment`, `checkoutAbandonment` clamped to [0,1] server-side.
- **Rename**: `topLocations[].sessions` → `topLocations[].orders`; update UI label ("orders", not "orders" already — align).
- **Window label**: expose `windowLabel: "Last 24h"` in payload; UI uses it (replaces "Today" in subtitle/section titles for the 24h aggregates).
- **Activity feed**: pull last 15 `catalog_events` where `event_type IN ('product_view','add_to_cart','checkout_started','purchase_completed')` ordered by `created_at DESC`. Join product name via existing `productMeta` map (best-effort; degrade if missing). Return `activityFeed: Array<{ id, eventType, productName?, productSlug?, revenueAed?, createdAt, source? }>`.

## Phase 2 — LiveGlobe surgical enhancements

- Add absolute-positioned overlay (top-left inside container): "N orders · N emirates · Last: {label}". Props: `stats?: { orders: number; emirates: number; lastLabel?: string }`.
- Premium empty-state overlay when `points.length === 0` ("Waiting for paid orders…").
- Add `// TODO: Replace external texture with local asset for offline resilience` above `globeImageUrl`.
- Keep lazy import, arcs, dark theme.

## Phase 3 — UI refactor (`admin.live-view.tsx`)

Local sub-components (same file):

- `LiveViewCommandBar` — live dot (green pulsing / amber paused), title, subtitle "CornerMex storefront activity", timestamp + "UAE time", buttons: Refresh, Pause/Resume, Streamer toggle, Fullscreen.
- `LiveKpiGrid` + `LiveKpiCard` — primary (Visitors now, Sales 24h, Orders 24h, Conversion) and secondary (AOV, Active carts, Checkout abandonment, Returning %). Tabular nums (`tabular-nums`), Lucide icon, `Skeleton` while loading. Streamer mode hides Sales/AOV as `••••`.
- `LiveCustomerFunnel` — horizontal 3-stage funnel (Active carts → Checking out → Purchased) with drop-off %; amber `Badge` if checkout abandonment > 70%.
- `LiveActivityFeed` — scrollable list (max-h with `overflow-y-auto`), icon per event type, relative timestamp, product link when slug present, revenue hidden in streamer.
- `LiveAnalyticsCard` — thin wrapper around shadcn `Card` with title + optional right-slot + empty-state support.

State (component-local `useState`):
- `paused: boolean`, `streamer: boolean`, `fullscreen: boolean`.
- Query `refetchInterval: paused ? false : 15_000`.
- Fullscreen: `containerRef.current?.requestFullscreen()` / `document.exitFullscreen()`; listen to `fullscreenchange` to sync state.

Layout (matches spec):

```text
[ CommandBar ]
[ Globe (lg:col-span-3) | KPI Grid + Activity Feed (lg:col-span-2) ]
[ Row: Funnel | Sales 24h ]
[ Row: Page views 10m | Top products ]
[ Row: Top locations | Traffic sources ]
```

Mobile: stack single column; globe first.

Empty states everywhere (no fake bars): sales chart, pageviews chart, top products, top locations, top sources, activity feed, globe.

## Phase 4 — Wording

- `admin.tsx`: change subtitle to "Commerce cockpit" (leave everything else — sidebar, nav, seller routes — untouched).

## What is NOT touched

- No new deps, no new tables, no migrations.
- No sidebar/shell redesign, no seller route changes, no legal/checkout edits.
- No time-window selector; "Last 24h" is fixed.
- Route guard (`_authenticated`) unchanged.

## QA

- `tsgo --noEmit` clean, no new `any`.
- Manual: pause/resume toggles refetch, streamer hides AED strings, fullscreen enters/exits, empty states render when data is empty, points stable across refreshes.

## TODOs left for next phase

- Local globe texture asset (comment in place).
- Historical delta ("vs previous 24h") — needs a second aggregate query; deferred.
- Recharts migration if custom bars ever need axes/tooltips beyond current needs.
