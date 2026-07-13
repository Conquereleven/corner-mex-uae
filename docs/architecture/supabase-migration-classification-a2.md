# Supabase Migration Classification A2

The historical chain targets the former marketplace model and is not replayed on the empty A2 target. The only authorized target baseline is `20260714010000_commerce_foundation_a2.sql`.

## Classification

| Class | Historical migrations | A2 decision |
|---|---|---|
| Legacy marketplace core | `20260521030516`, `20260521030534`, `20260530184757`, `20260603153510`, `20260604154550`, `20260605152633` | Excluded: sellers, KYC, storefront, commission and payout coupling |
| Legacy order/payment | `20260525015651`, `20260527174533`, `20260601050520`, `20260608033611`, `20260608040909`, `20260608090000` | Replaced by single-merchant tables and policies |
| Legacy shipping/returns/loyalty | `20260601044945`, `20260601051711`, `20260601175518` | Deferred; seller-coupled portions excluded |
| Coupons/content/newsletter | `20260601181026`, `20260601181050` | Coupon contract curated; newsletter deferred |
| Unsafe business seed | `20260606013014` | Excluded: sample sellers, products, orders and inventory |
| Security/grant experiments | `20260608030528`, `20260608030604`, `20260608224734`, `20260609023619`, `20260609023719`, `20260609190101`, `20260609190144`, `20260713032328` | Not replayed; least-privilege rules rebuilt |
| Catalog/SEO business data | `20260609020000`, `20260609040000`, `20260609192843`, `20260610180224`, `20260611020854`, `20260613163854` | Schema concepts curated; product/content rows excluded |
| B2B and analytics | `20260609194736`, `20260609202451`, `20260609204659`, `20260610150754`, `20260709013644` | Minimal B2B lead/catalog event contracts curated; anomaly data deferred |
| Review hardening | `20260612151414` | Replaced with verified-purchase-safe review policy |
| Legal acceptance | `20260702170704` | Curated as nullable order evidence |
| A1 target security | `20260713222315` | Preserved; already applied to target |
| A2 clean baseline | `20260714010000` | `approved_for_target_application` |

All 41 pre-A2 files are accounted for above. Unknown semantics default to excluded. No historical file is edited or replayed.

## Explicit exclusions

Seller accounts, seller auth, storefronts, KYC, payouts, commissions, split orders, seller balances, settlement, sample products, stock 50, planning stock 100, SEO product rows and all business fixtures are outside A2.
