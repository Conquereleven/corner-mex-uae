#!/usr/bin/env node
// CornerMex Marketing Kit v2 — premium, art-directed upgrade.
// Regenerates templates in-place with a multi-layout premium system,
// rasterizes priority previews (PNG + WebP), refreshes docs, builds v2 ZIP.
// Does not touch the CornerMex application.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import sharp from "sharp";

const ROOT = process.cwd();
const KIT = path.join(ROOT, "public", "brand-kit");
const SCENES = path.join(KIT, "master-scenes");
const PREVIEWS = path.join(KIT, "previews");

const CLAY = "#B4362B";
const CLAY_DEEP = "#8C2820";
const SAGE = "#3E7A54";
const CREAM = "#F8F3E8";
const SAND = "#EFE6D2";
const OBSIDIAN = "#2A2622";
const INK = "#1C1915";
const MUTED = "#8A7E6E";
const HAIRLINE = "rgba(248,243,232,0.35)";
const HAIRLINE_INK = "rgba(42,38,34,0.18)";

const DISPLAY = "'Cormorant Garamond', 'Cormorant', ui-serif, Georgia, serif";
const SANS = "'Inter', ui-sans-serif, system-ui, sans-serif";

const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const write = (p, c) => { ensureDir(path.dirname(p)); fs.writeFileSync(p, c); };
const esc = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ "<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;" }[c]));
const aspect = (w, h) => { const g=(a,b)=>b?g(b,a%b):a; const d=g(w,h); return `${w/d}:${h/d}`; };

const manifest = [];
const rec = (e) => manifest.push({ ...e, version: 2 });

// ============ LOGO SVGs (unchanged from v1 identity) ============
function wordmarkSVG({ corner, mex, uae, showUAE = true }) {
  const height = showUAE ? 260 : 200;
  const uaeLine = showUAE
    ? `<text x="50%" y="215" text-anchor="middle" font-family="${SANS}" font-size="26" letter-spacing="8" fill="${uae}" font-weight="500">UAE &#183; MEXICAN GROCERY</text>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" role="img" aria-label="CornerMex">
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
function monogramSVG({ fg }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="CM monogram">
  <text x="50%" y="345" text-anchor="middle" font-family="${DISPLAY}" font-weight="500" font-size="340" fill="${fg}" letter-spacing="-14">CM</text>
</svg>`;
}
function avatarSVG({ fg, bg }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" role="img" aria-label="CornerMex avatar">
  <rect width="1080" height="1080" fill="${bg}"/>
  <circle cx="540" cy="540" r="440" fill="none" stroke="${fg}" stroke-width="1.2" opacity="0.35"/>
  <text x="50%" y="620" text-anchor="middle" font-family="${DISPLAY}" font-weight="500" font-size="560" fill="${fg}" letter-spacing="-22">CM</text>
  <line x1="440" y1="760" x2="640" y2="760" stroke="${fg}" stroke-width="1.5" opacity="0.8"/>
  <text x="50%" y="880" text-anchor="middle" font-family="${SANS}" font-size="46" letter-spacing="22" fill="${fg}" opacity="0.9" font-weight="500">CORNERMEX</text>
</svg>`;
}
function buildLogos() {
  const variants = [
    ["full-color", { corner: OBSIDIAN, mex: CLAY, uae: MUTED }],
    ["clay",       { corner: CLAY, mex: CLAY, uae: CLAY }],
    ["charcoal",   { corner: OBSIDIAN, mex: OBSIDIAN, uae: OBSIDIAN }],
    ["cream",      { corner: CREAM, mex: CREAM, uae: CREAM }],
    ["reversed",   { corner: CREAM, mex: CLAY, uae: CREAM }],
    ["mono-black", { corner: "#000000", mex: "#000000", uae: "#000000" }],
    ["mono-white", { corner: "#FFFFFF", mex: "#FFFFFF", uae: "#FFFFFF" }],
  ];
  for (const [name, c] of variants) {
    write(path.join(KIT, "logos/horizontal", `cornermex-logo-horizontal-uae-${name}.svg`), wordmarkSVG({ ...c, showUAE: true }));
    write(path.join(KIT, "logos/horizontal", `cornermex-logo-horizontal-${name}.svg`), wordmarkSVG({ ...c, showUAE: false }));
    write(path.join(KIT, "logos/stacked", `cornermex-logo-stacked-${name}.svg`), stackedSVG(c));
    write(path.join(KIT, "logos/monogram", `cornermex-monogram-${name}.svg`), monogramSVG({ fg: c.mex }));
    if (name.startsWith("mono-")) {
      write(path.join(KIT, "logos/monochrome", `cornermex-print-${name}.svg`), wordmarkSVG({ ...c, showUAE: true }));
    }
    rec({ name: `Horizontal UAE ${name}`, filename: `cornermex-logo-horizontal-uae-${name}.svg`, folder: "logos/horizontal", dimensions: "800x260", aspect_ratio: "40:13", format: "svg", category: "logo", variation: name });
  }
  for (const [name, bgColor] of [["clay", CLAY], ["sage", SAGE], ["cream", CREAM], ["charcoal", OBSIDIAN]]) {
    const fg = name === "cream" ? OBSIDIAN : CREAM;
    write(path.join(KIT, "logos/social-avatar", `cornermex-social-avatar-${name}.svg`), avatarSVG({ fg, bg: bgColor }));
  }
}

// ============ PREMIUM LAYOUT SYSTEM ============
// Shared photo layer with tighter, more editorial overlay.
function photoLayer(w, h, scene, tint = "linear") {
  if (!scene) return "";
  const tintStops = tint === "linear"
    ? `<linearGradient id="tint" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${OBSIDIAN}" stop-opacity="0.55"/>
         <stop offset="0.55" stop-color="${OBSIDIAN}" stop-opacity="0.25"/>
         <stop offset="1" stop-color="${OBSIDIAN}" stop-opacity="0.72"/>
       </linearGradient>`
    : `<linearGradient id="tint" x1="0" y1="0" x2="1" y2="0">
         <stop offset="0" stop-color="${OBSIDIAN}" stop-opacity="0.78"/>
         <stop offset="0.6" stop-color="${OBSIDIAN}" stop-opacity="0.28"/>
         <stop offset="1" stop-color="${OBSIDIAN}" stop-opacity="0.05"/>
       </linearGradient>`;
  return `<defs>${tintStops}</defs>
  <image href="../master-scenes/${scene}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${w}" height="${h}" fill="url(#tint)"/>`;
}

// Layout A — Editorial full-bleed: photo + gradient, refined bottom-left type stack, hairline monogram top-right.
function layoutEditorial({ w, h, scene, eyebrow, headline, body, cta, logo = "cream", accent = CLAY }) {
  const pad = Math.round(Math.min(w, h) * 0.055);
  const s = Math.min(w, h);
  const fsEyebrow = Math.max(11, Math.round(s * 0.024));
  const fsHead = Math.max(28, Math.round(s * 0.098));
  const fsBody = Math.max(12, Math.round(s * 0.026));
  const fsCta = Math.max(11, Math.round(s * 0.024));
  const lines = String(headline).split("\n");
  const lineH = fsHead * 1.02;
  const blockH = lineH * lines.length + fsEyebrow + 20 + (body ? fsBody + 24 : 0) + (cta ? fsCta * 3 : 0);
  const startY = h - pad - blockH + fsEyebrow;
  const headBlock = lines.map((l, i) =>
    `<text x="${pad}" y="${startY + fsEyebrow + 26 + lineH * (i + 0.85)}" font-family="${DISPLAY}" font-size="${fsHead}" font-weight="500" fill="${CREAM}" letter-spacing="-2">${esc(l)}</text>`
  ).join("\n");
  const bodyY = startY + fsEyebrow + 26 + lineH * lines.length + fsBody + 8;
  const bodyEl = body ? `<text x="${pad}" y="${bodyY}" font-family="${SANS}" font-size="${fsBody}" fill="${CREAM}" opacity="0.88" font-weight="400">${esc(body)}</text>` : "";
  const eyebrowEl = eyebrow
    ? `<g><line x1="${pad}" y1="${startY - 4}" x2="${pad + fsEyebrow * 1.6}" y2="${startY - 4}" stroke="${accent}" stroke-width="2"/>
       <text x="${pad + fsEyebrow * 2.2}" y="${startY}" font-family="${SANS}" font-size="${fsEyebrow}" letter-spacing="6" fill="${CREAM}" font-weight="600" opacity="0.95">${esc(String(eyebrow).toUpperCase())}</text></g>`
    : "";
  let ctaEl = "";
  if (cta) {
    const ctaY = bodyY + fsCta * 2.2;
    const ctaTxt = String(cta).toUpperCase();
    const tw = Math.round(ctaTxt.length * fsCta * 0.7 + fsCta * 1.4);
    ctaEl = `<g>
      <text x="${pad}" y="${ctaY}" font-family="${SANS}" font-size="${fsCta}" font-weight="600" fill="${CREAM}" letter-spacing="3">${esc(ctaTxt)}</text>
      <line x1="${pad}" y1="${ctaY + 8}" x2="${pad + tw}" y2="${ctaY + 8}" stroke="${CREAM}" stroke-width="1"/>
      <line x1="${pad + tw + 8}" y1="${ctaY - fsCta * 0.32}" x2="${pad + tw + 8 + fsCta * 0.6}" y2="${ctaY - fsCta * 0.32}" stroke="${CREAM}" stroke-width="1.5"/>
      <line x1="${pad + tw + 8 + fsCta * 0.35}" y1="${ctaY - fsCta * 0.6}" x2="${pad + tw + 8 + fsCta * 0.6}" y2="${ctaY - fsCta * 0.32}" stroke="${CREAM}" stroke-width="1.5"/>
      <line x1="${pad + tw + 8 + fsCta * 0.35}" y1="${ctaY - fsCta * 0.04}" x2="${pad + tw + 8 + fsCta * 0.6}" y2="${ctaY - fsCta * 0.32}" stroke="${CREAM}" stroke-width="1.5"/>
    </g>`;
  }
  const logoW = Math.min(w * 0.22, Math.round(s * 0.19));
  const logoH = Math.round(logoW * 0.325);
  const logoEl = `<image href="../logos/horizontal/cornermex-logo-horizontal-${logo}.svg" x="${w - pad - logoW}" y="${pad}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>`;
  return `${photoLayer(w, h, scene, "linear")}
  <rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" fill="none" stroke="${HAIRLINE}" stroke-width="1"/>
  ${logoEl}
  ${eyebrowEl}
  ${headBlock}
  ${bodyEl}
  ${ctaEl}`;
}

// Layout B — Editorial split: photo on left ~58%, cream panel right with refined type stack.
function layoutSplit({ w, h, scene, eyebrow, headline, body, cta, logo = "full-color", accent = CLAY, imageSide = "left", imgRatio = 0.58 }) {
  const imgW = Math.round(w * imgRatio);
  const panelX = imageSide === "left" ? imgW : 0;
  const panelW = w - imgW;
  const imgX = imageSide === "left" ? 0 : panelW;
  const pad = Math.round(Math.min(panelW, h) * 0.09);
  const s = Math.min(panelW, h);
  const fsEyebrow = Math.max(10, Math.round(s * 0.028));
  const fsHead = Math.max(24, Math.round(s * 0.115));
  const fsBody = Math.max(12, Math.round(s * 0.032));
  const fsCta = Math.max(11, Math.round(s * 0.028));
  const lines = String(headline).split("\n");
  const lineH = fsHead * 1.02;
  const tx = panelX + pad;
  let y = Math.round(h * 0.42) - (lineH * lines.length) / 2;
  const eyebrowEl = eyebrow ? `<g>
      <line x1="${tx}" y1="${y - fsEyebrow * 2.2}" x2="${tx + fsEyebrow * 1.8}" y2="${y - fsEyebrow * 2.2}" stroke="${accent}" stroke-width="2"/>
      <text x="${tx + fsEyebrow * 2.5}" y="${y - fsEyebrow * 1.6}" font-family="${SANS}" font-size="${fsEyebrow}" letter-spacing="6" fill="${accent}" font-weight="600">${esc(String(eyebrow).toUpperCase())}</text>
    </g>` : "";
  const headBlock = lines.map((l, i) =>
    `<text x="${tx}" y="${y + lineH * (i + 0.82)}" font-family="${DISPLAY}" font-size="${fsHead}" font-weight="500" fill="${INK}" letter-spacing="-2">${esc(l)}</text>`
  ).join("\n");
  const bodyY = y + lineH * lines.length + fsBody + 16;
  const bodyEl = body ? `<text x="${tx}" y="${bodyY}" font-family="${SANS}" font-size="${fsBody}" fill="${MUTED}" font-weight="400">${esc(body)}</text>` : "";
  let ctaEl = "";
  if (cta) {
    const ctaY = bodyY + fsCta * 3.2;
    const ctaTxt = String(cta).toUpperCase();
    const tw = Math.round(ctaTxt.length * fsCta * 0.72 + fsCta * 2.4);
    const th = Math.round(fsCta * 2.6);
    ctaEl = `<g>
      <rect x="${tx}" y="${ctaY}" width="${tw}" height="${th}" fill="none" stroke="${INK}" stroke-width="1.2"/>
      <text x="${tx + tw / 2}" y="${ctaY + th * 0.66}" text-anchor="middle" font-family="${SANS}" font-size="${fsCta}" font-weight="600" fill="${INK}" letter-spacing="3">${esc(ctaTxt)}</text>
    </g>`;
  }
  const logoW = Math.min(panelW * 0.55, Math.round(s * 0.55));
  const logoH = Math.round(logoW * 0.325);
  const logoEl = `<image href="../logos/horizontal/cornermex-logo-horizontal-${logo}.svg" x="${tx}" y="${pad}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMinYMin meet"/>`;
  return `<rect width="${w}" height="${h}" fill="${CREAM}"/>
  <clipPath id="imgclip"><rect x="${imgX}" y="0" width="${imgW}" height="${h}"/></clipPath>
  <g clip-path="url(#imgclip)">
    <image href="../master-scenes/${scene}" x="${imgX}" y="0" width="${imgW}" height="${h}" preserveAspectRatio="xMidYMid slice"/>
  </g>
  <line x1="${panelX}" y1="0" x2="${panelX}" y2="${h}" stroke="${HAIRLINE_INK}" stroke-width="1"/>
  ${logoEl}
  ${eyebrowEl}
  ${headBlock}
  ${bodyEl}
  ${ctaEl}
  <text x="${tx}" y="${h - pad}" font-family="${SANS}" font-size="${Math.max(9, Math.round(fsEyebrow * 0.75))}" letter-spacing="4" fill="${MUTED}" font-weight="500">CORNERMEX &#183; UAE</text>`;
}

// Layout C — Minimal cream (seasonal / luxury restraint): centered serif poetry, monogram, hairline dividers.
function layoutMinimal({ w, h, eyebrow, headline, body, cta, accent = CLAY, textColor = INK, bg = CREAM }) {
  const pad = Math.round(Math.min(w, h) * 0.08);
  const s = Math.min(w, h);
  const fsEyebrow = Math.max(11, Math.round(s * 0.026));
  const fsHead = Math.max(30, Math.round(s * 0.11));
  const fsBody = Math.max(12, Math.round(s * 0.028));
  const cx = w / 2;
  const lines = String(headline).split("\n");
  const lineH = fsHead * 1.02;
  const totalH = lineH * lines.length + fsEyebrow + 60 + (body ? fsBody + 30 : 0);
  const y0 = h / 2 - totalH / 2 + fsEyebrow;
  const monoW = Math.round(s * 0.09);
  const monoEl = `<image href="../logos/monogram/cornermex-monogram-${textColor === CREAM ? "cream" : "clay"}.svg" x="${cx - monoW / 2}" y="${pad}" width="${monoW}" height="${monoW}" preserveAspectRatio="xMidYMid meet"/>`;
  const eyebrowEl = eyebrow ? `<text x="${cx}" y="${y0}" text-anchor="middle" font-family="${SANS}" font-size="${fsEyebrow}" letter-spacing="10" fill="${accent}" font-weight="600">${esc(String(eyebrow).toUpperCase())}</text>` : "";
  const headStart = y0 + fsEyebrow + 40;
  const headBlock = lines.map((l, i) =>
    `<text x="${cx}" y="${headStart + lineH * (i + 0.85)}" text-anchor="middle" font-family="${DISPLAY}" font-size="${fsHead}" font-style="italic" font-weight="500" fill="${textColor}" letter-spacing="-1.5">${esc(l)}</text>`
  ).join("\n");
  const bodyY = headStart + lineH * lines.length + fsBody + 18;
  const bodyEl = body ? `<text x="${cx}" y="${bodyY}" text-anchor="middle" font-family="${SANS}" font-size="${fsBody}" fill="${textColor === CREAM ? "rgba(248,243,232,0.75)" : MUTED}" font-weight="400">${esc(body)}</text>` : "";
  const dividerY = bodyY + fsBody * 1.6;
  const ctaEl = cta ? `<text x="${cx}" y="${dividerY + fsBody * 2}" text-anchor="middle" font-family="${SANS}" font-size="${Math.round(fsBody * 0.85)}" letter-spacing="6" fill="${accent}" font-weight="600">${esc(String(cta).toUpperCase())}  &#8250;</text>` : "";
  return `<rect width="${w}" height="${h}" fill="${bg}"/>
  <rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" fill="none" stroke="${textColor === CREAM ? HAIRLINE : HAIRLINE_INK}" stroke-width="1"/>
  ${monoEl}
  ${eyebrowEl}
  ${headBlock}
  ${bodyEl}
  <line x1="${cx - 40}" y1="${dividerY}" x2="${cx + 40}" y2="${dividerY}" stroke="${accent}" stroke-width="1.2"/>
  ${ctaEl}`;
}

// Layout D — Executive B2B: cream top structural band, photo bottom, numbered marker, bordered CTA, credential row.
function layoutExecutive({ w, h, scene, eyebrow, headline, body, cta, credentials = ["Restaurants", "Retailers", "Hotels", "Distributors"] }) {
  const bandH = Math.round(h * 0.62);
  const pad = Math.round(Math.min(w, h) * 0.05);
  const s = Math.min(w, h);
  const fsEyebrow = Math.max(11, Math.round(s * 0.022));
  const fsHead = Math.max(24, Math.round(s * 0.078));
  const fsBody = Math.max(12, Math.round(s * 0.024));
  const fsCta = Math.max(11, Math.round(s * 0.022));
  const lines = String(headline).split("\n");
  const lineH = fsHead * 1.02;
  const tx = pad * 1.4;
  const eyebrowY = pad * 1.8 + fsEyebrow;
  const numY = eyebrowY;
  const numEl = `<text x="${tx}" y="${numY}" font-family="${SANS}" font-size="${fsEyebrow}" letter-spacing="4" fill="${CLAY}" font-weight="600">N&#176; 01 &#183; B2B TRADE</text>`;
  const eyebrowEl = eyebrow
    ? `<text x="${w - pad * 1.4}" y="${numY}" text-anchor="end" font-family="${SANS}" font-size="${fsEyebrow}" letter-spacing="4" fill="${MUTED}" font-weight="500">${esc(String(eyebrow).toUpperCase())}</text>`
    : "";
  const headY = numY + fsHead * 1.4;
  const headBlock = lines.map((l, i) =>
    `<text x="${tx}" y="${headY + lineH * (i + 0.82)}" font-family="${DISPLAY}" font-size="${fsHead}" font-weight="500" fill="${INK}" letter-spacing="-1.5">${esc(l)}</text>`
  ).join("\n");
  const bodyY = headY + lineH * lines.length + fsBody + 8;
  const bodyEl = body ? `<text x="${tx}" y="${bodyY}" font-family="${SANS}" font-size="${fsBody}" fill="${MUTED}" font-weight="400">${esc(body)}</text>` : "";
  const credY = bodyY + fsBody * 2.4;
  const credEl = `<g font-family="${SANS}" font-size="${Math.round(fsBody * 0.82)}" letter-spacing="3" fill="${INK}" font-weight="600">
    ${credentials.map((c, i) => `<text x="${tx + i * (w * 0.14)}" y="${credY}">&#8226; ${esc(c.toUpperCase())}</text>`).join("")}
  </g>`;
  let ctaEl = "";
  if (cta) {
    const ctaTxt = String(cta).toUpperCase();
    const tw = Math.round(ctaTxt.length * fsCta * 0.72 + fsCta * 2.6);
    const th = Math.round(fsCta * 2.8);
    const cy = bandH - pad - th;
    ctaEl = `<g>
      <rect x="${tx}" y="${cy}" width="${tw}" height="${th}" fill="${CLAY}"/>
      <text x="${tx + tw / 2}" y="${cy + th * 0.66}" text-anchor="middle" font-family="${SANS}" font-size="${fsCta}" font-weight="600" fill="${CREAM}" letter-spacing="3">${esc(ctaTxt)}</text>
    </g>`;
  }
  const logoW = Math.round(s * 0.18);
  const logoH = Math.round(logoW * 0.325);
  const logoEl = `<image href="../logos/horizontal/cornermex-logo-horizontal-full-color.svg" x="${w - pad * 1.4 - logoW}" y="${bandH - pad - logoH}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMax meet"/>`;
  return `<rect width="${w}" height="${h}" fill="${CREAM}"/>
  <line x1="${pad}" y1="${pad}" x2="${w - pad}" y2="${pad}" stroke="${INK}" stroke-width="1"/>
  <line x1="${pad}" y1="${bandH}" x2="${w - pad}" y2="${bandH}" stroke="${HAIRLINE_INK}" stroke-width="1"/>
  <clipPath id="ph"><rect x="0" y="${bandH}" width="${w}" height="${h - bandH}"/></clipPath>
  <g clip-path="url(#ph)">
    <image href="../master-scenes/${scene}" x="0" y="${bandH}" width="${w}" height="${h - bandH}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="0" y="${bandH}" width="${w}" height="${h - bandH}" fill="${OBSIDIAN}" opacity="0.25"/>
  </g>
  ${numEl}
  ${eyebrowEl}
  ${headBlock}
  ${bodyEl}
  ${credEl}
  ${ctaEl}
  ${logoEl}`;
}

// Layout E — Conversion tile (ecommerce): image top 62%, cream bottom panel with structured hierarchy.
function layoutConversion({ w, h, scene, eyebrow, headline, body, cta, logo = "full-color", accent = CLAY }) {
  const imgH = Math.round(h * 0.62);
  const pad = Math.round(Math.min(w, h) * 0.05);
  const s = Math.min(w, h);
  const fsEyebrow = Math.max(10, Math.round(s * 0.024));
  const fsHead = Math.max(22, Math.round(s * 0.082));
  const fsBody = Math.max(11, Math.round(s * 0.024));
  const fsCta = Math.max(11, Math.round(s * 0.024));
  const lines = String(headline).split("\n");
  const lineH = fsHead * 1.02;
  const tx = pad;
  const eyY = imgH + pad + fsEyebrow;
  const eyebrowEl = eyebrow ? `<text x="${tx}" y="${eyY}" font-family="${SANS}" font-size="${fsEyebrow}" letter-spacing="6" fill="${accent}" font-weight="600">${esc(String(eyebrow).toUpperCase())}</text>` : "";
  const headY = eyY + fsHead * 0.6 + 16;
  const headBlock = lines.map((l, i) =>
    `<text x="${tx}" y="${headY + lineH * (i + 0.82)}" font-family="${DISPLAY}" font-size="${fsHead}" font-weight="500" fill="${INK}" letter-spacing="-1.5">${esc(l)}</text>`
  ).join("\n");
  const bodyY = headY + lineH * lines.length + fsBody + 8;
  const bodyEl = body ? `<text x="${tx}" y="${bodyY}" font-family="${SANS}" font-size="${fsBody}" fill="${MUTED}" font-weight="400">${esc(body)}</text>` : "";
  let ctaEl = "";
  if (cta) {
    const ctaTxt = String(cta).toUpperCase();
    const arrowX = w - pad;
    ctaEl = `<g>
      <text x="${arrowX - 22}" y="${h - pad}" text-anchor="end" font-family="${SANS}" font-size="${fsCta}" letter-spacing="3" fill="${accent}" font-weight="600">${esc(ctaTxt)}</text>
      <line x1="${arrowX - 18}" y1="${h - pad - fsCta * 0.35}" x2="${arrowX}" y2="${h - pad - fsCta * 0.35}" stroke="${accent}" stroke-width="1.5"/>
      <line x1="${arrowX - 6}" y1="${h - pad - fsCta * 0.7}" x2="${arrowX}" y2="${h - pad - fsCta * 0.35}" stroke="${accent}" stroke-width="1.5"/>
      <line x1="${arrowX - 6}" y1="${h - pad}" x2="${arrowX}" y2="${h - pad - fsCta * 0.35}" stroke="${accent}" stroke-width="1.5"/>
    </g>`;
  }
  const logoW = Math.min(w * 0.22, Math.round(s * 0.16));
  const logoH = Math.round(logoW * 0.325);
  return `<rect width="${w}" height="${h}" fill="${CREAM}"/>
  <clipPath id="ic"><rect x="0" y="0" width="${w}" height="${imgH}"/></clipPath>
  <g clip-path="url(#ic)">
    <image href="../master-scenes/${scene}" x="0" y="0" width="${w}" height="${imgH}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="0" y="0" width="${w}" height="${imgH}" fill="${OBSIDIAN}" opacity="0.14"/>
  </g>
  <image href="../logos/horizontal/cornermex-logo-horizontal-cream.svg" x="${pad}" y="${pad}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMinYMin meet"/>
  <line x1="${tx}" y1="${imgH + pad * 0.4}" x2="${tx + Math.round(s * 0.08)}" y2="${imgH + pad * 0.4}" stroke="${accent}" stroke-width="2"/>
  ${eyebrowEl}
  ${headBlock}
  ${bodyEl}
  ${ctaEl}`;
}

// Layout F — Compact banner (thin banners, ad units, X headers): horizontal composition.
function layoutBanner({ w, h, scene, eyebrow, headline, body, cta, logo = "cream", accent = CLAY }) {
  const pad = Math.round(Math.min(w, h) * 0.07);
  const s = Math.min(w, h);
  const fsEyebrow = Math.max(10, Math.round(s * 0.075));
  const fsHead = Math.max(18, Math.round(s * 0.26));
  const fsBody = Math.max(10, Math.round(s * 0.08));
  const fsCta = Math.max(10, Math.round(s * 0.08));
  const lines = String(headline).split("\n").slice(0, 2);
  const lineH = fsHead * 1.02;
  const tx = pad;
  const y0 = Math.round(h * 0.5) - (lineH * lines.length) / 2;
  const eyebrowEl = eyebrow ? `<text x="${tx}" y="${y0 - fsEyebrow}" font-family="${SANS}" font-size="${fsEyebrow}" letter-spacing="4" fill="${accent}" font-weight="600">${esc(String(eyebrow).toUpperCase())}</text>` : "";
  const headBlock = lines.map((l, i) =>
    `<text x="${tx}" y="${y0 + lineH * (i + 0.82)}" font-family="${DISPLAY}" font-size="${fsHead}" font-weight="500" fill="${CREAM}" letter-spacing="-1.5">${esc(l)}</text>`
  ).join("\n");
  const ctaEl = cta ? `<text x="${w - pad}" y="${h - pad}" text-anchor="end" font-family="${SANS}" font-size="${fsCta}" letter-spacing="3" fill="${CREAM}" font-weight="600">${esc(String(cta).toUpperCase())}  &#8250;</text>` : "";
  return `${photoLayer(w, h, scene, "horizontal")}
  ${eyebrowEl}
  ${headBlock}
  ${ctaEl}`;
}

// ============ CAMPAIGN COPY ============
const CAMPAIGNS = {
  "brand-introduction":   { eyebrow: "CornerMex UAE",             head: "Mexico,\ncloser than ever.",         body: "Authentic Mexican groceries, delivered across the UAE.",           cta: "Discover CornerMex",  scene: "chiles-lime-macro.jpg" },
  "uae-delivery":         { eyebrow: "Delivery across the UAE",   head: "Mexican favourites,\ndelivered.",     body: "Fresh from Mexico to your door — every emirate.",                   cta: "Shop now",            scene: "uae-delivery.jpg" },
  "b2b-wholesale":        { eyebrow: "B2B wholesale",             head: "Authentic Mexican\nsupply for pros.", body: "Reliable wholesale for restaurants, retailers and hotels.",         cta: "Request a quote",     scene: "chef-hospitality.jpg" },
  "pantry-essentials":    { eyebrow: "The Mexican pantry",        head: "Real flavour,\nreal ingredients.",    body: "Dried chiles, tortillas, salsas, beans, oregano and more.",         cta: "Shop the pantry",     scene: "pantry-editorial.jpg" },
  "snacks-sweets":        { eyebrow: "Snacks &#38; sweets",       head: "Small joys,\nfrom home.",             body: "Tamarindo candies, chile peanuts, dulce de leche, cocoa.",          cta: "Explore snacks",      scene: "snacks-styled.jpg" },
  "restaurant-restock":   { eyebrow: "Professional kitchens",     head: "Restock your\nMexican kitchen.",      body: "Trade supply for kitchens that plate the real thing.",              cta: "Order wholesale",     scene: "chef-hospitality.jpg" },
  "new-arrivals":         { eyebrow: "Just landed",               head: "Fresh arrivals\nfrom Mexico.",        body: "New shelves, new flavours — curated this month.",                   cta: "View new arrivals",   scene: "shelf-assortment.jpg" },
  "weekend-promotion":    { eyebrow: "This weekend",              head: "A little more Mexico,\nthis weekend.",body: "Curated picks for the table.",                                      cta: "Shop weekend picks",  scene: "chiles-lime-macro.jpg" },
  "b2b-lead-gen":         { eyebrow: "Trade enquiries",           head: "Looking for a\nreliable supplier?",   body: "Wholesale Mexican supply for restaurants and retailers, UAE-wide.", cta: "Request a quote",     scene: "chef-hospitality.jpg" },
  "ramadan-eid":          { eyebrow: "Ramadan &#38; Eid",         head: "Flavour worth\nsharing.",             body: "Thoughtful pantry picks for evenings together.",                    cta: "Shop the collection", scene: null, minimal: true, bg: "#1F1A15", textColor: CREAM },
  "uae-national-day":     { eyebrow: "UAE National Day",          head: "Proudly delivering\nMexico across the UAE.", body: "A quiet salute from our shelves to yours.",                cta: "Shop the collection", scene: null, minimal: true, bg: CREAM, textColor: INK },
  "mexican-independence": { eyebrow: "Mexican season",            head: "Real Mexico,\nrefined.",              body: "Ingredients, snacks and sweets from home.",                         cta: "Shop the collection", scene: "chiles-lime-macro.jpg" },
};

// ============ TEMPLATE PLAN ============
// Layout selection per use case family.
const PLAN = [
  // Editorial consumer (Instagram square/story, Facebook, homepage hero, brand intro)
  { folder: "social-media/instagram", w: 1080, h: 1080, size: "square", campaigns: ["brand-introduction", "uae-delivery", "pantry-essentials", "new-arrivals"], layout: "editorial" },
  { folder: "social-media/instagram", w: 1080, h: 1350, size: "portrait", campaigns: ["pantry-essentials", "snacks-sweets", "weekend-promotion"], layout: "editorial" },
  { folder: "social-media/instagram", w: 1080, h: 1920, size: "story", campaigns: ["brand-introduction", "uae-delivery", "new-arrivals"], layout: "editorial" },
  { folder: "social-media/instagram", w: 1080, h: 1920, size: "reel-cover", campaigns: ["pantry-essentials", "restaurant-restock"], layout: "editorial" },
  { folder: "social-media/facebook", w: 1080, h: 1080, size: "square", campaigns: ["brand-introduction", "uae-delivery", "weekend-promotion"], layout: "editorial" },
  { folder: "social-media/x", w: 1500, h: 500, size: "header", campaigns: ["brand-introduction"], layout: "banner" },
  { folder: "social-media/x", w: 1600, h: 900, size: "post", campaigns: ["uae-delivery", "b2b-wholesale"], layout: "editorial" },
  { folder: "social-media/whatsapp", w: 1080, h: 1080, size: "catalog-cover", campaigns: ["brand-introduction"], layout: "editorial" },
  { folder: "social-media/whatsapp", w: 1080, h: 1080, size: "promo", campaigns: ["weekend-promotion"], layout: "editorial" },
  { folder: "social-media/whatsapp", w: 1080, h: 1080, size: "b2b-contact", campaigns: ["b2b-lead-gen"], layout: "executive" },

  // B2B / trade
  { folder: "social-media/linkedin", w: 1200, h: 627, size: "post", campaigns: ["b2b-wholesale", "b2b-lead-gen"], layout: "executive" },
  { folder: "social-media/linkedin", w: 1128, h: 191, size: "banner", campaigns: ["b2b-wholesale"], layout: "banner" },
  { folder: "social-media/linkedin", w: 1200, h: 627, size: "b2b-lead", campaigns: ["b2b-lead-gen"], layout: "executive" },
  { folder: "b2b", w: 1200, h: 627, size: "linkedin-hero", campaigns: ["b2b-wholesale"], layout: "executive" },
  { folder: "b2b", w: 1600, h: 600, size: "restaurant-supply", campaigns: ["restaurant-restock"], layout: "executive" },
  { folder: "b2b", w: 1600, h: 600, size: "retailer-distributor", campaigns: ["b2b-wholesale"], layout: "executive" },
  { folder: "b2b", w: 1600, h: 600, size: "hotel-hospitality", campaigns: ["b2b-wholesale"], layout: "executive" },
  { folder: "b2b", w: 1200, h: 300, size: "email-signature", campaigns: ["b2b-lead-gen"], layout: "banner" },
  { folder: "b2b", w: 1920, h: 1080, size: "proposal-cover", campaigns: ["b2b-wholesale"], layout: "executive" },
  { folder: "b2b", w: 1920, h: 1080, size: "presentation-cover", campaigns: ["b2b-wholesale"], layout: "executive" },
  { folder: "b2b", w: 1240, h: 1754, size: "a4-sales-sheet", campaigns: ["b2b-wholesale"], layout: "executive" },
  { folder: "b2b", w: 1240, h: 1754, size: "a4-price-list", campaigns: ["b2b-wholesale"], layout: "executive" },
  { folder: "b2b", w: 1240, h: 1754, size: "a4-catalog-cover", campaigns: ["pantry-essentials"], layout: "split" },
  { folder: "b2b", w: 1500, h: 1000, size: "trade-show-backdrop", campaigns: ["brand-introduction"], layout: "editorial" },
  { folder: "b2b", w: 1240, h: 1754, size: "quotation-cover", campaigns: ["b2b-wholesale"], layout: "executive" },
  { folder: "b2b", w: 1240, h: 1754, size: "distributor-intro", campaigns: ["b2b-wholesale"], layout: "executive" },

  // Website (mix: hero editorial, banners split/conversion)
  { folder: "website", w: 1920, h: 900, size: "homepage-hero-desktop", campaigns: ["brand-introduction", "uae-delivery"], layout: "editorial" },
  { folder: "website", w: 1080, h: 1350, size: "homepage-hero-mobile", campaigns: ["brand-introduction"], layout: "editorial" },
  { folder: "website", w: 1600, h: 600, size: "collection-banner", campaigns: ["pantry-essentials", "snacks-sweets"], layout: "split" },
  { folder: "website", w: 1600, h: 400, size: "promo-banner", campaigns: ["weekend-promotion"], layout: "banner" },
  { folder: "website", w: 1200, h: 630, size: "og-image", campaigns: ["brand-introduction"], layout: "editorial" },
  { folder: "website", w: 1200, h: 400, size: "newsletter-header", campaigns: ["new-arrivals"], layout: "banner" },
  { folder: "website", w: 1600, h: 1000, size: "category-placeholder", campaigns: ["pantry-essentials"], layout: "split" },
  { folder: "website", w: 1200, h: 1200, size: "product-placeholder", campaigns: ["pantry-essentials"], layout: "conversion" },
  { folder: "website", w: 1600, h: 600, size: "new-arrivals", campaigns: ["new-arrivals"], layout: "split" },
  { folder: "website", w: 1600, h: 600, size: "b2b-homepage", campaigns: ["b2b-wholesale"], layout: "executive" },
  { folder: "website", w: 1600, h: 600, size: "delivery-promo", campaigns: ["uae-delivery"], layout: "split" },
  { folder: "website", w: 1600, h: 600, size: "wholesale-collection", campaigns: ["b2b-wholesale"], layout: "executive" },

  // Ecommerce (conversion-oriented)
  { folder: "ecommerce", w: 1600, h: 600, size: "collection-hero", campaigns: ["pantry-essentials", "snacks-sweets"], layout: "split" },
  { folder: "ecommerce", w: 1200, h: 1200, size: "product-tile", campaigns: ["pantry-essentials"], layout: "conversion" },

  // Paid ads
  { folder: "paid-ads/meta", w: 1080, h: 1080, size: "feed-square", campaigns: ["uae-delivery", "new-arrivals", "weekend-promotion"], layout: "editorial" },
  { folder: "paid-ads/meta", w: 1080, h: 1350, size: "feed-portrait", campaigns: ["pantry-essentials", "snacks-sweets"], layout: "editorial" },
  { folder: "paid-ads/meta", w: 1080, h: 1920, size: "story-ad", campaigns: ["uae-delivery", "weekend-promotion"], layout: "editorial" },
  { folder: "paid-ads/google-display", w: 1200, h: 628, size: "landscape", campaigns: ["uae-delivery"], layout: "banner" },
  { folder: "paid-ads/google-display", w: 1080, h: 1080, size: "square", campaigns: ["uae-delivery"], layout: "editorial" },
  { folder: "paid-ads/google-display", w: 300, h: 250, size: "medium-rect", campaigns: ["uae-delivery"], layout: "banner" },
  { folder: "paid-ads/google-display", w: 336, h: 280, size: "large-rect", campaigns: ["uae-delivery"], layout: "banner" },
  { folder: "paid-ads/google-display", w: 728, h: 90, size: "leaderboard", campaigns: ["uae-delivery"], layout: "banner" },
  { folder: "paid-ads/google-display", w: 970, h: 250, size: "billboard", campaigns: ["uae-delivery"], layout: "banner" },

  // Marketplaces
  { folder: "marketplaces", w: 1464, h: 600, size: "storefront-hero", campaigns: ["brand-introduction"], layout: "split" },
  { folder: "marketplaces", w: 1000, h: 1000, size: "promo-tile", campaigns: ["weekend-promotion"], layout: "editorial" },
  { folder: "marketplaces", w: 1000, h: 1000, size: "collection-tile", campaigns: ["pantry-essentials"], layout: "conversion" },
  { folder: "marketplaces", w: 1464, h: 600, size: "delivery-banner", campaigns: ["uae-delivery"], layout: "split" },
  { folder: "marketplaces", w: 1464, h: 600, size: "wholesale-banner", campaigns: ["b2b-wholesale"], layout: "executive" },
  { folder: "marketplaces", w: 1464, h: 600, size: "new-arrivals-banner", campaigns: ["new-arrivals"], layout: "split" },

  // Email
  { folder: "email", w: 1200, h: 400, size: "header-brand", campaigns: ["brand-introduction"], layout: "banner" },
  { folder: "email", w: 1200, h: 400, size: "header-new-arrivals", campaigns: ["new-arrivals"], layout: "banner" },
  { folder: "email", w: 1200, h: 400, size: "header-b2b", campaigns: ["b2b-wholesale"], layout: "banner" },
  { folder: "email", w: 1200, h: 300, size: "signature-banner", campaigns: ["b2b-lead-gen"], layout: "banner" },

  // Seasonal (minimal cream restraint)
  { folder: "seasonal", w: 1080, h: 1080, size: "ramadan-eid-square", campaigns: ["ramadan-eid"], layout: "minimal" },
  { folder: "seasonal", w: 1080, h: 1920, size: "ramadan-eid-story", campaigns: ["ramadan-eid"], layout: "minimal" },
  { folder: "seasonal", w: 1080, h: 1080, size: "uae-national-day-square", campaigns: ["uae-national-day"], layout: "minimal" },
  { folder: "seasonal", w: 1080, h: 1080, size: "mexican-independence-square", campaigns: ["mexican-independence"], layout: "minimal" },
];

function renderTemplate({ layout, w, h, camp }) {
  const args = { w, h, scene: camp.scene, eyebrow: camp.eyebrow, headline: camp.head, body: camp.body, cta: camp.cta };
  let inner;
  const isTiny = Math.min(w, h) < 260;
  if (isTiny) { args.body = ""; args.eyebrow = ""; args.headline = camp.head.split("\n")[0]; }
  switch (layout) {
    case "split":       inner = layoutSplit(args); break;
    case "minimal":     inner = layoutMinimal({ ...args, bg: camp.bg || CREAM, textColor: camp.textColor || INK }); break;
    case "executive":   inner = layoutExecutive(args); break;
    case "conversion":  inner = layoutConversion(args); break;
    case "banner":      inner = layoutBanner(args); break;
    case "editorial":
    default:            inner = layoutEditorial(args); break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n${inner}\n</svg>`;
}

function buildTemplates() {
  const generated = [];
  for (const p of PLAN) {
    for (const key of p.campaigns) {
      const camp = CAMPAIGNS[key];
      const file = `cornermex-${p.folder.split("/").pop()}-${p.size}-${key}.svg`;
      const outPath = path.join(KIT, p.folder, file);
      const svg = renderTemplate({ layout: p.layout, w: p.w, h: p.h, camp });
      write(outPath, svg);
      rec({ name: file.replace(/\.svg$/, ""), filename: file, folder: p.folder, dimensions: `${p.w}x${p.h}`, aspect_ratio: aspect(p.w, p.h), format: "svg", category: p.folder.split("/")[0], campaign: key, layout: p.layout, redesigned_v2: true, scene: camp.scene || null });
      generated.push({ file: outPath, folder: p.folder, w: p.w, h: p.h, layout: p.layout, size: p.size, campaign: key });
    }
  }
  return generated;
}

// ============ RASTERIZATION (PNG + WebP for priority previews) ============
// Inline referenced files (../master-scenes/*.jpg, ../logos/**.svg) as data URIs so sharp/librsvg renders them reliably.
const dataCache = new Map();
function inlineSvgAssets(svg, svgPath) {
  const dir = path.dirname(svgPath);
  return svg.replace(/href="((?:\.\.\/)+[^"]+)"/g, (m, rel) => {
    const abs = path.resolve(dir, rel);
    if (!fs.existsSync(abs)) return m;
    let b64 = dataCache.get(abs);
    let mime;
    if (!b64) {
      const buf = fs.readFileSync(abs);
      if (abs.endsWith(".jpg") || abs.endsWith(".jpeg")) mime = "image/jpeg";
      else if (abs.endsWith(".png")) mime = "image/png";
      else if (abs.endsWith(".svg")) {
        // recursively inline nested svg refs (logos referencing other files) — usually none, but safe
        let nested = buf.toString("utf-8");
        nested = inlineSvgAssets(nested, abs);
        b64 = Buffer.from(nested).toString("base64");
        mime = "image/svg+xml";
      } else return m;
      if (!b64) b64 = buf.toString("base64");
      dataCache.set(abs, b64);
      dataCache.set(abs + ":mime", mime);
    } else {
      mime = dataCache.get(abs + ":mime");
    }
    return `href="data:${mime};base64,${b64}"`;
  });
}

// Priority set for raster previews.
const PRIORITY_SIZES = new Set([
  "square", "portrait", "story", "reel-cover", "header", "catalog-cover",
  "b2b-lead", "linkedin-hero", "homepage-hero-desktop", "homepage-hero-mobile",
  "collection-banner", "promo-banner", "og-image", "new-arrivals", "b2b-homepage",
  "collection-hero", "product-tile", "restaurant-supply", "retailer-distributor",
  "hotel-hospitality", "proposal-cover", "a4-sales-sheet", "a4-catalog-cover",
  "feed-square", "feed-portrait", "story-ad", "landscape", "billboard",
  "storefront-hero", "delivery-banner", "wholesale-banner", "new-arrivals-banner",
  "header-brand", "header-new-arrivals", "header-b2b",
  "ramadan-eid-square", "ramadan-eid-story", "uae-national-day-square", "mexican-independence-square",
  "post", "banner", "trade-show-backdrop", "product-placeholder", "category-placeholder",
]);
const WEBP_SIZES = new Set([
  "homepage-hero-desktop", "og-image", "collection-hero", "collection-banner",
  "square", "portrait", "story", "feed-square", "feed-portrait", "product-tile",
  "storefront-hero", "landscape", "billboard",
]);
async function rasterize(gen) {
  let pngN = 0, webpN = 0;
  const MAX_W = 1600;
  for (const g of gen) {
    if (!PRIORITY_SIZES.has(g.size)) continue;
    const svgRaw = fs.readFileSync(g.file, "utf-8");
    const inlined = inlineSvgAssets(svgRaw, g.file);
    const scale = g.w > MAX_W ? MAX_W / g.w : 1;
    const outW = Math.round(g.w * scale);
    const outH = Math.round(g.h * scale);
    const outDir = path.join(PREVIEWS, g.folder);
    ensureDir(outDir);
    const base = path.basename(g.file, ".svg");
    try {
      const img = sharp(Buffer.from(inlined), { density: 220 });
      await img.resize(outW, outH, { fit: "fill" }).png({ compressionLevel: 9 }).toFile(path.join(outDir, `${base}.png`));
      pngN++;
      if (WEBP_SIZES.has(g.size)) {
        await sharp(Buffer.from(inlined), { density: 220 }).resize(outW, outH, { fit: "fill" }).webp({ quality: 82 }).toFile(path.join(outDir, `${base}.webp`));
        webpN++;
      }
    } catch (e) {
      console.warn(`raster fail ${base}: ${e.message}`);
    }
  }
  return { pngN, webpN };
}

// ============ SCENES / TEXTURE ============
function writeTexture() {
  const tex = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1280">
  <rect width="1920" height="1280" fill="${CREAM}"/>
  <circle cx="1500" cy="240" r="360" fill="${CLAY}" opacity="0.10"/>
  <circle cx="220" cy="1100" r="280" fill="${SAGE}" opacity="0.12"/>
  <line x1="0" y1="640" x2="1920" y2="640" stroke="${OBSIDIAN}" stroke-width="1" opacity="0.06"/>
</svg>`;
  write(path.join(SCENES, "brand-texture.svg"), tex);
}

// ============ DOCS ============
function buildDocs(rasterCount) {
  const scenes = [
    { file: "pantry-editorial.jpg", desc: "Premium Mexican pantry editorial flatlay", status: "regenerated (v2)" },
    { file: "chiles-lime-macro.jpg", desc: "Editorial macro of chiles, lime, corn, molcajete", status: "regenerated (v2)" },
    { file: "shelf-assortment.jpg", desc: "Boutique shelf assortment", status: "new (v2)" },
    { file: "chef-hospitality.jpg", desc: "Chef plating in modern kitchen", status: "new (v2)" },
    { file: "minimal-still-life.jpg", desc: "Minimal cream/clay/sage still life", status: "new (v2)" },
    { file: "snacks-styled.jpg", desc: "Styled Mexican snacks and sweets editorial", status: "new (v2)" },
    { file: "pantry.jpg", desc: "Original pantry (v1 retained)", status: "retained (v1)" },
    { file: "chiles-lime-corn.jpg", desc: "Original chiles/lime (v1 retained)", status: "retained (v1)" },
    { file: "restaurant-b2b.jpg", desc: "Original restaurant kitchen (v1 retained)", status: "retained (v1)" },
    { file: "uae-delivery.jpg", desc: "UAE delivery lifestyle (v1 retained)", status: "retained (v1)" },
    { file: "brand-texture.svg", desc: "SVG cream/clay/sage texture", status: "refined (v2)" },
  ];
  scenes.forEach((s) => rec({ name: s.desc, filename: s.file, folder: "master-scenes", format: s.file.endsWith(".svg") ? "svg" : "jpg", category: "master-scene", status: s.status }));

  const guide = `# CornerMex Brand Guide — v2 Premium

## What changed in v2
V2 is a creative-direction upgrade over v1. Same brand identity, more premium composition.

- Six new/regenerated editorial master scenes: pantry-editorial, chiles-lime-macro, shelf-assortment, chef-hospitality, minimal-still-life, snacks-styled.
- Four v1 scenes retained for backward compatibility.
- New multi-layout template system (5 premium layout families):
  1. **Editorial** — full-bleed photography, hairline inset frame, refined bottom-anchored type stack, arrow-underline CTA. Used for Instagram, Facebook, homepage hero, Meta feed, brand intro.
  2. **Split** — 58/42 photo + cream panel, thin divider, outlined CTA, small caps footer. Used for collection banners, category placeholders, marketplace heroes, delivery promos.
  3. **Executive** — cream structural top band + photo bottom band, numbered marker, credentials row, filled clay CTA, full-color logo. Used for all B2B, LinkedIn, hospitality, wholesale.
  4. **Conversion** — image top 62%, cream panel bottom, product-tile hierarchy, arrow link CTA. Used for product tiles, ecommerce placeholders.
  5. **Minimal cream** — restrained centered composition, italic serif poetry, monogram, hairline dividers. Used for all seasonal templates (Ramadan/Eid, UAE National Day, Mexican Independence).
  6. **Banner** — compact horizontal composition with side-gradient tint. Used for X headers, email headers, IAB banner units.
- Every scene tint is now a directional gradient (linear vertical or horizontal), not a flat 42% obsidian block.
- Typography is now italic serif for seasonal, upright serif for commerce, with hairline eyebrow rules and tracked micro-labels.
- Logos are placed with intentional composition — not always top-right — and paired with hairline dividers or small caps footer marks.

## Identity (unchanged from v1)
- Wordmark: **Corner** obsidian + **Mex** clay red.
- Display: Cormorant Garamond (500–600, italic for seasonal).
- Sans: Inter (400–600, tracked eyebrows 4–10).
- Palette: Clay ${CLAY}, Sage ${SAGE}, Cream ${CREAM}, Sand ${SAND}, Obsidian ${OBSIDIAN}, Ink ${INK}, Muted ${MUTED}.

## Photography direction
Editorial food photography. Warm natural light. Generous negative space. Deep chiaroscuro. Clay red + sage green + cream sand palette. Never: sombreros, moustaches, cactus cartoons, fiesta clip art, papel picado, cliché stereotypes.

## Layout usage matrix
| Family | Where | Feel |
|---|---|---|
| Editorial | Instagram, Facebook, homepage hero, Meta ads, brand intro | Aspirational, image-led, magazine |
| Split | Collection banners, category, marketplace, delivery | Modular, dual-tone, conversion-ready |
| Executive | All B2B, LinkedIn, hospitality, wholesale | Structured, credible, executive |
| Conversion | Product tiles, product placeholders | Direct, tile-shaped, arrow CTA |
| Minimal cream | Seasonal (Ramadan/Eid, UAE, Mexican Independence) | Restrained, refined, luxury |
| Banner | Thin banners, ad units, headers | Compact horizontal composition |

## Logo usage
Reserve clear space equal to letter **M**. Never rotate, skew, recolor Mex outside palette, or apply drops/gradients to the wordmark. In editorial layouts logo sits near top with generous space; in executive layouts logo sits paired with credential row.

## Copy tone
Confident, warm, understated. English primary. Selective Spanish for cultural anchors. No exaggerated claims. No unverified Arabic — leave vertical space for later RTL review.

## Export
- Every template is SVG (source of truth).
- Priority PNG previews at ≤1600px live under \`previews/\`.
- Selected assets also have WebP previews for web/social conversion use.
- For print, take SVG → PDF/X via a vector tool.
`;
  write(path.join(KIT, "guide", "brand-guide.md"), guide);

  const readme = `# CornerMex Marketing Kit — v2 Premium

Standalone premium brand and marketing package. Not imported by the CornerMex app.

## What's in v2
- \`logos/\` — 42 logo SVGs (unchanged identity: horizontal, stacked, monogram, monochrome, refined avatar).
- \`icons/\` — favicon + app icons 16→512.
- \`master-scenes/\` — 10 photos + 1 SVG texture. 6 new/regenerated premium editorial scenes + 4 retained v1 scenes.
- \`social-media/\` — Instagram, Facebook, LinkedIn, WhatsApp, X templates redesigned in v2 layouts.
- \`website/\`, \`ecommerce/\` — hero, collection, promo, OG, placeholders in v2 layouts.
- \`b2b/\` — LinkedIn hero, restaurant/retailer/hotel banners, A4 covers, proposal/presentation, trade-show, email signature — all in Executive layout.
- \`paid-ads/\` — Meta feed/story + Google Display (all IAB sizes) in Editorial / Banner layouts.
- \`marketplaces/\` — storefront hero, tiles, banners.
- \`email/\` — newsletter + signature banners.
- \`seasonal/\` — Ramadan/Eid, UAE National Day, Mexican Independence in Minimal-cream layout.
- \`previews/\` — **NEW in v2** — PNG + selective WebP raster previews of priority assets.
- \`templates/\` — copy presets + schema.
- \`guide/\` — brand guide, README, asset manifest.

## Layout system (v2)
V2 no longer relies on one photo+overlay formula. Six layout families:

1. **Editorial** (image-led, magazine feel)
2. **Split** (photo + cream panel, structured)
3. **Executive** (B2B / trade, credential row, filled CTA)
4. **Conversion** (product tile, arrow CTA)
5. **Minimal cream** (seasonal, italic serif, hairline dividers)
6. **Banner** (compact horizontal, ad units)

## Raster previews
\`previews/\` mirrors the SVG folder structure and contains PNG previews of priority assets, plus WebP for major web/social formats. Editable SVG remains the source of truth.

## Regenerate
\`\`\`
node scripts/build-cornermex-brand-kit-v2.mjs
\`\`\`

## Zip packages
- \`cornermex-marketing-kit-v1.zip\` — original v1 archive (retained).
- \`cornermex-marketing-kit-v2-premium.zip\` — v2 premium archive.

## Known limitations (v2)
- Arabic / RTL copy still not included. Vertical space reserved for later native review.
- Product placeholder still uses pantry editorial photography, not specific packaged products.
- Some tiny IAB ad units (300×250, 728×90) intentionally strip body copy and eyebrow; only headline + arrow CTA fits legibly.
- PNG previews are downscaled to ≤1600px on the long edge to keep the ZIP portable.
- Rasterization inlines referenced JPGs as base64 data URIs in the SVG before rendering, so the editable SVGs themselves still use relative paths — keep folder structure intact when moving files.
`;
  write(path.join(KIT, "guide", "README.md"), readme);

  write(path.join(KIT, "guide", "asset-manifest.json"), JSON.stringify({
    version: 2,
    generated_at: new Date().toISOString(),
    total_assets: manifest.length,
    raster_previews: rasterCount,
    tokens: { clay: CLAY, sage: SAGE, cream: CREAM, sand: SAND, obsidian: OBSIDIAN, ink: INK, muted: MUTED, display: DISPLAY, sans: SANS },
    layout_families: ["editorial", "split", "executive", "conversion", "minimal", "banner"],
    scenes_v2_new: ["pantry-editorial.jpg", "chiles-lime-macro.jpg", "shelf-assortment.jpg", "chef-hospitality.jpg", "minimal-still-life.jpg", "snacks-styled.jpg"],
    scenes_v1_retained: ["pantry.jpg", "chiles-lime-corn.jpg", "restaurant-b2b.jpg", "uae-delivery.jpg"],
    assets: manifest,
  }, null, 2));

  // copy-presets for editors
  write(path.join(KIT, "templates", "copy-presets.json"), JSON.stringify({
    version: 2,
    layouts: ["editorial", "split", "executive", "conversion", "minimal", "banner"],
    campaigns: CAMPAIGNS,
  }, null, 2));
  write(path.join(KIT, "templates", "template-schema.json"), JSON.stringify({
    version: 2,
    description: "Template schema for CornerMex v2 premium marketing SVGs.",
    fields: { layout: "editorial|split|executive|conversion|minimal|banner", w: "width px", h: "height px", scene: "master-scenes filename", eyebrow: "kicker uppercase tracked", headline: "serif headline, \\n for line break", body: "sans body 1 line", cta: "CTA label (uppercase)" },
  }, null, 2));
}

function buildZip() {
  const zipPath = path.join(KIT, "cornermex-marketing-kit-v2-premium.zip");
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  execSync(`cd "${KIT}" && zip -qr "cornermex-marketing-kit-v2-premium.zip" . -x "cornermex-marketing-kit-v1.zip" "cornermex-marketing-kit-v2-premium.zip"`, { stdio: "inherit" });
  const stat = fs.statSync(zipPath);
  console.log(`v2 ZIP: ${zipPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  console.log("Building CornerMex Marketing Kit v2 Premium…");
  ensureDir(KIT);
  writeTexture();
  buildLogos();
  const gen = buildTemplates();
  console.log(`SVG templates written: ${gen.length}`);
  const { pngN, webpN } = await rasterize(gen);
  console.log(`Previews: ${pngN} PNG, ${webpN} WebP`);
  buildDocs(pngN + webpN);
  buildZip();
  console.log(`Done. ${manifest.length} manifest entries.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
