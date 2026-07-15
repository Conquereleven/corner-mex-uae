# Canonical Baseline Inventory A3.1

The legacy source `ywyiejqnbyzjfatojvkh` is retired. The complete relevant inventory is the canonical empty A2 baseline in `wlrfknmrhowldygmvtvn`.

## Verified Objects

| Domain     | Tables                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| Identity   | profiles, user_roles, addresses                                              |
| Catalog    | categories, products, product_translations, product_images, product_variants |
| Inventory  | inventory, inventory_movements                                               |
| Cart       | carts, cart_items                                                            |
| Orders     | orders, order_items                                                          |
| Payments   | payments                                                                     |
| Reviews    | product_reviews                                                              |
| Promotions | coupons, coupon_redemptions                                                  |
| Analytics  | catalog_events                                                               |
| B2B        | b2b_leads                                                                    |

All 20 tables have RLS. There are 37 policies. Column and policy counts were re-read from the live target metadata. The schema fingerprint is `ffce61d5cca7d6e92699f72f4e593bb1`.

## Data State

Auth users, Storage buckets/objects, products, inventory, orders, payments and reviews are all zero. No `a3_rehearsal_*` schema exists. Empty means no legacy business truth is available to migrate; it does not authorize synthetic production data.

## Exclusions

Seller accounts, payouts, commissions, split orders, marketplace storefronts, stock-50 fixtures and CornerOps planning stock-100 remain excluded. Refunds, shipments, returns, loyalty and newsletters require future explicit contracts if needed; they are not silently invented.

## Integrity

The empty baseline has no duplicates, orphans or monetary divergence by construction. Reconciliation tooling separately proves synthetic transformations without writing them to Supabase.
