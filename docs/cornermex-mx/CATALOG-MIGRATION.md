# Catalogue migration

**Status:** classification done (read-only). No product was changed, deactivated
or deleted.

## Source

Canonical database `wlrfknmrhowldygmvtvn`, read 2026-10-04 through the anonymous
publishable key: **195 products, 204 variants, all `active`.**

Every row was ingested from the UAE supplier's public storefront
(`scripts/cm-com-3a/ingest-intermex-catalog.mjs`), under the rule "CornerMex
price = the supplier's current price, in AED". So for the whole catalogue:

- the **price is in AED** and is the UAE retail price, not a Mexican price;
- the **supplier is the UAE supplier**;
- the `brand` column holds the storefront's vendor label (`My Store`,
  `Intermex UAE`), not the product's brand.

## Result

| Class | Products | Meaning |
| --- | ---: | --- |
| `KEEP` | 0 | Nothing can be kept as-is: every product needs a Mexican supplier and price |
| `RESOURCE` | 102 | Keep the product, replace the supplier |
| `REVIEW` | 56 | Needs a commercial decision |
| `REMOVE_FROM_ACTIVE_MX` | 25 | Not appropriate for the Mexico launch |
| `INTERMEX_PRIVATE` | 12 | Intermex private label / own production — must not be sold |

Full per-product report, with the rule and reason for every row:
`catalog/catalog-classification.csv`. Input snapshot: `catalog/catalog-snapshot.json`.
Totals: `catalog/catalog-classification-summary.json`.

### Rules (first match wins)

| Rule | Class | Count | Evidence |
| --- | --- | ---: | --- |
| `intermex-named` | INTERMEX_PRIVATE | 8 | Product name carries "Intermex" |
| `intermex-own-production` | INTERMEX_PRIVATE | 2 | Unbranded tortilla/chip line under an Intermex slug |
| `unbranded-tortilla-line` | INTERMEX_PRIVATE | 2 | Unbranded tortilla / chips from the supplier's storefront (**inferred**) |
| `non-mexican-uae-brand` | REMOVE | 10 | Fit Panda, Hungry Guru, Inzi — the UAE supplier's local assortment |
| `souvenir-lifestyle` | REMOVE | 15 | Sombreros, bandanas, T-shirts, piñata kits, gift baskets |
| `cold-chain` | REVIEW | 3 | Chilled / frozen: parcel shipping has no cold chain |
| `kitchenware` | REVIEW | 3 | Tortilla press, molcajete, mat |
| `assembled-by-supplier` | REVIEW | 4 | Candy bags, sampler packs assembled by the supplier |
| `legacy-intermex-slug` | REVIEW | 1 | Branded product whose slug still says Intermex |
| `export-market-brand` | REVIEW | 7 | El Mexicano, Clamato 1.89 L, Cholula — export presentations |
| `small-producer` | REVIEW | 38 | La Conspiración, La Meridana, Xatze, El Fresno, Nopal Foods, Naturelo, Omalli, Mayamel, Pepe Crunch |
| `national-brand` | RESOURCE | 96 | La Costeña, Valentina, El Yucateco, Maseca, Jarritos, Tajín, De la Rosa, Marinela, Sabritas lines, Doña María, Herdez, Maggi… |
| `generic-pantry` | RESOURCE | 6 | Unbranded pantry staples available from local wholesale |

The rules are in `scripts/cornermex-mx/classify-catalog.mjs`, where each one
states the evidence it relies on. Re-run:

```bash
SUPABASE_URL=https://wlrfknmrhowldygmvtvn.supabase.co SUPABASE_PUBLISHABLE_KEY=<publishable key> node scripts/cornermex-mx/classify-catalog.mjs
```

The local `.env` points at the obsolete Supabase project; pass the canonical URL
explicitly as above.

## Data gaps that affect Mexico

| Gap | Variants |
| --- | ---: |
| Price is AED | 204 of 204 |
| No weight | 124 of 204 |
| No dimensions (the schema has no columns for them) | 204 of 204 |
| Price is zero | 1 (`la-costena-guacamole-salsa`) |

Shipping quotes still work without this data: the parcel is estimated and the
quote is flagged `parcelDataComplete: false` (`SHIPPING.md`).

## Launch assortment

The 195 UAE products are **not** migrated. Mexico starts from an empty catalogue
and a **launch assortment of 50–75 SKUs** entered for Mexico.

Every variant has a launch status
(`commerce_private.variant_launch_profiles`):

| Status | Meaning | Sellable |
| --- | --- | --- |
| `DRAFT` | Created, nothing decided | No |
| `SOURCING` | Looking for a supplier and a cost | No |
| `READY` | Every required datum present | No |
| `ACTIVE` | On sale | **Yes** |
| `PAUSED` | Temporarily off sale | No |

`READY` and `ACTIVE` are refused by the database while any of these is missing:
SKU, retail price, weight, dimensions, B2B price, an inventory record, case
pack, minimum order quantity, a preferred supplier and its lead time. The error
names the gaps (`MX_LAUNCH_NOT_READY: dimensions,b2b_price,…`).

A variant cannot be switched on any other way: a trigger rejects
`is_active = true` unless the variant is launch-`ACTIVE`, and the order function
refuses any item that is not. A product is listed exactly while it has an
`ACTIVE` variant. So a product with missing shipping or commercial data cannot
silently become launch-ready.

| Launch field | Where it lives |
| --- | --- |
| supplier, supplier SKU, cost, last cost, lead time, MOQ, case pack, preferred | `variant_suppliers` |
| retail price, weight, stock | `product_variants`, `inventory` (canonical) |
| B2B price, length, width, height | `variant_launch_profiles` |
| case pack, MOQ, reorder point (selling side) | `inventory_policies` (canonical, reused) |

`cm_mx_launch_assortment_v1()` returns every variant with its status, its gaps,
stock position, preferred supplier, cost and 30-day units sold.

The classification below is the shortlist to choose those 50–75 SKUs from: the
102 `RESOURCE` rows first, then the `REVIEW` rows the Founder approves.

## What must happen before anything is sold in Mexico

1. **Create the Mexico database** — decided: a new Supabase project
   (`DATABASE-BOOTSTRAP.md`). Nothing from the UAE catalogue is copied.
2. **Founder review of the 56 `REVIEW` rows** and confirmation of the 12
   `INTERMEX_PRIVATE` rows (two are inferred).
3. **Real catalogue load:** for each `RESOURCE` product, a local supplier,
   supplier cost, MXN retail price, presentation, weight and dimensions.
4. Products that are not re-sourced stay `inactive` — not deleted — so order
   history keeps resolving.

Nothing here is applied automatically. Deactivation and re-pricing are an
explicit, reviewed step.
