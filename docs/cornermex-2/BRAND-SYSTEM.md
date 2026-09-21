# CornerMex Brand System 1.0

Founder brand decision, 2026-09-20. CornerMex has its own visual identity and
no longer inherits the red-dominant language it shared with Intermex.

The system has one source of truth: **`src/config/brand-tokens.ts`**. Every
colour on every surface resolves back to it. Nothing else is allowed to hold a
colour value.

```
src/config/brand-tokens.ts     palette + semantic tokens (authoritative)
  └── npm run brand:css
      └── src/styles/brand-tokens.css      GENERATED --cm-* custom properties
          └── src/styles.css               maps shadcn/Tailwind onto --cm-*
              └── components                use utilities, never hex
```

`src/config/brand.ts` (BrandConfig) consumes the same module for its palette and
for logo selection, so the storefront's brand record and the design system can
never disagree.

## Core palette

| Colour        | Hex       | Role                                            |
| ------------- | --------- | ----------------------------------------------- |
| Arena Beige   | `#D8C3A5` | warm surfaces, selected areas, premium depth    |
| Sunset Orange | `#E77B30` | primary action, commerce emphasis, active state |
| Black         | `#111111` | primary text, structure, the premium anchor     |

These are **working digital design tokens**. They are not Pantone values and
this repository makes no claim of Pantone equivalence — see _Print_ below.

## Supporting neutrals

Introduced only for usability; they carry no brand meaning of their own.

| Colour      | Hex       | Why it exists                                        |
| ----------- | --------- | ---------------------------------------------------- |
| Warm Ivory  | `#F7F2EB` | the page canvas, where full beige would be too heavy |
| Sand Light  | `#E9DDCC` | raised and alternating surfaces                      |
| Charcoal    | `#2A2A2A` | dark surfaces that are not pure black                |
| Soft Border | `#D7C9B8` | hairlines on warm surfaces                           |

## Derived interaction shades

The founder's core palette is unchanged. These exist because specific
accessibility roles need them, exactly as the decision permits.

| Token                | Hex       | Why                                                             |
| -------------------- | --------- | --------------------------------------------------------------- |
| `sunsetOrangeHover`  | `#D96A1C` | hover; black on it is 5.42:1                                    |
| `sunsetOrangeActive` | `#C66418` | pressed and the focus ring; black on it is 4.71:1               |
| `emberInk`           | `#9A4408` | the only orange dark enough to be _text_ (5.88:1 on Warm Ivory) |
| `mutedInk`           | `#5C5347` | secondary text, 6.77:1 on Warm Ivory                            |

## Semantic tokens

Structural (`--cm-*`, and the Tailwind semantics mapped onto them):

`primary` · `primaryForeground` · `secondary` · `secondaryForeground` ·
`accent` · `accentForeground` · `background` · `surface` · `surfaceRaised` ·
`text` · `textMuted` · `border` · `success` · `warning` · `error`

Usage tokens, each naming a place rather than a colour:

`ctaPrimary` · `ctaPrimaryHover` · `ctaPrimaryActive` · `ctaPrimaryText` ·
`ctaSecondary` · `ctaSecondaryText` · `pageBackground` · `cardBackground` ·
`heroBackground` · `navBackground` · `navText` · `footerBackground` ·
`footerText` · `badgeBackground` · `badgeText` · `eyebrowText` · `priceColor` ·
`saleColor` · `inputBorder` · `focusRing`

Names the founder's brief suggested map onto the existing ones rather than
duplicating them: `surfacePrimary` → `surface`, `surfaceSecondary` →
`surfaceRaised`, `textPrimary` → `text`, `textSecondary` → `textMuted`,
`textInverse` → `footerText`, `brandPrimary` → `primary`, `brandAccent` →
`accent`, `borderDefault` → `border`, `pricePrimary` → `priceColor`,
`promotionAccent` → `saleColor`.

## Component rules

- **Header / nav** — Warm Ivory, black type, a soft border and one thin Sunset
  Orange hairline. Never a colour field: the old solid red band was the single
  strongest inherited cue.
- **Hero** — photography or Arena Beige. Copy is black.
- **Primary CTA** — Sunset Orange with **black** label. Hover and pressed step
  down through the derived shades.
- **Secondary CTA** — outline on the page surface, or Arena Beige fill with
  black label.
- **Product / category cards** — card surface, soft border at rest, Sunset
  Orange border on hover only.
- **Badges** — Arena Beige with black text. Stock and lifecycle badges may use
  black with ivory text.
- **Prices** — black. **Sale prices** — Ember Ink. Never base Sunset Orange.
- **Eyebrow labels** — the `eyebrowText` role (Ember Ink on light, Arena Beige
  on the dark footer). Base Sunset Orange at 11px is 2.59:1 and is not allowed.
- **Footer** — Black with Warm Ivory type. `.cornermex-footer` re-points the
  surface tokens inside it so ordinary utilities keep their contrast.
- **Forms** — Soft Border at rest, Sunset Orange focus ring plus a black
  outline. Native controls inherit `accent-color: var(--cm-primary)`.
- **Errors** — the functional `error` token, never the brand orange.

## Logo usage

The brand kit's **full-colour mark is not used on the storefront**: it is drawn
in the retired clay red `#B4362B`. Variants are selected by surface, through
`brandMark(surface)` / `<BrandLogo surface="…" />`:

| Surface          | Variant      | Contrast |
| ---------------- | ------------ | -------- |
| Warm Ivory       | `mono-black` | 16.95:1  |
| Arena Beige      | `mono-black` | 11.03:1  |
| Sunset Orange    | `mono-black` | 6.54:1   |
| Black / Charcoal | `cream`      | 15.9:1   |

No Intermex-hosted imagery or asset is used anywhere in the storefront.

## Accessibility notes

`CONTRAST_CONTRACT` in the token module lists the pairs that are enforced by
`tests/cm-brand-1/brand-system.test.mjs`; the build fails if a palette edit
breaks one.

Findings that shaped the palette:

- **White on Sunset Orange is 2.89:1 and fails.** Black on it is 6.54:1. Every
  orange CTA therefore carries a black label.
- **Sunset Orange as text on the page is 2.59:1.** It is never body copy, never
  a small label, and never a link colour; `emberInk` fills that role at 5.88:1.
- **Beige on white, and white on beige, are both too low.** Arena Beige is a
  surface, not a text colour; text on it is black.
- The focus ring is the pressed orange (3.60:1 on the page) **plus** a black
  outline, because orange alone does not clear 3:1 on Arena Beige.

## Visual anti-patterns

Do not: reintroduce a red-dominant field; use bright red/green pairings as
decoration; use Sunset Orange for long copy; place white text on beige; use
gradients as decoration; add sombrero/cactus/flag motifs or fiesta styling;
build supermarket-style dense promotional blocks; add decorative clutter.

`success` and `error` are **functional only** — status and validation. They are
never structural, decorative, or part of the brand's expression.

## Print / Pantone

The hex values here are working digital targets. Print equivalents, including
any Pantone specification, are a separate exercise with the production printer
and are **not** asserted anywhere in this repository.

## Affected surfaces

Header, navigation, mobile menu, hero, category cards, product cards, product
detail, cart, guest and authenticated checkout, order confirmation, guest
tracking, account and login, B2B public entry points, legal pages, forms,
buttons, badges, empty and loading states, footer, transactional email
templates, and the standalone error page.
