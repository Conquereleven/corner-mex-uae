import type { CSSProperties } from "react";
import { CORNERMEX_PALETTE, CORNERMEX_LIGHT } from "./brand-tokens.ts";

/**
 * Brand configuration is intentionally separate from the CornerMex commerce
 * core. Storefronts consume this contract; operations and catalog data do not
 * need to know which visual identity is currently active.
 */
export type BrandAsset = {
  src: string;
  alt: string;
  sourceUrl: string;
  sourceType: "cornermex-brand-kit";
};

export type BrandConfig = {
  id: string;
  displayName: string;
  verbal: {
    primary: string;
    secondary: string;
  };
  /**
   * The three core brand colours, read from the token module so a storefront
   * cannot disagree with the design system.
   */
  colors: {
    arenaBeige: string;
    sunsetOrange: string;
    black: string;
  };
  assets: {
    /**
     * One mark per surface the logo actually lands on. Picking a variant is a
     * lookup, never a judgement call at the call site.
     */
    logos: {
      onIvory: BrandAsset;
      onBeige: BrandAsset;
      onSunset: BrandAsset;
      onDark: BrandAsset;
    };
    hero: BrandAsset;
    collections: Record<string, BrandAsset>;
  };
};

const KIT = "/brand-kit";

/**
 * CornerMex public brand (founder decision, 2026-09-19): CornerMex is the only
 * public ecommerce brand; BUSINESS_IDENTITY.merchantOfRecord is the seller of record
 * (see src/lib/business-identity.ts); Intermex is a supplier only and has no
 * storefront brand configuration.
 *
 * Every value below comes from the CornerMex brand kit already in this
 * repository (public/brand-kit/guide/brand-guide.md, palette line "Clay #B4362B,
 * Sage #3E7A54, Cream #F8F3E8, Sand #EFE6D2, Obsidian #2A2622 …"). The colour
 * keys keep their historical names because they only feed the generic
 * --brand-* CSS variables; the values are CornerMex's.
 *
 * Imagery uses the kit's master-scene photographs directly. The kit's composite
 * SVGs embed those photos via <image href>, which browsers do not load when an
 * SVG is rendered through <img>, so they are not used here.
 */
export const CORNERMEX_BRAND: BrandConfig = {
  id: "cornermex",
  displayName: "CornerMex",
  verbal: {
    // Previously published CornerMex copy (site meta before 2026-08-28).
    primary: "Authentic Mexican pantry in the UAE",
    secondary: "Authentic Mexican chiles, salsas, masa and snacks — sourced for the UAE.",
  },
  colors: {
    arenaBeige: CORNERMEX_PALETTE.arenaBeige.hex,
    sunsetOrange: CORNERMEX_PALETTE.sunsetOrange.hex,
    black: CORNERMEX_PALETTE.black.hex,
  },
  assets: {
    /*
     * The kit's full-colour mark is drawn in clay red (#B4362B), which is the
     * retired palette and the strongest inherited cue, so the storefront does
     * not use it. Every warm and orange surface takes the prepared mono-black
     * mark (>= 6.5:1 on all three), and dark surfaces take the cream mark.
     */
    logos: {
      onIvory: mark("mono-black"),
      onBeige: mark("mono-black"),
      onSunset: mark("mono-black"),
      onDark: mark("cream"),
    },
    hero: {
      src: `${KIT}/master-scenes/chiles-lime-macro.jpg`,
      alt: "Dried chiles and fresh lime",
      sourceUrl: `${KIT}/master-scenes/chiles-lime-macro.jpg`,
      sourceType: "cornermex-brand-kit",
    },
    // Keyed by real canonical category slugs (public.categories), so every
    // homepage tile links to a populated category.
    collections: {
      "salsas-moles": scene("chiles-lime-corn.jpg", "Salsas and moles"),
      "snacks-sweets": scene("snacks-styled.jpg", "Mexican snacks and sweets"),
      "pantry-staples": scene("pantry-editorial.jpg", "Mexican pantry staples"),
      "chiles-spices": scene("chiles-lime-macro.jpg", "Dried chiles and spices"),
      "tortillas-masa": scene("pantry.jpg", "Tortillas and masa"),
      drinks: scene("minimal-still-life.jpg", "Mexican drinks"),
      "gifts-lifestyle": scene("shelf-assortment.jpg", "Gifts and lifestyle"),
    },
  },
};

// Category tiles render at roughly 180 CSS px, so they use 750 px derivatives of
// the master scenes (sips -Z 750). Pointing tiles at the 1920 px originals cost
// 2.3 MB on the homepage; the derivatives cost 0.76 MB for the same result.
function mark(variant: string): BrandAsset {
  const src = `${KIT}/logos/horizontal/cornermex-logo-horizontal-${variant}.svg`;
  return { src, alt: "CornerMex", sourceUrl: src, sourceType: "cornermex-brand-kit" };
}

function scene(file: string, alt: string): BrandAsset {
  const src = `${KIT}/master-scenes/tiles/${file}`;
  return { src, alt, sourceUrl: `${KIT}/master-scenes/${file}`, sourceType: "cornermex-brand-kit" };
}

/** The storefront's active brand. */
export const ACTIVE_BRAND = CORNERMEX_BRAND;

/**
 * Legacy `--brand-*` aliases. The colour values live in the token layer
 * (src/styles/brand-tokens.css); these exist only so markup that still reads a
 * `--brand-*` variable resolves to the current brand instead of a stale hex.
 */
export function brandCssVariables(brand: BrandConfig): CSSProperties {
  return {
    "--brand-surface": "var(--cm-surface)",
    "--brand-ink": "var(--cm-text)",
    "--brand-action": "var(--cm-cta-primary)",
    "--brand-display-name": `"${brand.displayName}"`,
  } as CSSProperties;
}

/** The surfaces a CornerMex mark may sit on. */
export type BrandSurface = keyof BrandConfig["assets"]["logos"];

/**
 * The mark for a surface. `onSunset` is mono-black on purpose: white on Sunset
 * Orange measures 2.89:1, black measures 6.54:1.
 */
export function brandMark(surface: BrandSurface, brand: BrandConfig = ACTIVE_BRAND): BrandAsset {
  return brand.assets.logos[surface];
}

/** The active CTA colour, for anything that must render it outside CSS. */
export const CTA_COLOR = CORNERMEX_PALETTE[CORNERMEX_LIGHT.ctaPrimary].hex;
