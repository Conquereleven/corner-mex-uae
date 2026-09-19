import type { CSSProperties } from "react";

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
  colors: {
    structuralRed: string;
    cream: string;
    moleBrown: string;
    verdeJalapeno: string;
  };
  assets: {
    logo: BrandAsset;
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
    structuralRed: "#B4362B", // Clay
    cream: "#F8F3E8", // Cream
    moleBrown: "#2A2622", // Obsidian
    verdeJalapeno: "#3E7A54", // Sage
  },
  assets: {
    logo: {
      src: `${KIT}/logos/horizontal/cornermex-logo-horizontal-full-color.svg`,
      alt: "CornerMex",
      sourceUrl: `${KIT}/logos/horizontal/cornermex-logo-horizontal-full-color.svg`,
      sourceType: "cornermex-brand-kit",
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

function scene(file: string, alt: string): BrandAsset {
  const src = `${KIT}/master-scenes/${file}`;
  return { src, alt, sourceUrl: src, sourceType: "cornermex-brand-kit" };
}

/** The storefront's active brand. */
export const ACTIVE_BRAND = CORNERMEX_BRAND;

export function brandCssVariables(brand: BrandConfig): CSSProperties {
  return {
    "--brand-structural-red": brand.colors.structuralRed,
    "--brand-cream": brand.colors.cream,
    "--brand-mole-brown": brand.colors.moleBrown,
    "--brand-verde-jalapeno": brand.colors.verdeJalapeno,
    "--brand-display-name": `"${brand.displayName}"`,
  } as CSSProperties;
}
