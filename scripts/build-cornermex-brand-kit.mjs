#!/usr/bin/env node
// CornerMex Marketing Kit v1 builder.
// Generates all logos, templates, docs and a final ZIP under public/brand-kit/.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const KIT = path.join(ROOT, "public", "brand-kit");
const SCENES_SRC = "/tmp/scenes";

const CLAY = "#B4362B";
const SAGE = "#3E7A54";
const CREAM = "#F8F3E8";
const SAND = "#EFE6D2";
const OBSIDIAN = "#2A2622";
const MUTED = "#8A7E6E";

const DISPLAY = "'Cormorant Garamond', 'Cormorant', ui-serif, Georgia, serif";
const SANS = "'Inter', ui-sans-serif, system-ui, sans-serif";

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function write(p, content) { ensureDir(path.dirname(p)); fs.writeFileSync(p, content); }
function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}
function aspectRatio(w, h) {
  const g = (a, b) => (b ? g(b, a % b) : a);
  const d = g(w, h);
  return `${w / d}:${h / d}`;
}

const manifest = [];
function record(entry) { manifest.push(entry); }

// ---------- LOGOS ----------
function wordmarkSVG({ corner, mex, uae, bg = "none", showUAE = true }) {
  const width = 800, height = showUAE ? 260 : 200;
  const bgRect = bg === "none" ? "" : `<rect width="100%" height="100%" fill="${bg}"/>`;
  const uaeLine = showUAE
    ? `<text x="50%" y="215" text-anchor="middle" font-family="${SANS}" font-size="26" letter-spacing="8" fill="${uae}" font-weight="500">UAE &#183; MEXICAN GROCERY</text>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="CornerMex">
  ${bgRect}
  <text x="50%" y="140" text-anchor="middle" font-family="${DISPLAY}" font-weight="500" font-size="140" fill="${corner}" letter-spacing="-2">Corner<tspan fill="${mex}">Mex</tspan></text>
  ${uaeLine}
</svg>`;
}

function stackedSVG({ corner, mex, uae }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="CornerMex stacked">
  <text x="50%" y="250" text-anchor="middle" font-family="${DISPLAY}" font-weight="500" font-size="140" fill="${corner}">Corner</text>
  <text x="50%" y="380" text-anchor="middle" font-family="${DISPLAY}" font-weight="500" font-size="140" fill="${mex}">Mex</text>
  <line x1="200" y1="430" x2="400" y2="430" stroke="${uae}" stroke-width="1.5"/>
  <text x="50%" y="480" text-anchor="middle" font-family="${SANS}" font-size="26" letter-spacing="10" fill="${uae}" font-weight="500">UAE</text>
</svg>`;
}

function monogramSVG({ fg, bg = "none" }) {
  const bgEl = bg === "none" ? "" : `<rect width="100%" height="100%" fill="${bg}" rx="80"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="CM monogram">
  ${bgEl}
  <text x="50%" y="345" text-anchor="middle" font-family="${DISPLAY}" font-weight="500" font-size="340" fill="${fg}" letter-spacing="-14">CM</text>
</svg>`;
}

function avatarSVG({ fg, bgColor }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" role="img" aria-label="CornerMex avatar">
  <rect width="1080" height="1080" fill="${bgColor}"/>
  <text x="50%" y="640" text-anchor="middle" font-family="${DISPLAY}" font-weight="500" font-size="620" fill="${fg}" letter-spacing="-24">CM</text>
  <text x="50%" y="900" text-anchor="middle" font-family="${SANS}" font-size="52" letter-spacing="20" fill="${fg}" opacity="0.85" font-weight="500">CORNERMEX</text>
</svg>`;
}

function buildLogos() {
  const variants = [
    ["full-color", { corner: OBSIDIAN, mex: CLAY, uae: MUTED }],
    ["clay",       { corner: CLAY,     mex: CLAY, uae: CLAY  }],
    ["charcoal",   { corner: OBSIDIAN, mex: OBSIDIAN, uae: OBSIDIAN }],
    ["cream",      { corner: CREAM,    mex: CREAM, uae: CREAM }],
    ["reversed",   { corner: CREAM,    mex: CLAY,  uae: CREAM }],
    ["mono-black", { corner: "#000000", mex: "#000000", uae: "#000000" }],
    ["mono-white", { corner: "#FFFFFF", mex: "#FFFFFF", uae: "#FFFFFF" }],
  ];

  for (const [name, c] of variants) {
    const hUae = path.join(KIT, "logos/horizontal", `cornermex-logo-horizontal-uae-${name}.svg`);
    write(hUae, wordmarkSVG({ ...c, showUAE: true }));
    record({ name: `Horizontal UAE ${name}`, filename: path.basename(hUae), folder: "logos/horizontal", dimensions: "800x260", aspect_ratio: "40:13", format: "svg", category: "logo", use: "Primary brand mark with UAE descriptor", variation: name });

    const h = path.join(KIT, "logos/horizontal", `cornermex-logo-horizontal-${name}.svg`);
    write(h, wordmarkSVG({ ...c, showUAE: false }));
    record({ name: `Horizontal ${name}`, filename: path.basename(h), folder: "logos/horizontal", dimensions: "800x200", aspect_ratio: "4:1", format: "svg", category: "logo", use: "Wordmark without UAE descriptor", variation: name });

    const s = path.join(KIT, "logos/stacked", `cornermex-logo-stacked-${name}.svg`);
    write(s, stackedSVG(c));
    record({ name: `Stacked ${name}`, filename: path.basename(s), folder: "logos/stacked", dimensions: "600x600", aspect_ratio: "1:1", format: "svg", category: "logo", use: "Stacked mark for square placements", variation: name });

    const m = path.join(KIT, "logos/monogram", `cornermex-monogram-${name}.svg`);
    write(m, monogramSVG({ fg: c.mex }));
    record({ name: `Monogram ${name}`, filename: path.basename(m), folder: "logos/monogram", dimensions: "512x512", aspect_ratio: "1:1", format: "svg", category: "logo", use: "Compact CM monogram", variation: name });

    if (name === "mono-black" || name === "mono-white") {
      const mc = path.join(KIT, "logos/monochrome", `cornermex-print-${name}.svg`);
      write(mc, wordmarkSVG({ ...c, showUAE: true }));
      record({ name: `Print ${name}`, filename: path.basename(mc), folder: "logos/monochrome", dimensions: "800x260", aspect_ratio: "40:13", format: "svg", category: "logo", use: "Single-color print", variation: name });
    }
  }

  for (const [name, color] of [["clay", CLAY], ["sage", SAGE], ["cream", CREAM], ["charcoal", OBSIDIAN]]) {
    const fg = name === "cream" ? OBSIDIAN : CREAM;
    const a = path.join(KIT, "logos/social-avatar", `cornermex-social-avatar-${name}.svg`);
    write(a, avatarSVG({ fg, bgColor: color }));
    record({ name: `Social avatar ${name}`, filename: path.basename(a), folder: "logos/social-avatar", dimensions: "1080x1080", aspect_ratio: "1:1", format: "svg", category: "logo", use: "Profile picture", variation: name });
  }

  const fav = path.join(KIT, "icons/favicon", "favicon.svg");
  write(fav, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${CLAY}"/>
  <text x="50%" y="46" text-anchor="middle" font-family="${DISPLAY}" font-size="42" font-weight="600" fill="${CREAM}" letter-spacing="-2">CM</text>
</svg>`);
  record({ name: "Favicon SVG", filename: "favicon.svg", folder: "icons/favicon", dimensions: "vector", aspect_ratio: "1:1", format: "svg", category: "icon", use: "Browser favicon" });

  for (const size of [16, 32, 48, 180, 192, 512]) {
    const p = path.join(KIT, "icons/app-icons", `cornermex-app-icon-${size}.svg`);
    write(p, `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${CLAY}"/>
  <text x="50%" y="345" text-anchor="middle" font-family="${DISPLAY}" font-weight="600" font-size="340" fill="${CREAM}" letter-spacing="-14">CM</text>
</svg>`);
    record({ name: `App icon ${size}`, filename: path.basename(p), folder: "icons/app-icons", dimensions: `${size}x${size}`, aspect_ratio: "1:1", format: "svg", category: "icon", use: `App/OS icon at ${size}px` });
  }
}

// ---------- TEMPLATE ENGINE ----------
function template({ file, w, h, scene = null, bg = CREAM, overlay = "rgba(42,38,34,0.4)", eyebrow = "", headline = "", body = "", cta = "", logo = "cream", textColor = CREAM, accent = CLAY, align = "left", category, campaign, folder }) {
  const pad = Math.round(Math.min(w, h) * 0.06);
  const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
  const tx = align === "center" ? w / 2 : align === "right" ? w - pad : pad;
  const s = Math.min(w, h);
  const fsEyebrow = Math.max(10, Math.round(s * 0.028));
  const fsHead = Math.max(18, Math.round(s * 0.1));
  const fsBody = Math.max(10, Math.round(s * 0.03));
  const fsCta = Math.max(11, Math.round(s * 0.032));

  const sceneEl = scene
    ? `<image href="../master-scenes/${scene}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
       <rect x="0" y="0" width="${w}" height="${h}" fill="${overlay}"/>`
    : `<rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>
       <circle cx="${w * 0.92}" cy="${h * 0.15}" r="${s * 0.25}" fill="${accent}" opacity="0.12"/>
       <circle cx="${w * 0.08}" cy="${h * 0.85}" r="${s * 0.2}" fill="${SAGE}" opacity="0.1"/>`;

  const headLines = String(headline).split("\n");
  const headBlock = headLines.map((line, i) =>
    `<text x="${tx}" y="${pad + fsEyebrow + 24 + fsHead * (i + 1)}" text-anchor="${anchor}" font-family="${DISPLAY}" font-size="${fsHead}" font-weight="500" fill="${textColor}" letter-spacing="-2">${escapeXml(line)}</text>`
  ).join("\n");

  const eyebrowEl = eyebrow
    ? `<text x="${tx}" y="${pad + fsEyebrow}" text-anchor="${anchor}" font-family="${SANS}" font-size="${fsEyebrow}" letter-spacing="6" fill="${accent}" font-weight="600">${escapeXml(String(eyebrow).toUpperCase())}</text>`
    : "";

  const bodyY = pad + fsEyebrow + 24 + fsHead * headLines.length + fsBody + 24;
  const bodyEl = body
    ? `<text x="${tx}" y="${bodyY}" text-anchor="${anchor}" font-family="${SANS}" font-size="${fsBody}" fill="${textColor}" opacity="0.92">${escapeXml(body)}</text>`
    : "";

  let ctaEl = "";
  if (cta) {
    const ctaW = Math.round(cta.length * fsCta * 0.62 + fsCta * 2.2);
    const ctaH = Math.round(fsCta * 2.4);
    const cx = align === "center" ? (w - ctaW) / 2 : align === "right" ? w - pad - ctaW : pad;
    const cy = h - pad - ctaH;
    ctaEl = `<rect x="${cx}" y="${cy}" width="${ctaW}" height="${ctaH}" rx="${ctaH / 2}" fill="${accent}"/>
      <text x="${cx + ctaW / 2}" y="${cy + ctaH * 0.66}" text-anchor="middle" font-family="${SANS}" font-size="${fsCta}" font-weight="600" fill="${CREAM}" letter-spacing="2">${escapeXml(String(cta).toUpperCase())}</text>`;
  }

  const logoW = Math.min(w * 0.35, Math.round(s * 0.22));
  const logoH = Math.round(logoW * 0.325);
  const logoX = align === "right" ? pad : w - pad - logoW;
  const logoY = pad;
  const logoEl = `<image href="../logos/horizontal/cornermex-logo-horizontal-${logo}.svg" x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  ${sceneEl}
  ${logoEl}
  ${eyebrowEl}
  ${headBlock}
  ${bodyEl}
  ${ctaEl}
</svg>`;

  write(path.join(KIT, folder, file), svg);
  record({
    name: file.replace(/\.svg$/, ""),
    filename: file,
    folder,
    dimensions: `${w}x${h}`,
    aspect_ratio: aspectRatio(w, h),
    format: "svg",
    category,
    campaign,
    scene: scene || null,
    editable_fields: ["eyebrow", "headline", "body", "cta"],
    logo_variation: logo,
    background: scene ? "scene+overlay" : bg,
  });
}

const CAMPAIGNS = {
  "brand-introduction":   { eyebrow: "CornerMex UAE",           headline: "Mexico,\ncloser than ever.", body: "Authentic Mexican groceries, delivered across the UAE.", cta: "Discover CornerMex", scene: "chiles-lime-corn.jpg", logo: "cream" },
  "uae-delivery":         { eyebrow: "Delivery across the UAE", headline: "Mexican favourites,\ndelivered.", body: "Fresh from Mexico to your door.", cta: "Shop now", scene: "uae-delivery.jpg", logo: "cream" },
  "b2b-wholesale":        { eyebrow: "B2B wholesale",           headline: "Authentic Mexican\nsupply for pros.", body: "For restaurants, retailers and hotels across the UAE.", cta: "Request a quote", scene: "restaurant-b2b.jpg", logo: "cream" },
  "pantry-essentials":    { eyebrow: "Mexican pantry",          headline: "Real flavour,\nreal ingredients.", body: "Chiles, tortillas, salsas, beans and more.", cta: "Shop the pantry", scene: "pantry.jpg", logo: "cream" },
  "snacks-sweets":        { eyebrow: "Snacks and sweets",       headline: "Your Mexican\nfavourites are here.", body: "Tamarind candies, chili peanuts, dulce de leche.", cta: "Explore snacks", scene: "pantry.jpg", logo: "cream" },
  "restaurant-restock":   { eyebrow: "For professional kitchens", headline: "Restock your\nMexican kitchen.", body: "Reliable supply, quality you can plate.", cta: "Order wholesale", scene: "restaurant-b2b.jpg", logo: "cream" },
  "new-arrivals":         { eyebrow: "Just in",                 headline: "Fresh arrivals\nfrom Mexico.", body: "New shelves, new flavours.", cta: "View new arrivals", scene: "pantry.jpg", logo: "cream" },
  "weekend-promotion":    { eyebrow: "This weekend",            headline: "A little more Mexico\nthis weekend.", body: "Curated picks for your table.", cta: "Shop weekend picks", scene: "chiles-lime-corn.jpg", logo: "cream" },
  "b2b-lead-gen":         { eyebrow: "B2B lead",                headline: "Looking for a reliable\nMexican supplier?", body: "Wholesale supply for restaurants and retailers across the UAE.", cta: "Request a quote", scene: "restaurant-b2b.jpg", logo: "cream" },
  "ramadan-eid":          { eyebrow: "Season of gathering",     headline: "Flavour worth\nsharing.", body: "Thoughtful pantry picks for evenings together.", cta: "Shop the collection", scene: null, bg: "#1F1A15", textColor: CREAM, overlay: "rgba(0,0,0,0.15)", logo: "cream" },
  "uae-national-day":     { eyebrow: "UAE National Day",        headline: "Proudly delivering\nMexico across the UAE.", body: "A quiet salute from our shelves to yours.", cta: "Shop the collection", scene: null, bg: CREAM, textColor: OBSIDIAN, overlay: "rgba(255,255,255,0)", logo: "full-color" },
  "mexican-independence": { eyebrow: "Mexican season",          headline: "Real Mexico,\nrefined.", body: "Ingredients, snacks and sweets from home.", cta: "Shop the collection", scene: "chiles-lime-corn.jpg", logo: "cream" },
};

function buildTemplates() {
  const plan = [
    { folder: "social-media/instagram", w: 1080, h: 1080, sizeLabel: "square", campaigns: ["brand-introduction", "uae-delivery", "pantry-essentials", "new-arrivals"] },
    { folder: "social-media/instagram", w: 1080, h: 1350, sizeLabel: "portrait", campaigns: ["pantry-essentials", "snacks-sweets", "weekend-promotion"] },
    { folder: "social-media/instagram", w: 1080, h: 1920, sizeLabel: "story", campaigns: ["brand-introduction", "uae-delivery", "new-arrivals"] },
    { folder: "social-media/instagram", w: 1080, h: 1920, sizeLabel: "reel-cover", campaigns: ["pantry-essentials", "restaurant-restock"] },
    { folder: "social-media/facebook", w: 1080, h: 1080, sizeLabel: "square", campaigns: ["brand-introduction", "uae-delivery", "weekend-promotion"] },
    { folder: "social-media/linkedin", w: 1200, h: 627, sizeLabel: "post", campaigns: ["b2b-wholesale", "b2b-lead-gen"] },
    { folder: "social-media/linkedin", w: 1128, h: 191, sizeLabel: "banner", campaigns: ["b2b-wholesale"] },
    { folder: "social-media/linkedin", w: 1200, h: 627, sizeLabel: "b2b-lead", campaigns: ["b2b-lead-gen"] },
    { folder: "social-media/x", w: 1500, h: 500, sizeLabel: "header", campaigns: ["brand-introduction"] },
    { folder: "social-media/x", w: 1600, h: 900, sizeLabel: "post", campaigns: ["uae-delivery", "b2b-wholesale"] },
    { folder: "social-media/whatsapp", w: 1080, h: 1080, sizeLabel: "catalog-cover", campaigns: ["brand-introduction"] },
    { folder: "social-media/whatsapp", w: 1080, h: 1080, sizeLabel: "promo", campaigns: ["weekend-promotion"] },
    { folder: "social-media/whatsapp", w: 1080, h: 1080, sizeLabel: "b2b-contact", campaigns: ["b2b-lead-gen"] },
    { folder: "website", w: 1920, h: 900, sizeLabel: "homepage-hero-desktop", campaigns: ["brand-introduction", "uae-delivery"] },
    { folder: "website", w: 1080, h: 1350, sizeLabel: "homepage-hero-mobile", campaigns: ["brand-introduction"] },
    { folder: "website", w: 1600, h: 600, sizeLabel: "collection-banner", campaigns: ["pantry-essentials", "snacks-sweets"] },
    { folder: "website", w: 1600, h: 400, sizeLabel: "promo-banner", campaigns: ["weekend-promotion"] },
    { folder: "website", w: 1200, h: 630, sizeLabel: "og-image", campaigns: ["brand-introduction"] },
    { folder: "website", w: 1200, h: 400, sizeLabel: "newsletter-header", campaigns: ["new-arrivals"] },
    { folder: "website", w: 1600, h: 1000, sizeLabel: "category-placeholder", campaigns: ["pantry-essentials"] },
    { folder: "website", w: 1200, h: 1200, sizeLabel: "product-placeholder", campaigns: ["pantry-essentials"] },
    { folder: "website", w: 1600, h: 600, sizeLabel: "new-arrivals", campaigns: ["new-arrivals"] },
    { folder: "website", w: 1600, h: 600, sizeLabel: "b2b-homepage", campaigns: ["b2b-wholesale"] },
    { folder: "website", w: 1600, h: 600, sizeLabel: "delivery-promo", campaigns: ["uae-delivery"] },
    { folder: "website", w: 1600, h: 600, sizeLabel: "wholesale-collection", campaigns: ["b2b-wholesale"] },
    { folder: "ecommerce", w: 1600, h: 600, sizeLabel: "collection-hero", campaigns: ["pantry-essentials", "snacks-sweets"] },
    { folder: "ecommerce", w: 1200, h: 1200, sizeLabel: "product-tile", campaigns: ["pantry-essentials"] },
    { folder: "b2b", w: 1200, h: 627, sizeLabel: "linkedin-hero", campaigns: ["b2b-wholesale"] },
    { folder: "b2b", w: 1600, h: 600, sizeLabel: "restaurant-supply", campaigns: ["restaurant-restock"] },
    { folder: "b2b", w: 1600, h: 600, sizeLabel: "retailer-distributor", campaigns: ["b2b-wholesale"] },
    { folder: "b2b", w: 1600, h: 600, sizeLabel: "hotel-hospitality", campaigns: ["b2b-wholesale"] },
    { folder: "b2b", w: 1200, h: 300, sizeLabel: "email-signature", campaigns: ["b2b-lead-gen"] },
    { folder: "b2b", w: 1920, h: 1080, sizeLabel: "proposal-cover", campaigns: ["b2b-wholesale"] },
    { folder: "b2b", w: 1920, h: 1080, sizeLabel: "presentation-cover", campaigns: ["b2b-wholesale"] },
    { folder: "b2b", w: 1240, h: 1754, sizeLabel: "a4-sales-sheet", campaigns: ["b2b-wholesale"] },
    { folder: "b2b", w: 1240, h: 1754, sizeLabel: "a4-price-list", campaigns: ["b2b-wholesale"] },
    { folder: "b2b", w: 1240, h: 1754, sizeLabel: "a4-catalog-cover", campaigns: ["pantry-essentials"] },
    { folder: "b2b", w: 1500, h: 1000, sizeLabel: "trade-show-backdrop", campaigns: ["brand-introduction"] },
    { folder: "b2b", w: 1240, h: 1754, sizeLabel: "quotation-cover", campaigns: ["b2b-wholesale"] },
    { folder: "b2b", w: 1240, h: 1754, sizeLabel: "distributor-intro", campaigns: ["b2b-wholesale"] },
    { folder: "paid-ads/meta", w: 1080, h: 1080, sizeLabel: "feed-square", campaigns: ["uae-delivery", "new-arrivals", "weekend-promotion"] },
    { folder: "paid-ads/meta", w: 1080, h: 1350, sizeLabel: "feed-portrait", campaigns: ["pantry-essentials", "snacks-sweets"] },
    { folder: "paid-ads/meta", w: 1080, h: 1920, sizeLabel: "story-ad", campaigns: ["uae-delivery", "weekend-promotion"] },
    { folder: "paid-ads/google-display", w: 1200, h: 628, sizeLabel: "landscape", campaigns: ["uae-delivery"] },
    { folder: "paid-ads/google-display", w: 1080, h: 1080, sizeLabel: "square", campaigns: ["uae-delivery"] },
    { folder: "paid-ads/google-display", w: 300, h: 250, sizeLabel: "medium-rect", campaigns: ["uae-delivery"] },
    { folder: "paid-ads/google-display", w: 336, h: 280, sizeLabel: "large-rect", campaigns: ["uae-delivery"] },
    { folder: "paid-ads/google-display", w: 728, h: 90, sizeLabel: "leaderboard", campaigns: ["uae-delivery"] },
    { folder: "paid-ads/google-display", w: 970, h: 250, sizeLabel: "billboard", campaigns: ["uae-delivery"] },
    { folder: "marketplaces", w: 1464, h: 600, sizeLabel: "storefront-hero", campaigns: ["brand-introduction"] },
    { folder: "marketplaces", w: 1000, h: 1000, sizeLabel: "promo-tile", campaigns: ["weekend-promotion"] },
    { folder: "marketplaces", w: 1000, h: 1000, sizeLabel: "collection-tile", campaigns: ["pantry-essentials"] },
    { folder: "marketplaces", w: 1464, h: 600, sizeLabel: "delivery-banner", campaigns: ["uae-delivery"] },
    { folder: "marketplaces", w: 1464, h: 600, sizeLabel: "wholesale-banner", campaigns: ["b2b-wholesale"] },
    { folder: "marketplaces", w: 1464, h: 600, sizeLabel: "new-arrivals-banner", campaigns: ["new-arrivals"] },
    { folder: "email", w: 1200, h: 400, sizeLabel: "header-brand", campaigns: ["brand-introduction"] },
    { folder: "email", w: 1200, h: 400, sizeLabel: "header-new-arrivals", campaigns: ["new-arrivals"] },
    { folder: "email", w: 1200, h: 400, sizeLabel: "header-b2b", campaigns: ["b2b-wholesale"] },
    { folder: "email", w: 1200, h: 300, sizeLabel: "signature-banner", campaigns: ["b2b-lead-gen"] },
    { folder: "seasonal", w: 1080, h: 1080, sizeLabel: "ramadan-eid-square", campaigns: ["ramadan-eid"] },
    { folder: "seasonal", w: 1080, h: 1920, sizeLabel: "ramadan-eid-story", campaigns: ["ramadan-eid"] },
    { folder: "seasonal", w: 1080, h: 1080, sizeLabel: "uae-national-day-square", campaigns: ["uae-national-day"] },
    { folder: "seasonal", w: 1080, h: 1080, sizeLabel: "mexican-independence-square", campaigns: ["mexican-independence"] },
  ];

  for (const p of plan) {
    for (const campKey of p.campaigns) {
      const camp = CAMPAIGNS[campKey];
      const file = `cornermex-${p.folder.split("/").pop()}-${p.sizeLabel}-${campKey}.svg`;
      const isTiny = Math.min(p.w, p.h) < 260;
      template({
        file, w: p.w, h: p.h,
        scene: camp.scene,
        bg: camp.bg || CREAM,
        overlay: camp.overlay || "rgba(42,38,34,0.42)",
        eyebrow: isTiny ? "" : camp.eyebrow,
        headline: isTiny ? camp.headline.split("\n")[0] : camp.headline,
        body: isTiny ? "" : camp.body,
        cta: camp.cta,
        logo: camp.logo || "cream",
        textColor: camp.textColor || CREAM,
        accent: CLAY,
        align: "left",
        category: p.folder.split("/")[0],
        campaign: campKey,
        folder: p.folder,
      });
    }
  }
}

function copyScenes() {
  const scenes = [
    ["pantry.jpg", "Premium Mexican pantry ingredients flatlay"],
    ["chiles-lime-corn.jpg", "Hot sauces, dried chiles, lime and corn"],
    ["restaurant-b2b.jpg", "Restaurant kitchen and B2B wholesale supply"],
    ["uae-delivery.jpg", "Grocery delivery in a modern UAE urban setting"],
  ];
  for (const [file, desc] of scenes) {
    const src = path.join(SCENES_SRC, file);
    const dst = path.join(KIT, "master-scenes", file);
    if (fs.existsSync(src)) {
      ensureDir(path.dirname(dst));
      fs.copyFileSync(src, dst);
      record({ name: desc, filename: file, folder: "master-scenes", dimensions: "1920x1280", aspect_ratio: "3:2", format: "jpg", category: "master-scene", use: "Reusable master photo for templates" });
    }
  }
  const texturePath = path.join(KIT, "master-scenes", "brand-texture.svg");
  const tex = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1280">
  <rect width="1920" height="1280" fill="${CREAM}"/>
  <circle cx="1500" cy="240" r="360" fill="${CLAY}" opacity="0.12"/>
  <circle cx="220" cy="1100" r="280" fill="${SAGE}" opacity="0.15"/>
</svg>`;
  write(texturePath, tex);
  record({ name: "Brand color texture", filename: "brand-texture.svg", folder: "master-scenes", dimensions: "1920x1280", aspect_ratio: "3:2", format: "svg", category: "master-scene", use: "Neutral cream/clay/sage brand backdrop" });
}

function buildCopyPresets() {
  const presets = {
    version: 1,
    headlines: [
      "Mexico, delivered.",
      "Authentic Mexican groceries across the UAE.",
      "Stock your kitchen with the real thing.",
      "Wholesale supply for restaurants and retailers.",
      "From Mexican shelves to UAE doors.",
      "Real Mexican flavour, closer to home.",
      "Mexican essentials for every kitchen.",
      "Your next favourite flavour is here.",
      "Authentic products for professional kitchens.",
      "Mexican flavours for restaurants, retailers, and homes.",
    ],
    ctas: ["Shop now", "Explore products", "View new arrivals", "Order wholesale", "Request a quote", "Browse the collection", "Restock now", "Contact our B2B team", "Discover CornerMex", "View wholesale options"],
    campaigns: CAMPAIGNS,
  };
  write(path.join(KIT, "templates", "copy-presets.json"), JSON.stringify(presets, null, 2));
  record({ name: "Editable copy presets", filename: "copy-presets.json", folder: "templates", dimensions: "-", aspect_ratio: "-", format: "json", category: "template", use: "Editable headlines, CTAs and campaign copy blocks" });

  const def = {
    version: 1,
    description: "Template definition schema for CornerMex marketing SVGs.",
    fields: { w: "width px", h: "height px", scene: "master-scenes filename or null", bg: "hex bg", overlay: "rgba tint", eyebrow: "kicker", headline: "serif headline (\\n for line breaks)", body: "body line", cta: "CTA label", logo: "logo variant slug", textColor: "hex", accent: "hex", align: "left|center|right" },
    example: { w: 1080, h: 1080, scene: "pantry.jpg", eyebrow: "Mexican pantry", headline: "Real flavour,\nreal ingredients.", body: "Chiles, tortillas, salsas, beans and more.", cta: "Shop the pantry", logo: "cream", textColor: CREAM, accent: CLAY, align: "left" },
  };
  write(path.join(KIT, "templates", "template-schema.json"), JSON.stringify(def, null, 2));
  record({ name: "Template schema", filename: "template-schema.json", folder: "templates", dimensions: "-", aspect_ratio: "-", format: "json", category: "template", use: "Template definition schema" });
}

function buildDocs() {
  const guide = `# CornerMex Brand Guide — v1

## Positioning
**CornerMex** — Mexico delivered to the UAE. Authentic Mexican groceries and wholesale supply for homes, restaurants, retailers and hotels.

Feel: authentic, warm, modern, premium but accessible, international, reliable, commercially credible.

## Logo
- **Primary horizontal + UAE descriptor** — default for websites, headers, print covers.
- **Horizontal without UAE** — compact contexts.
- **Stacked** — square placements.
- **Monogram (CM)** — favicons, avatars, small placements.

### Clear space
Reserve at least the height of the letter **M** around the logo.

### Minimum size
Horizontal: 120px screen / 20mm print. Monogram: 32px screen / 10mm print.

### Do
- Full-color on cream, sand or white.
- Cream / reversed variants on clay, sage, charcoal or master scenes.
- Monochrome for single-color print.

### Don't
- Recolor "Mex" outside the palette.
- Stretch, skew or rotate.
- Full-color on busy photography without overlay.
- Drop shadows, outlines or gradients on the wordmark.

## Colors
| Token | Role | Hex |
|---|---|---|
| Clay | Primary accent, CTAs | \`${CLAY}\` |
| Sage | Secondary accent | \`${SAGE}\` |
| Cream | Canvas | \`${CREAM}\` |
| Sand | Secondary surface | \`${SAND}\` |
| Obsidian | Ink / text | \`${OBSIDIAN}\` |
| Muted | Secondary text | \`${MUTED}\` |

Mirrors app tokens in \`src/styles.css\`.

## Typography
- **Display**: Cormorant Garamond (500–600).
- **Sans**: Inter (400–600).
- Eyebrows: uppercase, tracked 6–10, Inter 600.
- CTAs: uppercase pill, tracked 2, Inter 600.

## Photography
Warm natural light, editorial styling, generous negative space, subtle clay-red and sage-green accents. Ingredients: chiles, lime, corn, tortillas, salsa, beans, cacao, agave, sweets, pantry staples, restaurant kitchens, wholesale supply, modern UAE urban environments.

Avoid: sombreros, moustaches, maracas, cactus cartoons, hacienda scenes, papel picado, generic fiesta graphics, flag collages, neon graphics, clip art.

## Motifs
- Soft circular color washes at low opacity.
- Fine baseline grids.
- Obsidian overlay tints (~35–45%) over photography for legibility.

## Copy tone
Confident, warm, understated. English primary. Selective Spanish for cultural anchors. No unverified Arabic. No exaggerated claims.

## Safe areas
- Stories: keep essential copy inside a 10% margin; top 15% / bottom 20% may be covered by UI.
- Marketplace banners: expect 20% side crop.

## Export
Digital: SVG source, PNG/WebP for platforms that reject SVG. Print: SVG → PDF/X via a print prep step.

## RTL
Layouts leave vertical space for later RTL Arabic swap. Native review required.
`;
  write(path.join(KIT, "guide", "brand-guide.md"), guide);

  const readme = `# CornerMex Marketing Kit — v1

Standalone brand + marketing package. Not imported by the CornerMex app.

## Included
- \`logos/\` — horizontal, stacked, monogram, social-avatar, monochrome (SVG).
- \`icons/\` — favicon + app icons 16→512 (SVG).
- \`master-scenes/\` — 4 editorial photos + 1 SVG brand texture.
- \`social-media/\` — Instagram, Facebook, LinkedIn, WhatsApp, X.
- \`website/\`, \`ecommerce/\` — hero, collection, promo, OG, placeholders.
- \`b2b/\` — LinkedIn hero, restaurant/retailer/hotel banners, A4 covers, proposal/presentation, trade-show, email signature.
- \`paid-ads/\` — Meta feed/story + Google Display (all IAB sizes).
- \`marketplaces/\` — storefront hero, tiles, banners.
- \`email/\` — newsletter + signature banners.
- \`seasonal/\` — Ramadan/Eid, UAE National Day, Mexican Independence.
- \`templates/\` — \`copy-presets.json\`, \`template-schema.json\`.
- \`guide/\` — brand guide, asset manifest, README.

## Folder structure
\`\`\`
public/brand-kit/
  cornermex-marketing-kit-v1.zip
  logos/  icons/  master-scenes/
  social-media/{instagram,facebook,linkedin,whatsapp,x}/
  website/  ecommerce/  b2b/
  paid-ads/{meta,google-display}/
  marketplaces/  email/  seasonal/
  templates/  guide/
\`\`\`

## Editing
Every template is a plain SVG. Open in Figma / Illustrator / Affinity / Inkscape or any text editor:
- \`<text>\` nodes → eyebrow / headline / body / CTA.
- \`<image href="…">\` → master scene.
- Colors follow tokens in \`guide/brand-guide.md\`.
SVGs reference \`../master-scenes/…\` and \`../logos/horizontal/…\` relatively — keep folder structure intact.

## Formats
SVG (logos, icons, all templates), JPG (master scenes), JSON (copy + schema). Rasterize to PNG/WebP from any vector tool at the final target size.

## Regenerate
\`\`\`
node scripts/build-cornermex-brand-kit.mjs
\`\`\`

## AI-generated content
Master scenes are AI-generated editorial photography. No third-party brands, real people or unlicensed packaging.

## Known limitations
- PNG/WebP rasters of every template are not shipped (export from vector tool).
- Ramadan/Eid variant is intentionally restrained — pair with UAE-specific copy before publishing.
- Arabic / RTL copy is not included.
- Product placeholder shows pantry photography, not specific packaged products, to avoid unlicensed packaging.
- 4 photographic master scenes + 1 SVG texture (of up to 7 planned). Add more under \`master-scenes/\` and reference from any template.
`;
  write(path.join(KIT, "guide", "README.md"), readme);

  write(path.join(KIT, "guide", "asset-manifest.json"), JSON.stringify({
    version: 1,
    generated_at: new Date().toISOString(),
    total_assets: manifest.length,
    tokens: { clay: CLAY, sage: SAGE, cream: CREAM, sand: SAND, obsidian: OBSIDIAN, muted: MUTED, display: DISPLAY, sans: SANS },
    assets: manifest,
  }, null, 2));
}

function buildZip() {
  const zipPath = path.join(KIT, "cornermex-marketing-kit-v1.zip");
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`cd "${KIT}" && zip -qr "cornermex-marketing-kit-v1.zip" . -x "cornermex-marketing-kit-v1.zip"`, { stdio: "inherit" });
  const stat = fs.statSync(zipPath);
  console.log(`ZIP: ${zipPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
}

function main() {
  console.log("Building CornerMex Marketing Kit v1…");
  ensureDir(KIT);
  copyScenes();
  buildLogos();
  buildTemplates();
  buildCopyPresets();
  buildDocs();
  buildZip();
  console.log(`Done. ${manifest.length} assets tracked.`);
}

main();
