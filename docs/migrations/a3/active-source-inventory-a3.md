# Active Source Inventory A3.1

Inventory status: partial and blocked by source access.

## Evidence Levels

- **Verified configuration:** the local non-secret project reference resolves to `ywyiejqnbyzjfatojvkh`.
- **Verified RLS-visible aggregate:** exact PostgREST HEAD count returned through the production publishable key.
- **Repository evidence only:** object name exists in generated types at the A3.1 starting commit; this does not prove current live schema parity.
- **Inaccessible:** the available path cannot inspect the object.
- **Unknown:** no defensible live conclusion is possible.

## RLS-Visible Public Counts

| Object | Visible count | Evidence |
|---|---:|---|
| categories | 6 | RLS-visible exact HEAD count |
| currency_rates | 5 | RLS-visible exact HEAD count |
| product_images | 243 | RLS-visible exact HEAD count |
| product_translations | 450 | RLS-visible exact HEAD count |
| product_variants | 150 | RLS-visible exact HEAD count |
| products | 150 | RLS-visible exact HEAD count |
| shipping_rates | 2 | RLS-visible exact HEAD count |
| shipping_zones | 2 | RLS-visible exact HEAD count |

The following known public objects returned an RLS-visible count of zero: `addresses`, `anomaly_events`, `b2b_leads`, `catalog_events`, `coupon_redemptions`, `coupons`, `lead_notes`, `lead_status_history`, `loyalty_accounts`, `loyalty_transactions`, `newsletter_subscribers`, `notifications`, `order_events`, `order_items`, `order_notes`, `order_notifications`, `orders`, `payments`, `product_reviews`, `product_views`, `profiles`, `promo_banners`, `returns`, `seller_payouts`, `shipments`, `user_roles` and `wishlists`.

These zeroes describe what the anonymous/public RLS context can see. They are not verified production totals. Low-cardinality distributions and raw records were not requested.

## Inaccessible or Unknown

- `sellers`: HTTP 401 through the public path.
- Auth users, identities and enabled providers: unknown.
- Storage buckets, public/private classification, objects and aggregate bytes: unknown.
- Live schemas, columns, defaults, keys, constraints, indexes, sequences and enums: unknown.
- Live functions, security-definer functions, triggers, policies, grants, extensions, cron jobs and webhooks: unknown.
- Duplicate identities, orphan relations, monetary totals, inventory totals and timestamp ranges: unknown.
- Refund domain and payment-provider callback inventory: unknown.

## Repository Evidence

Generated source types at `b0afeb7f14bda8a3623b152228b9372094248559` describe 36 public tables and five RPCs. This is useful discovery input but cannot substitute for live catalog inspection. Historical migrations also contain marketplace and unsafe fixture paths already classified during A2; they are not assumed to be current production truth.

## Blocker

The available Supabase account does not have access to the active project, and no technically read-only database credential is configured. A3.1 cannot classify this as a complete verified inventory.

