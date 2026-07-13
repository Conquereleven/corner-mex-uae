# CornerMex Marketing Kit — v2 Premium

Standalone premium brand and marketing package. Not imported by the CornerMex app.

## What's in v2
- `logos/` — 42 logo SVGs (unchanged identity: horizontal, stacked, monogram, monochrome, refined avatar).
- `icons/` — favicon + app icons 16→512.
- `master-scenes/` — 10 photos + 1 SVG texture. 6 new/regenerated premium editorial scenes + 4 retained v1 scenes.
- `social-media/` — Instagram, Facebook, LinkedIn, WhatsApp, X templates redesigned in v2 layouts.
- `website/`, `ecommerce/` — hero, collection, promo, OG, placeholders in v2 layouts.
- `b2b/` — LinkedIn hero, restaurant/retailer/hotel banners, A4 covers, proposal/presentation, trade-show, email signature — all in Executive layout.
- `paid-ads/` — Meta feed/story + Google Display (all IAB sizes) in Editorial / Banner layouts.
- `marketplaces/` — storefront hero, tiles, banners.
- `email/` — newsletter + signature banners.
- `seasonal/` — Ramadan/Eid, UAE National Day, Mexican Independence in Minimal-cream layout.
- `previews/` — **NEW in v2** — PNG + selective WebP raster previews of priority assets.
- `templates/` — copy presets + schema.
- `guide/` — brand guide, README, asset manifest.

## Layout system (v2)
V2 no longer relies on one photo+overlay formula. Six layout families:

1. **Editorial** (image-led, magazine feel)
2. **Split** (photo + cream panel, structured)
3. **Executive** (B2B / trade, credential row, filled CTA)
4. **Conversion** (product tile, arrow CTA)
5. **Minimal cream** (seasonal, italic serif, hairline dividers)
6. **Banner** (compact horizontal, ad units)

## Raster previews
`previews/` mirrors the SVG folder structure and contains PNG previews of priority assets, plus WebP for major web/social formats. Editable SVG remains the source of truth.

## Regenerate
```
node scripts/build-cornermex-brand-kit-v2.mjs
```

## Zip packages
- `cornermex-marketing-kit-v1.zip` — original v1 archive (retained).
- `cornermex-marketing-kit-v2-premium.zip` — v2 premium archive (~92 MB, externalized to Lovable Assets CDN).
  - Pointer file: `cornermex-marketing-kit-v2-premium.zip.asset.json` — read its `url` field to obtain the CDN download URL.
  - Externalized because it exceeds the 10 MB per-file repo limit. The build script uploads the ZIP via the `lovable-assets` CLI and updates the pointer automatically.

## Known limitations (v2)
- Arabic / RTL copy still not included. Vertical space reserved for later native review.
- Product placeholder still uses pantry editorial photography, not specific packaged products.
- Some tiny IAB ad units (300×250, 728×90) intentionally strip body copy and eyebrow; only headline + arrow CTA fits legibly.
- PNG previews are downscaled to ≤1600px on the long edge to keep the ZIP portable.
- Rasterization inlines referenced JPGs as base64 data URIs in the SVG before rendering, so the editable SVGs themselves still use relative paths — keep folder structure intact when moving files.
