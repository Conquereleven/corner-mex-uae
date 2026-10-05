# Launch catalogue

The Mexico catalogue starts empty. The launch assortment is **50–75 SKUs**,
entered for Mexico. Nothing is copied from the UAE catalogue except what is
trustworthy about a product's identity.

## Files

| File | What it is |
| --- | --- |
| `catalog/launch-assortment-template.csv` | The empty template (header only) |
| `catalog/launch-assortment-candidates.csv` | 102 candidates from the `RESOURCE` classification, pre-filled only with trustworthy data |
| `src/lib/launch-catalog.ts` | Validation rules and the import preview |
| `scripts/cornermex-mx/launch-catalog.mjs` | `template`, `preview` and `apply` commands |

```bash
npm run catalog:launch:mx -- preview docs/cornermex-mx/catalog/launch-assortment.csv
```

The preview prints the result and writes `<file>.preview.json`. It exits non-zero
if there is any error. It writes nothing to any database.

## Columns

| Column | Required for READY | Rule |
| --- | --- | --- |
| `sku` | always | 3–40 chars: `A–Z`, `0–9`, `.`, `-`, `_`. Unique. |
| `name` | always | Up to 160 characters |
| `brand` | no | Free text |
| `supplier` | yes | Name of the supplier |
| `supplier_sku` | no | The supplier's own code |
| `cost_mxn` | yes | Plain MXN amount, up to 2 decimals, no symbol or code |
| `retail_price_mxn` | yes | Plain MXN amount, above zero |
| `b2b_price_mxn` | yes | Plain MXN amount |
| `weight_g` | yes | Whole grams, 1–70,000 |
| `length_cm`, `width_cm`, `height_cm` | yes | Centimetres, up to 200; all three or none |
| `stock` | yes | Whole units, 0 or more |
| `case_pack` | yes | Whole units, 1 or more |
| `moq` | yes | Whole units, 1 or more |
| `lead_time_days` | yes (preferred supplier) | 0–180 |
| `preferred_supplier` | yes | `yes` / `no`. Exactly one `yes` per SKU |

**Several suppliers for one SKU:** repeat the SKU on another row with the other
supplier, its code, cost and lead time, and the same product values. Exactly one
row per SKU is the preferred supplier.

## What the candidate sheet contains — and does not

Pre-filled, because it is trustworthy:

- `name` — the existing product name (in English; a Spanish name is needed);
- `brand` — only where the name carries a known brand;
- `weight_g` — only where a net weight was recorded (35 of 102), and only for
  single-presentation products;
- `sku` — a **proposed** `MX-…` identifier derived from the product slug. Change
  it freely; it is an identifier, not a fact.

Left empty on purpose, because nothing reliable exists for Mexico:
`supplier`, `supplier_sku`, `cost_mxn`, `retail_price_mxn`, `b2b_price_mxn`,
`length_cm`, `width_cm`, `height_cm`, `stock`, `case_pack`, `moq`,
`lead_time_days`, `preferred_supplier`. The UAE prices were in AED and are not
carried over in any form. A test fails if the candidate sheet ever contains one
of these.

Every candidate is therefore `DRAFT`. None can be mistaken for launch-ready.

## Eligibility

| Status | When |
| --- | --- |
| `DRAFT` | Only an identity, or the row has an error |
| `SOURCING` | A supplier or a retail price exists, but something is still missing |
| `READY` | Every required datum is present |
| `ACTIVE` | `READY` and stock above zero |

The preview lists what each SKU is missing. A row with any error is held at
`DRAFT` however complete it looks. These rules mirror the database gate
(`commerce_private.variant_launch_gaps`), which is what finally decides: the
database refuses `READY` or `ACTIVE` for an incomplete variant, and refuses an
order for anything that is not `ACTIVE`.

## Errors and warnings

Errors block the import; each carries its line, SKU and column.

| Code | Meaning |
| --- | --- |
| `COLUMN_MISSING`, `COLUMN_UNKNOWN`, `COLUMN_DUPLICATED` | The header is not the template |
| `COLUMN_NOT_MXN` | A price or cost column that is not part of the template (e.g. an AED column) |
| `SKU_REQUIRED`, `SKU_INVALID` | Missing or malformed SKU |
| `SKU_DUPLICATED`, `SKU_CONFLICT` | The same SKU twice, or repeated with different product data |
| `SUPPLIER_DUPLICATED` | The same supplier twice for one SKU |
| `PREFERRED_SUPPLIER_NOT_UNIQUE` | More than one preferred supplier |
| `MONEY_NOT_PLAIN_MXN`, `MONEY_INVALID`, `PRICE_NOT_POSITIVE` | Not a plain MXN amount |
| `INTEGER_INVALID`, `DIMENSION_INVALID`, `DIMENSIONS_INCOMPLETE` | Weight, stock, quantities or dimensions |
| `SUPPLIER_REQUIRED`, `COST_REQUIRED` | Supplier data without a supplier, or a supplier without a cost |

Warnings do not block: `PRICE_BELOW_COST`, `B2B_ABOVE_RETAIL`, `B2B_BELOW_COST`,
`MOQ_NOT_CASE_MULTIPLE`, `ASSORTMENT_ABOVE_RANGE`.

## What the Founder fills in

1. Delete rows until 50–75 remain (or add products that are not in the sheet).
2. For each remaining SKU: Spanish name, supplier, cost, retail and B2B price,
   weight, the three dimensions, stock, case pack, MOQ, lead time, and `yes` in
   `preferred_supplier`.
3. Save as `catalog/launch-assortment.csv` and run the preview until it reports
   no errors and the launch range as `inside`.

## Importing the sheet

```bash
npm run catalog:launch:mx -- apply docs/cornermex-mx/catalog/launch-assortment.csv            # dry run
npm run catalog:launch:mx -- apply docs/cornermex-mx/catalog/launch-assortment.csv --confirm  # writes
```

`apply` runs the preview again and refuses a sheet with any error. It then
refuses any database but the declared Mexico project, asks the database for its
MX/MXN identity, and — only with `--confirm` — calls
`public.cm_mx_import_launch_sku_v1` once per SKU
(`supabase/mx/migrations/20261005120000_cm_mx_2_launch_import.sql`).

What one call does, atomically and idempotently on the SKU:

- creates the product (Spanish name, brand), its variant and a `DRAFT` launch
  profile — or updates them if the SKU exists;
- stores retail and B2B price, weight, dimensions, case pack and MOQ;
- sets stock on hand and records the change in the inventory ledger; refuses a
  count below what orders have reserved;
- creates suppliers by name, links them with cost and lead time, and keeps
  exactly one preferred.

What it never does:

- **make a SKU sellable.** Every SKU arrives `DRAFT` and inactive. `READY` and
  `ACTIVE` are set per SKU through `cm_mx_set_launch_status_v1`, which refuses
  while any gap remains;
- **fill in a blank.** A value missing from the sheet is stored as unknown and
  returned as a gap; on a re-import a blank leaves the stored value alone;
- **remove a supplier** that a later sheet no longer lists.

It needs `SUPABASE_URL`, `CORNERMEX_MARKET=MX`,
`CORNERMEX_MX_SUPABASE_PROJECT_REF` and `SUPABASE_SERVICE_ROLE_KEY` in the
environment of the machine that runs it. The key is never printed. A report is
written next to the sheet as `<file>.import.json`.

## Not built yet

An admin screen for the launch assortment and for moving SKUs between statuses.
Until it exists, status changes are made through the database function.
