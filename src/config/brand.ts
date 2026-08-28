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
  sourceType: "official-live-site" | "official-brand-file" | "awaiting_official_asset";
};

export type BrandConfig = {
  id: string;
  displayName: string;
  legalName: string;
  verbal: {
    primary: string;
    secondary: string;
  };
  colors: {
    moleBrown: string;
    verdeJalapeno: string;
  };
  assets: {
    logo: BrandAsset;
    hero: BrandAsset;
    collections: Record<string, BrandAsset>;
  };
};

const INTERMEX_SOURCE = "https://intermexuae.com/";

export const INTERMEX_BRAND: BrandConfig = {
  id: "intermex-uae",
  displayName: "Intermex UAE",
  legalName: "Intermex UAE",
  verbal: {
    primary: "Del barrio pa’l mundo",
    secondary: "Tradition you can taste",
  },
  colors: {
    // Brand Book 2025 authority captured in GitHub issue #70.
    moleBrown: "#6e441d",
    verdeJalapeno: "#2d9849",
  },
  assets: {
    logo: {
      src: "/brand-kit/intermex/source-assets/intermex-logo-yellow.png",
      alt: "Intermex UAE",
      sourceUrl: `${INTERMEX_SOURCE}cdn/shop/files/YELLOW_PNG.png?v=1749546480&width=220`,
      sourceType: "official-live-site",
    },
    hero: {
      src: "/brand-kit/intermex/source-assets/intermex-hero-cactus.jpg",
      alt: "Cactus growing against a warm yellow wall",
      sourceUrl: `${INTERMEX_SOURCE}cdn/shop/files/tryagain.jpg?v=1751631403&width=3000`,
      sourceType: "official-live-site",
    },
    collections: {
      "mexican-candy": {
        src: "/brand-kit/intermex/source-assets/mexican-candy.png",
        alt: "Mexican Candy",
        sourceUrl: `${INTERMEX_SOURCE}cdn/shop/collections/Candy.png?v=1749649037&width=750`,
        sourceType: "official-live-site",
      },
      "mexican-sauces": {
        src: "/brand-kit/intermex/source-assets/mexican-sauces.png",
        alt: "Mexican Sauces",
        sourceUrl: `${INTERMEX_SOURCE}cdn/shop/collections/sauces3.png?v=1749647189&width=750`,
        sourceType: "official-live-site",
      },
      "from-our-production": {
        src: "/brand-kit/intermex/source-assets/intermex-production.png",
        alt: "Intermex Production",
        sourceUrl: `${INTERMEX_SOURCE}cdn/shop/collections/production2.png?v=1749651517&width=750`,
        sourceType: "official-live-site",
      },
      chilis: {
        src: "/brand-kit/intermex/source-assets/chilis.png",
        alt: "Chilis",
        sourceUrl: `${INTERMEX_SOURCE}cdn/shop/collections/chillis.png?v=1749728090&width=750`,
        sourceType: "official-live-site",
      },
      "mexican-pantry": {
        src: "/brand-kit/intermex/source-assets/mexican-pantry.png",
        alt: "Mexican Pantry",
        sourceUrl: `${INTERMEX_SOURCE}cdn/shop/collections/OtherFood.png?v=1751363061&width=750`,
        sourceType: "official-live-site",
      },
      drinks: {
        src: "/brand-kit/intermex/source-assets/drinks.png",
        alt: "Drinks",
        sourceUrl: `${INTERMEX_SOURCE}cdn/shop/collections/drinks.png?v=1751363139&width=750`,
        sourceType: "official-live-site",
      },
      "mexican-accessories": {
        src: "/brand-kit/intermex/source-assets/mexican-accessories.png",
        alt: "Mexican Accessories",
        sourceUrl: `${INTERMEX_SOURCE}cdn/shop/collections/Accessories.png?v=1751363265&width=750`,
        sourceType: "official-live-site",
      },
    },
  },
};

export function brandCssVariables(brand: BrandConfig): CSSProperties {
  return {
    "--brand-mole-brown": brand.colors.moleBrown,
    "--brand-verde-jalapeno": brand.colors.verdeJalapeno,
    "--brand-display-name": `"${brand.displayName}"`,
  } as CSSProperties;
}
