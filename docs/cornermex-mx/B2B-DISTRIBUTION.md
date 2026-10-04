# B2B distribution and procurement

**Status:** `PLANNED` (Sprint MX-4). Existing B2B capability is preserved; the
pricing tiers and the supplier model below are designed, not built.

## What exists today (kept)

| Capability | Where |
| --- | --- |
| B2B lead intake with anti-abuse and admin pipeline | `submit_b2b_lead_v2`, `AdminB2bLeadPipeline` |
| Human-reviewed quote drafts | `cm_launch_1_l5r_quote_draft_integrity` |
| B2B customer accounts and members | `commerce_private.b2b_customer_accounts`, `b2b_account_users` |
| Per-account variant prices | `commerce_private.b2b_account_variant_prices` |
| Saved lists, reorder intent, B2B portal | `b2b-portal.functions.ts` |
| Inventory policies (reorder point) | `commerce_private.inventory_policies` |

In this pass the public B2B pages and the quote form were moved to Mexico (state
instead of emirate, Spanish copy, no AED).

**Blocker:** `b2b_account_variant_prices.currency_code` is constrained to
`'AED'`. Account pricing cannot hold MXN until a migration relaxes it.

## Customer type is not sales channel

```
customer_type:  RETAIL | B2B          (who is buying)
sales_channel:  web | whatsapp | admin | marketplace   (how the order arrived)
```

A B2B customer may order through any channel. Both are attributes of the order;
neither is derived from the other.

## Pricing tiers (design)

One price list per variant, evaluated by quantity:

| Tier | Typical buyer | Rule |
| --- | --- | --- |
| `RETAIL` | Consumer | 1 unit |
| `B2B` | Small retailer | from N units (e.g. 6 / 12) |
| `CASE` | Restaurant | multiples of `case_pack` |
| `VOLUME` | Distributor | from a volume threshold |

Proposed table `variant_price_tiers (variant_id, tier, min_quantity, unit_price,
currency)`; account-specific prices keep overriding it. The order transaction
stays the single pricing authority: tiers are resolved inside it, never in the
browser.

## Procurement (design)

One SKU, many suppliers, one preferred supplier chosen operationally. No second
product truth.

```
suppliers                (id, name, contact, location, notes, is_active)
variant_suppliers        (variant_id, supplier_id, supplier_sku, supplier_cost,
                          currency, last_purchase_cost, lead_time_days,
                          minimum_purchase_quantity, case_pack,
                          supplier_availability, last_cost_update, is_preferred)
                          unique (variant_id) where is_preferred
```

Replenishment view, per SKU: `on_hand, reserved, available, sales_velocity,
preferred_supplier, last_cost, lead_time, reorder_point`. Sales velocity is a
plain trailing average; no forecasting.

The existing Intermex purchase-order automation belongs to the UAE supplier and
stays deferred.

## Admin (Sprint MX-4)

Sales in MXN, B2C and B2B orders, AOV, gross and contribution margin, stock and
low stock, supplier cost, purchase orders, shipment status, carrier, shipping
cost, tracking, payment provider and status. Integration health for Mercado
Pago, Clip, Skydropx and Solo Envíos (`NOT_CONFIGURED · SANDBOX · CONNECTED ·
DEGRADED · LIVE`) — the shipping half is already exposed by
`getShippingIntegrationHealth()` and never includes a credential.
