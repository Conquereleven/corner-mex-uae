/**
 * CornerMex brand token system — the single source of truth for colour.
 *
 * Founder brand decision (2026-09-20): CornerMex must not visually resemble
 * Intermex. The palette is Arena Beige, Sunset Orange and Black; everything
 * else in this file exists only to make that palette usable and accessible.
 *
 * Nothing in the UI is allowed to invent a colour. Components use the semantic
 * tokens below (through Tailwind utilities such as `bg-primary`, or the
 * `--cm-*` custom properties); the raw palette is referenced only here.
 *
 * `src/styles/brand-tokens.css` is GENERATED from this file by
 * `npm run brand:css`. A test fails the build if the two drift, so this module
 * stays authoritative even though CSS cannot import TypeScript.
 */

export type BrandColor = {
  /** Authoring value, as the founder specified it. */
  hex: string;
  /** Runtime value. The stylesheet is oklch-only by house rule. */
  oklch: string;
  /** Why this colour exists, so a future change is a decision and not a guess. */
  role: string;
};

/**
 * The three core brand colours, plus the supporting neutrals that usability
 * requires. Supporting neutrals carry no brand meaning on their own: they
 * exist for surfaces, spacing, borders and contrast.
 */
export const CORNERMEX_PALETTE = {
  /** Core. Warmth, surface depth, the soft premium base. */
  arenaBeige: { hex: "#D8C3A5", oklch: "oklch(0.827 0.0469 76.8)", role: "core" },
  /** Core. Energy, action, appetite — commerce accent and CTAs. */
  sunsetOrange: { hex: "#E77B30", oklch: "oklch(0.6932 0.158 51.2)", role: "core" },
  /** Core. Confidence, typography, luxury contrast, structure. */
  black: { hex: "#111111", oklch: "oklch(0.1776 0 89.9)", role: "core" },

  /** Support. The page canvas: warm enough to read as beige family, light
   *  enough to carry long-form black text at 16.95:1. */
  warmIvory: { hex: "#F7F2EB", oklch: "oklch(0.9631 0.0108 76.6)", role: "support" },
  /** Support. Raised or alternating surfaces that must still read as paper. */
  sandLight: { hex: "#E9DDCC", oklch: "oklch(0.9026 0.0263 76.8)", role: "support" },
  /** Support. Dark surfaces that are not pure black — footer, dark cards. */
  charcoal: { hex: "#2A2A2A", oklch: "oklch(0.285 0 89.9)", role: "support" },
  /** Support. Hairlines and dividers on warm surfaces. */
  softBorder: { hex: "#D7C9B8", oklch: "oklch(0.8427 0.028 72.8)", role: "support" },

  /** Support. Sunset Orange pressed one step down, for hover. Black text on it
   *  still measures 5.42:1. */
  sunsetOrangeHover: { hex: "#D96A1C", oklch: "oklch(0.6458 0.1615 49.4)", role: "state" },
  /** Support. The pressed state. Black text on it still measures 4.71:1. */
  sunsetOrangeActive: { hex: "#C66418", oklch: "oklch(0.6006 0.1512 49.6)", role: "state" },
  /** Support. The only orange dark enough to be *text* on a warm surface
   *  (5.88:1 on Warm Ivory). Sunset Orange itself is 2.59:1 and must never
   *  carry body text. */
  emberInk: { hex: "#9A4408", oklch: "oklch(0.4918 0.131 47.5)", role: "state" },

  /** Support. Secondary text on warm surfaces: 6.77:1 on Warm Ivory. */
  mutedInk: { hex: "#5C5347", oklch: "oklch(0.4473 0.0224 75.1)", role: "support" },

  /** Functional only — never structural, never decorative. See BRAND-SYSTEM.md. */
  success: { hex: "#2F6B4F", oklch: "oklch(0.4794 0.078 161.1)", role: "functional" },
  warning: { hex: "#B4700B", oklch: "oklch(0.6048 0.1302 67.6)", role: "functional" },
  error: { hex: "#B3261E", oklch: "oklch(0.5013 0.1783 28.7)", role: "functional" },
} as const satisfies Record<string, BrandColor>;

export type PaletteKey = keyof typeof CORNERMEX_PALETTE;

/** Structural colour tokens. Components address these, not the palette. */
export type BrandColorTokens = {
  primary: PaletteKey;
  primaryForeground: PaletteKey;
  secondary: PaletteKey;
  secondaryForeground: PaletteKey;
  accent: PaletteKey;
  accentForeground: PaletteKey;
  background: PaletteKey;
  surface: PaletteKey;
  surfaceRaised: PaletteKey;
  text: PaletteKey;
  textMuted: PaletteKey;
  border: PaletteKey;
  success: PaletteKey;
  warning: PaletteKey;
  error: PaletteKey;
};

/** Usage tokens. Each one names a place in the UI, not a colour. */
export type BrandSemanticTokens = {
  ctaPrimary: PaletteKey;
  ctaPrimaryHover: PaletteKey;
  ctaPrimaryActive: PaletteKey;
  ctaPrimaryText: PaletteKey;
  ctaSecondary: PaletteKey;
  ctaSecondaryText: PaletteKey;
  pageBackground: PaletteKey;
  cardBackground: PaletteKey;
  heroBackground: PaletteKey;
  navBackground: PaletteKey;
  navText: PaletteKey;
  footerBackground: PaletteKey;
  footerText: PaletteKey;
  badgeBackground: PaletteKey;
  badgeText: PaletteKey;
  /** Small uppercase label above a heading. Orange is 2.59:1 at that size, so
   *  this role exists to keep the accent readable. */
  eyebrowText: PaletteKey;
  priceColor: PaletteKey;
  saleColor: PaletteKey;
  inputBorder: PaletteKey;
  focusRing: PaletteKey;
};

/**
 * Light theme. Black on warm surfaces carries the typography; Sunset Orange is
 * reserved for action. Note `ctaPrimaryText` is black, not white: white on
 * Sunset Orange measures 2.89:1 and fails, black measures 6.54:1 and passes.
 */
export const CORNERMEX_LIGHT: BrandColorTokens & BrandSemanticTokens = {
  primary: "sunsetOrange",
  primaryForeground: "black",
  secondary: "sandLight",
  secondaryForeground: "black",
  accent: "arenaBeige",
  accentForeground: "black",
  background: "warmIvory",
  surface: "warmIvory",
  surfaceRaised: "sandLight",
  text: "black",
  textMuted: "mutedInk",
  border: "softBorder",
  success: "success",
  warning: "warning",
  error: "error",

  ctaPrimary: "sunsetOrange",
  ctaPrimaryHover: "sunsetOrangeHover",
  ctaPrimaryActive: "sunsetOrangeActive",
  ctaPrimaryText: "black",
  ctaSecondary: "arenaBeige",
  ctaSecondaryText: "black",
  pageBackground: "warmIvory",
  cardBackground: "warmIvory",
  heroBackground: "arenaBeige",
  navBackground: "warmIvory",
  navText: "black",
  footerBackground: "black",
  footerText: "warmIvory",
  badgeBackground: "arenaBeige",
  badgeText: "black",
  eyebrowText: "emberInk",
  priceColor: "black",
  saleColor: "emberInk",
  inputBorder: "softBorder",
  // Sunset Orange itself is only 2.59:1 against the page, so the ring uses the
  // pressed tone (3.60:1) and the stylesheet pairs it with a black outline so
  // it stays visible on beige surfaces too.
  focusRing: "sunsetOrangeActive",
};

/**
 * Dark theme. The canvas becomes Black, surfaces become Charcoal, and Warm
 * Ivory carries the typography. Sunset Orange keeps black text, so a CTA looks
 * and behaves the same in both themes.
 */
export const CORNERMEX_DARK: BrandColorTokens & BrandSemanticTokens = {
  primary: "sunsetOrange",
  primaryForeground: "black",
  secondary: "charcoal",
  secondaryForeground: "warmIvory",
  accent: "charcoal",
  accentForeground: "arenaBeige",
  background: "black",
  surface: "charcoal",
  surfaceRaised: "charcoal",
  text: "warmIvory",
  textMuted: "arenaBeige",
  border: "charcoal",
  success: "success",
  warning: "warning",
  error: "error",

  ctaPrimary: "sunsetOrange",
  ctaPrimaryHover: "sunsetOrangeHover",
  ctaPrimaryActive: "sunsetOrangeActive",
  ctaPrimaryText: "black",
  ctaSecondary: "charcoal",
  ctaSecondaryText: "arenaBeige",
  pageBackground: "black",
  cardBackground: "charcoal",
  heroBackground: "charcoal",
  navBackground: "black",
  navText: "warmIvory",
  footerBackground: "black",
  footerText: "warmIvory",
  badgeBackground: "charcoal",
  badgeText: "arenaBeige",
  eyebrowText: "arenaBeige",
  priceColor: "warmIvory",
  saleColor: "sunsetOrange",
  inputBorder: "charcoal",
  focusRing: "sunsetOrange",
};

export const BRAND_THEMES = { light: CORNERMEX_LIGHT, dark: CORNERMEX_DARK } as const;

/** Resolve a token to its runtime colour value. */
export function tokenValue(
  theme: keyof typeof BRAND_THEMES,
  token: keyof BrandSemanticTokens | keyof BrandColorTokens,
) {
  return CORNERMEX_PALETTE[BRAND_THEMES[theme][token]];
}

/** WCAG relative luminance, on the sRGB hex values above. */
function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two palette entries, for the accessibility guard. */
export function contrastRatio(a: string, b: string) {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/**
 * Pairs the accessibility test enforces. Each one is a real place in the UI
 * where a text colour meets a background; 4.5 is AA for body text, 3.0 is AA
 * for large display text and for non-text boundaries.
 */
export const CONTRAST_CONTRACT: ReadonlyArray<{
  what: string;
  foreground: PaletteKey;
  background: PaletteKey;
  minimum: number;
}> = [
  { what: "body text on the page", foreground: "black", background: "warmIvory", minimum: 4.5 },
  {
    what: "body text on a sand surface",
    foreground: "black",
    background: "sandLight",
    minimum: 4.5,
  },
  { what: "text on a beige hero", foreground: "black", background: "arenaBeige", minimum: 4.5 },
  { what: "primary CTA label", foreground: "black", background: "sunsetOrange", minimum: 4.5 },
  {
    what: "primary CTA label, hovered",
    foreground: "black",
    background: "sunsetOrangeHover",
    minimum: 4.5,
  },
  {
    what: "primary CTA label, pressed",
    foreground: "black",
    background: "sunsetOrangeActive",
    minimum: 4.5,
  },
  {
    what: "secondary text on the page",
    foreground: "mutedInk",
    background: "warmIvory",
    minimum: 4.5,
  },
  { what: "sale price on the page", foreground: "emberInk", background: "warmIvory", minimum: 4.5 },
  {
    what: "eyebrow label on the page",
    foreground: "emberInk",
    background: "warmIvory",
    minimum: 4.5,
  },
  {
    what: "eyebrow label on the footer",
    foreground: "arenaBeige",
    background: "black",
    minimum: 4.5,
  },
  { what: "footer text", foreground: "warmIvory", background: "black", minimum: 4.5 },
  { what: "dark-theme body text", foreground: "warmIvory", background: "charcoal", minimum: 4.5 },
  {
    what: "dark-theme secondary text",
    foreground: "arenaBeige",
    background: "charcoal",
    minimum: 4.5,
  },
  {
    what: "focus ring against the page",
    foreground: "sunsetOrange",
    background: "warmIvory",
    minimum: 2.5,
  },
];
