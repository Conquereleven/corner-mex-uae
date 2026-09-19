# CornerMex 2.0 — Legal & Commercial Identity

**Status:** founder decision, final for CornerMex 2.0 (2026-09-19).
**Reaffirms:** `FD-CM-BUSINESS-IDENTITY-001` (founder-attested; brand `CornerMex`).
**Code authority:** `src/lib/business-identity.ts` — the only place identity literals may appear (enforced by `tests/cm-com-2a`).

| Role                            | Entity                 |
| ------------------------------- | ---------------------- |
| **Public ecommerce brand**      | **CornerMex**          |
| **Seller / merchant of record** | **RodMor TradeCo LLC** |
| **Intermex**                    | **Supplier only**      |

```
Customer ──buys from──▶ CornerMex (brand) ── sold by ──▶ RodMor TradeCo LLC

Intermex ──supplies products──▶ RodMor TradeCo LLC / CornerMex ──sells──▶ Customer
```

Intermex is **not** the CornerMex merchant, seller of record, checkout seller,
ecommerce legal entity, invoice issuer for CornerMex customer orders, payment
merchant identity, or public ecommerce brand.

---

## 1. Verified identity values

Only values already recorded in the repository or production are used. Nothing
was invented.

| Field                                | Value                              | Source                                                                                                                                                      | Status                                                                                            |
| ------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Legal entity                         | RodMor TradeCo LLC                 | `FD-CM-BUSINESS-IDENTITY-001`; `business-identity.ts`                                                                                                       | Founder-attested                                                                                  |
| Trade licence                        | 2647014.01                         | same                                                                                                                                                        | Founder-attested                                                                                  |
| Licensing authority / location       | Sharjah Media City, Free Zone, UAE | same                                                                                                                                                        | Founder-attested                                                                                  |
| Bank beneficiary                     | RodMor TradeCo LLC                 | same                                                                                                                                                        | Founder-attested                                                                                  |
| VAT TRN                              | 105514792800001                    | `commercial-config.server.ts` `FOUNDER_ATTESTED_TRN`; `CM-COM-3A_ACTIVATION_RUNBOOK.md` ("Legal selling entity: RodMor TradeCo LLC; … TRN 105514792800001") | Founder-attested; **verified live** — production `/checkout` config returns this TRN (2026-09-19) |
| Street address, phone, support hours | —                                  | typed optional, left unset                                                                                                                                  | Not attested — must not be fabricated                                                             |

**Conflicts found:** none for RodMor. One historical spelling (`RodMor Trade Co LLC`) was already resolved in `FD-CM-BUSINESS-IDENTITY-001`.

**Other entities recorded in the repo (not CornerMex identity):**

| Entity                           | Identifier                                  | Where                                                    | Role                                      |
| -------------------------------- | ------------------------------------------- | -------------------------------------------------------- | ----------------------------------------- |
| Intermex Pro General Trading LLC | Zoho org `773588238`, TRN `100491647200003` | `docs/intermex-zoho-test-activation/observed-facts.json` | **Supplier** — now in `SUPPLIER_ENTITIES` |
| Majid Al Futtaim Cinemas LLC     | TRN `100347258400003`                       | same                                                     | Intermex's B2B customer (PO automation)   |

---

## 2. System map

| System                                                      | Before (origin/main `f90134b`)                                                                              | Now                                                                                                                                                                                                                                                                                                                            | Evidence / guard                                                                                                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Business identity registry**                              | `brandName: "Intermex"` — contradicted the founder record it cited                                          | `brandName: "CornerMex"`, `merchantOfRecord: "RodMor TradeCo LLC"`, `SUPPLIER_ENTITIES` records Intermex                                                                                                                                                                                                                       | `tests/cm-com-2a`, `tests/cm-intermex-brand-1`                                                                                                           |
| **Storefront brand config**                                 | `INTERMEX_BRAND` with Intermex logo/imagery from `intermexuae.com`                                          | `CORNERMEX_BRAND` / `ACTIVE_BRAND` from `public/brand-kit` (palette from `brand-guide.md`)                                                                                                                                                                                                                                     | `tests/cm-intermex-brand-1`                                                                                                                              |
| **Public metadata** (`<title>`, OG, Twitter, JSON-LD)       | "Intermex — UAE commercial preview"                                                                         | CornerMex                                                                                                                                                                                                                                                                                                                      | `tests/cm-intermex-storefront-2`                                                                                                                         |
| **Header / footer / nav**                                   | Intermex UAE                                                                                                | CornerMex; footer shows `businessIdentityLine()` → "CornerMex, a trading brand of RodMor TradeCo LLC · …"                                                                                                                                                                                                                      | same                                                                                                                                                     |
| **Product page seller line**                                | "Sold by Intermex"                                                                                          | `sellerOfRecordLine()` → "Sold by RodMor TradeCo LLC, trading as CornerMex"                                                                                                                                                                                                                                                    | `tests/cm-launch-1`                                                                                                                                      |
| **Shop seller line**                                        | "Products are sold directly by Intermex UAE."                                                               | `sellerOfRecordLine()`                                                                                                                                                                                                                                                                                                         | same                                                                                                                                                     |
| **Checkout legal line**                                     | "RodMor TradeCo LLC — VAT TRN …"                                                                            | unchanged (already correct)                                                                                                                                                                                                                                                                                                    | live TRN verified                                                                                                                                        |
| **Terms / Privacy / Returns / Sourcing / Seller agreement** | Intermex named as seller of record; supplier disclosure removed                                             | Governed text restored from `cbcdf08`; every seller-of-record sentence names `${LEGAL_ENTITY_NAME}`, trading as CornerMex; Intermex disclosed **as supplier**. Versions bumped (Terms 1.2.0, Privacy 1.1.0, Sourcing 1.2.0, Seller Agreement 1.1.0-draft), `lastUpdated` 2026-09-19. **Legal Review Required** status retained | `tests/cm-intermex-brand-1`                                                                                                                              |
| **Transactional email**                                     | sender `Intermex <…>`, templates "Intermex"                                                                 | `CornerMex <…>`                                                                                                                                                                                                                                                                                                                | external email is **disabled** in production                                                                                                             |
| **Order confirmation / account pages**                      | Intermex                                                                                                    | CornerMex                                                                                                                                                                                                                                                                                                                      | `tests/cm-intermex-storefront-2`                                                                                                                         |
| **Stripe line item**                                        | "Intermex order #…"                                                                                         | "CornerMex order #…"                                                                                                                                                                                                                                                                                                           | card payments **disabled**                                                                                                                               |
| **Stripe account statement descriptor / business name**     | not in code                                                                                                 | **Dashboard setting — must be set to CornerMex / RodMor before card launch**                                                                                                                                                                                                                                                   | manual                                                                                                                                                   |
| **Zoho customer invoices**                                  | organization taken from `CORNERMEX_ZOHO_ORGANIZATION_ID` with no guard; the only recorded org is Intermex's | Provider refuses `createCustomer` / `createInvoice` / `updateInvoice` / `recordPayment` into any `SUPPLIER_ENTITIES` org (`ZOHO_SUPPLIER_ORGANIZATION_CANNOT_ISSUE_CORNERMEX_DOCUMENTS`, non-retryable); readiness reports `organization_is_supplier_entity`                                                                   | `tests/cm-int-zoho-1/supplier-organization-guard.test.mjs` (negative-controlled); writes also still blocked by `ZOHO_LIVE_ACTIVATION_AUTHORIZED = false` |
| **Zoho PO automation** (`createPoInvoice`)                  | invoices Intermex's customers in Intermex's org                                                             | **unchanged**; dormant                                                                                                                                                                                                                                                                                                         | see §4                                                                                                                                                   |
| **Admin legal status panel**                                | "Intermex disclosure: Configured"                                                                           | "Supplier disclosure" naming Intermex as supplier and RodMor as seller                                                                                                                                                                                                                                                         | —                                                                                                                                                        |
| **SEO generator** (`scripts/seo-products.mjs`)              | wrote "Available from Intermex …", title suffix "· Intermex"                                                | CornerMex                                                                                                                                                                                                                                                                                                                      | `tests/cm-intermex-storefront-2`                                                                                                                         |
| **Homepage categories**                                     | 7 Intermex Shopify collections; **6 did not exist** in the canonical catalogue, incl. "Intermex Production" | 7 real canonical categories                                                                                                                                                                                                                                                                                                    | `tests/cm-intermex-brand-1`                                                                                                                              |

## 3. Intermex references intentionally preserved

| Reference                                                                                                                             | Why it stays                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intermex-card-operation:<buyerId>` (localStorage), `intermex-checkout:<buyerId>` (Web Lock)                                          | Card idempotency compatibility keys. Renaming orphans in-flight operations → duplicate orders/charges. Requires an approved read-both/write-new migration.       |
| `intermex-po-v1`, `"INTERMEX PO v1"`                                                                                                  | Supplier PO document contract, enforced by a DB check in an applied migration.                                                                                   |
| Applied migrations `…intermex_go_live_2_…`, `…intermex_po_automation_1`                                                               | Immutable history.                                                                                                                                               |
| `products.attrs.cm_com_3a.provider = "intermex_uae"` (195 products)                                                                   | Supplier provenance metadata.                                                                                                                                    |
| `products.brand = "Intermex UAE"` (75 products)                                                                                       | Manufacturer brand of products Intermex makes; already hidden in the storefront by `public-product-brand.ts`.                                                    |
| 9 product slugs containing `intermex`; 8 product names ending ", INTERMEX"; 10 descriptions attributing products to Intermex as maker | Product identity of Intermex-manufactured goods (like a brand on a label), not merchant claims. Slugs are URLs. No description uses merchant phrasing (checked). |
| Legal text naming Intermex as a supplier                                                                                              | Required supplier disclosure.                                                                                                                                    |
| `public/brand-kit/intermex/` and `validate-intermex-brand.mjs`                                                                        | Custody record of historical Intermex assets. No longer referenced by the storefront.                                                                            |
| Internal CSS class names `.intermex-*`, test directory names `tests/*intermex*`                                                       | Not customer-visible; renaming is churn.                                                                                                                         |
| Supplier/Zoho/PO documentation                                                                                                        | Historical and supplier-side truth.                                                                                                                              |

## 4. Decisions still needed

1. **Zoho for CornerMex.** No RodMor TradeCo LLC Zoho organization is recorded
   anywhere. Required configuration before any CornerMex invoice can be issued:
   `CORNERMEX_ZOHO_PRODUCT`, `CORNERMEX_ZOHO_ORGANIZATION_ID` (a RodMor org —
   the supplier org is now refused), `CORNERMEX_ZOHO_API_BASE_URL` (data centre),
   OAuth credentials, `CORNERMEX_ZOHO_VAT_TAX_ID` mapped to TRN
   105514792800001, invoice numbering policy, then a reviewed change setting
   `ZOHO_LIVE_ACTIVATION_AUTHORIZED = true`.
2. **Intermex PO automation.** As built, the CornerMex platform issues invoices
   _as Intermex_ to Intermex's own customers (e.g. MAF). This is a
   purchase-order-counterpart activity, not a CornerMex customer invoice, so it
   was left intact and it is dormant. Confirm whether CornerMex should operate
   it for the supplier; if yes, give it its own explicitly named configuration
   rather than `CORNERMEX_ZOHO_*`, which now refuses the supplier organization.
3. **Stripe dashboard.** Set business name / statement descriptor to CornerMex
   (RodMor TradeCo LLC) before enabling card.
4. **Brand-kit imagery provenance.** The master-scene photographs used on the
   homepage are recorded as "regenerated (v2)" with no licence/provenance entry.
   The previous Intermex policy forbade generated imagery; confirm these are
   acceptable for CornerMex.
5. **Catalogue content (production data, not changed):** the Jarritos
   description contains a scraped `INTERMEXUAE` watermark, and two duplicate
   products (`corn-tortilla-intermex-copy`, `flour-tortillas-intermex-copy`)
   are active. Cleaning them is a production data write.

## 5. Launch gate — Legal Identity

| Criterion                                                                      | Status                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| CornerMex is the public brand                                                  | ✅ on branch `launch/cornermex-2` (not yet deployed)                            |
| RodMor TradeCo LLC is the configured seller                                    | ✅ `merchantOfRecord`; live TRN verified                                        |
| No active checkout path presents Intermex as merchant                          | ✅ invariant test over routes, components, emails, Stripe line item, legal docs |
| New CornerMex invoices cannot be issued under Intermex Pro General Trading LLC | ✅ provider guard + readiness reason + global activation flag off               |
| Supplier references to Intermex preserved                                      | ✅ §3; persisted keys pinned by test                                            |

**GREEN once deployed.** Production still serves the Intermex storefront until
this branch is merged and deployed.
