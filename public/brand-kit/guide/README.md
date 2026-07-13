# CornerMex Marketing Kit — v1

Standalone brand + marketing package. Not imported by the CornerMex app.

## Included
- `logos/` — horizontal, stacked, monogram, social-avatar, monochrome (SVG).
- `icons/` — favicon + app icons 16→512 (SVG).
- `master-scenes/` — 4 editorial photos + 1 SVG brand texture.
- `social-media/` — Instagram, Facebook, LinkedIn, WhatsApp, X.
- `website/`, `ecommerce/` — hero, collection, promo, OG, placeholders.
- `b2b/` — LinkedIn hero, restaurant/retailer/hotel banners, A4 covers, proposal/presentation, trade-show, email signature.
- `paid-ads/` — Meta feed/story + Google Display (all IAB sizes).
- `marketplaces/` — storefront hero, tiles, banners.
- `email/` — newsletter + signature banners.
- `seasonal/` — Ramadan/Eid, UAE National Day, Mexican Independence.
- `templates/` — `copy-presets.json`, `template-schema.json`.
- `guide/` — brand guide, asset manifest, README.

## Folder structure
```
public/brand-kit/
  cornermex-marketing-kit-v1.zip
  logos/  icons/  master-scenes/
  social-media/{instagram,facebook,linkedin,whatsapp,x}/
  website/  ecommerce/  b2b/
  paid-ads/{meta,google-display}/
  marketplaces/  email/  seasonal/
  templates/  guide/
```

## Editing
Every template is a plain SVG. Open in Figma / Illustrator / Affinity / Inkscape or any text editor:
- `<text>` nodes → eyebrow / headline / body / CTA.
- `<image href="…">` → master scene.
- Colors follow tokens in `guide/brand-guide.md`.
SVGs reference `../master-scenes/…` and `../logos/horizontal/…` relatively — keep folder structure intact.

## Formats
SVG (logos, icons, all templates), JPG (master scenes), JSON (copy + schema). Rasterize to PNG/WebP from any vector tool at the final target size.

## Regenerate
```
node scripts/build-cornermex-brand-kit.mjs
```

## AI-generated content
Master scenes are AI-generated editorial photography. No third-party brands, real people or unlicensed packaging.

## Known limitations
- PNG/WebP rasters of every template are not shipped (export from vector tool).
- Ramadan/Eid variant is intentionally restrained — pair with UAE-specific copy before publishing.
- Arabic / RTL copy is not included.
- Product placeholder shows pantry photography, not specific packaged products, to avoid unlicensed packaging.
- 4 photographic master scenes + 1 SVG texture (of up to 7 planned). Add more under `master-scenes/` and reference from any template.
