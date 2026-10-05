# Fulfilment

**Status:** `SCAFFOLDED` — location and manual rules implemented in
`src/lib/shipping/fulfillment.ts`; the address itself is configuration that has
not been supplied.

## Stock point

One location: **CornerMex MX - Tecámac** (`mx-tecamac`).

The Central de Abastos is where CornerMex buys. It is not assumed to be the
warehouse. The ship-from address is `CORNERMEX_MX_ORIGIN_JSON`:

```json
{ "name": "contact name (max 30)", "company": "CornerMex", "phone": "10 digits",
  "email": "…", "street": "street name", "exterior_number": "…",
  "interior_number": "optional", "colonia": "…", "municipality": "Tecámac",
  "state": "MEX", "postal_code": "5 digits", "reference": "optional (max 30)" }
```

Only the address itself is missing. Everything else — parsing, validation,
carrier formatting, the quote request — is in place.

It is validated field by field. A carrier provider cannot quote until it is
present; the checkout reports exactly which field is missing.

`locations` is a list with one default. Multi-warehouse routing (CDMX, a 3PL,
national nodes) is not built.

## Fulfilment modes

| Mode | How it is offered today |
| --- | --- |
| `PARCEL_SHIPPING` | Carrier quotes from Skydropx / Solo Envíos, or a manual national rule |
| `LOCAL_DELIVERY` | A manual rule limited to postal-code prefixes |
| `PICKUP` | Type exists; not offered |

No local last-mile provider is invented. Local delivery is a rule CornerMex
operates itself until a real provider is chosen.

## Manual rules — `CORNERMEX_MX_MANUAL_SHIPPING_JSON`

```json
[
  { "id": "local",    "label": "Entrega local",  "mode": "LOCAL_DELIVERY",
    "postalPrefixes": ["557"], "price": 0, "daysMin": 0, "daysMax": 1, "freeFromSubtotal": null },
  { "id": "nacional", "label": "Envío nacional", "mode": "PARCEL_SHIPPING",
    "postalPrefixes": ["*"],   "price": 0, "daysMin": 0, "daysMax": 0 }
]
```

The values above show the shape only — **prices and day ranges are a business
decision and none ship as defaults.** With no rule and no carrier configured the
checkout offers no shipping and takes no orders. A specific prefix beats the `*`
catch-all for the same mode.

## Parcel data

Single parcel per order. Weight comes from `product_variants.weight_grams`; a
SKU without weight uses a stated fallback (500 g), and box size is derived from
volume. Every assumption is reported (`missingWeight`, `missingDimensions`,
`oversize`) and the quote carries `parcelDataComplete: false`. An oversize order
is not auto-quoted by carriers.

124 of 204 variants have no weight and none has dimensions
(`CATALOG-MIGRATION.md`). Measuring the launch assortment removes most quote
error.

## Inventory

Unchanged: one inventory truth (`inventory`, `inventory_movements`), decremented
atomically in the order transaction and released on cancellation. A shipment
failure touches no inventory row.
