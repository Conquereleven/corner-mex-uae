# Market configuration

**Status:** implemented. `src/config/market.ts`.

One object says which country CornerMex sells in. Components and server
functions read `ACTIVE_MARKET`; they do not hardcode a currency, a locale, a
country name or an address shape.

```ts
MX_MARKET = {
  code: "MX", status: "ACTIVE",
  country: "MX", countryName: "Mexico", countryNameLocal: "México",
  currency: "MXN", locale: "es-MX", timezone: "America/Mexico_City",
  defaultLanguage: "es", languages: ["es", "en"], measurements: "metric",
  phone: { callingCode: "52", nationalDigits: 10 },
  address: { model: "mx" },
  tax:   { priceModel: "UNDETERMINED", label: null },
  legal: { sellerEntity: null, taxId: null, taxIdLabel: "RFC", fiscalAddress: null },
}
```

`AE_MARKET` is kept with `status: "DEFERRED"` so historical data stays readable.

## Rules

- **One market per deployment.** `ACTIVE_MARKET` is a constant, not a
  request-time switch, so there is no per-request MX/UAE branch anywhere.
- **Unknown facts are `null`.** Seller entity, RFC, fiscal address and the tax
  model have not been supplied. Surfaces render without them
  (`marketSellerLine()` returns `null`, `taxLineLabel()` returns `null`) and
  never substitute another market's value.
- **Formatting goes through the market.** `formatMoney` → `$1,234.50`,
  `formatMoneyWithCode` → `$1,234.50 MXN`, `formatDate` uses `es-MX` and Mexico
  City time.

## Stored amounts

The canonical schema names money columns `*_aed`. Those columns hold plain
numbers; **in a Mexico database they hold MXN.** The column name is not a
currency statement, and renaming applied migrations for cosmetic reasons is out
of scope. Consequences:

- A database must not mix markets. The current canonical database holds AED
  prices and two delivered UAE orders; Mexico needs either a fresh database or a
  deliberate re-pricing of every sellable variant (`CATALOG-MIGRATION.md`).
- New Mexico-only columns and tables should use neutral names (`price`,
  `amount`, plus an explicit `currency` column).

## Tax

`priceModel` is one of `UNDETERMINED`, `INCLUDED`, `ADDED`. It is `UNDETERMINED`
until the Founder's accountant decides. While undetermined, no tax line is shown
and nothing is added on top of the catalogue price. Switching it is a one-line
change here plus, for `ADDED`, `CORNERMEX_MX_TAX_RATE`.

## Language

The storefront defaults to Spanish and offers English. Only an explicit choice
overrides the default, so a browser set to English still lands in Spanish. The
Arabic dictionary is retained for the deferred market and is not offered.

The public storefront, checkout, sign-in, contact, cookie banner, error pages,
account navigation, order history and the B2B quote flow are in Spanish. Still
English: the account sub-pages for the B2B portal, loyalty, notifications,
returns and wishlist, and the back-office. Copy is hard-coded per page; a future
English localisation means moving it into the `i18n` dictionaries, which already
carry both languages for the strings that use them.

## Environment

| Variable | Purpose |
| --- | --- |
| `CORNERMEX_PUBLIC_APPLICATION_URL` | Public base URL. Required in production; there is no infrastructure-host fallback. |
| `CORNERMEX_CHECKOUT_ENABLED` / `VITE_CORNERMEX_CHECKOUT_ENABLED` | Checkout execution gate (server / build-time). |
| `CORNERMEX_QUOTE_SIGNING_SECRET` | ≥ 32 chars. Signs shipping options. |
| `CORNERMEX_MX_ORIGIN_JSON` | Ship-from address of the Tecámac stock point. |
| `CORNERMEX_MX_MANUAL_SHIPPING_JSON` | Manual / local delivery rules. |
| `CORNERMEX_MX_SHIPPING_RANKING` | `CHEAPEST` · `FASTEST` · `BEST_VALUE` (default). |
| `CORNERMEX_MARKET` | Must be `MX`. |
| `CORNERMEX_MX_SUPABASE_PROJECT_REF` | The Mexico Supabase project ref; must match `SUPABASE_URL`. |
| `CORNERMEX_MX_COD_LOCAL_ENABLED` | Cash on delivery for local delivery only. Off by default. |
| `MERCADO_PAGO_*`, `CLIP_*` | See `PAYMENTS.md`. |
| `CORNERMEX_MX_LEGAL_DOCS_PUBLISHED` | Must be `true` in production before orders are taken. |
| `SKYDROPX_*`, `SOLO_ENVIOS_*` | See `SKYDROPX.md`, `SOLO-ENVIOS.md`. |
