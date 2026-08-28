# CM-INTERMEX-BRAND-1 — migration notes

## Architecture

The storefront is a tenant layer over the existing commerce core:

`CornerMex Core → Brand Config → Intermex Storefront`

`src/config/brand.ts` owns Intermex identity, official verbal territory, named Brand Book 2025 colors, and asset provenance. `SiteLayout` injects semantic CSS variables from this config. Header, footer, home merchandising modules and product cards consume those variables and the official asset paths; catalog queries, cart, checkout and account flows remain shared core capabilities.

No admin visual system or B2B operational flow is changed by this migration.

## Live route/content mapping

| Intermex source | CornerMex route    | Migration treatment                                                                                        |
| --------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Home            | `/`                | Preserved; official hero, centered logo, promo CTA, collections, offers/find-us/wholesale modules          |
| Catalog         | `/shop`            | Preserved; responsive filters, searchable catalog, sale badge and product card hierarchy                   |
| Product detail  | `/product/:slug`   | Preserved; shared core data and checkout semantics, Intermex shell                                         |
| Contact         | `/contact`         | Preserved; support/B2B/legal channels; Find Us link maps here until an official location route is provided |
| About Us        | `/about`           | Preserved route; copy remains operationally accurate and avoids unsupported claims                         |
| Find Us         | `/contact#find-us` | Redirect-map target only; physical location details await verified source content                          |

The route map is preparatory only. No domain, redirect, Shopify shutdown or deployment cutover is performed in this PR.

## Visual decisions

- The existing Intermex logo and hero are downloaded from the live site and tracked in `public/brand-kit/intermex/asset-provenance.json` with source URL and SHA-256.
- Only the two named colors from Brand Book 2025 are treated as exact: Molé Brown `#6e441d` and Verde Jalapeño `#2d9849`. Red, yellow and cream remain semantic surfaces until Sabrina/Linda provide legible official values.
- Product cards retain the live grammar: image-first, cream field, dark/brown outline, prominent prices and Sale/HORECA badges.
- The responsive header uses a centered official logo and keeps Home, Catalog, Contact, About Us and Find Us architecture discoverable without shrinking controls below a usable touch target.
- The Juan mascot is not recreated. It is explicitly recorded as `awaiting_official_asset`.

## SEO redirect strategy (not activated)

Keep existing slugs for `/`, `/shop`, `/products/*`, `/pages/about-us`, `/pages/contact`, and `/pages/find-us` at the future edge. If a route must change, issue a permanent redirect only after domain/cutover approval and preserve query parameters for catalog filters. Validate canonical tags, sitemap and product structured data against the future host before activation.
