// Generates src/styles/brand-tokens.css from src/config/brand-tokens.ts.
//
// CSS cannot import TypeScript, so the stylesheet is generated instead of
// hand-maintained. `npm run brand:css` writes it; `npm run brand:css -- --check`
// fails if the committed file has drifted, which is what keeps the TypeScript
// module authoritative.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const source = await readFile(path.join(root, "src/config/brand-tokens.ts"), "utf8");

// The module is parsed rather than imported so this script stays dependency
// free and runs before any build step.
function palette() {
  const block = source.slice(
    source.indexOf("export const CORNERMEX_PALETTE"),
    source.indexOf("} as const satisfies"),
  );
  const entries = new Map();
  for (const match of block.matchAll(
    /(\w+):\s*\{\s*hex:\s*"(#[0-9A-Fa-f]{6})",\s*oklch:\s*"([^"]+)"/g,
  )) {
    entries.set(match[1], { hex: match[2], oklch: match[3] });
  }
  return entries;
}

function theme(name) {
  const start = source.indexOf(`export const ${name}`);
  const block = source.slice(start, source.indexOf("\n};", start));
  const entries = new Map();
  for (const match of block.matchAll(/^\s{2}(\w+):\s*"(\w+)",/gm)) entries.set(match[1], match[2]);
  return entries;
}

const COLORS = palette();
const LIGHT = theme("CORNERMEX_LIGHT");
const DARK = theme("CORNERMEX_DARK");
if (!COLORS.size || !LIGHT.size || !DARK.size) throw new Error("BRAND_TOKENS_UNPARSEABLE");

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function declarations(tokens, indent = "  ") {
  const lines = [];
  for (const [token, key] of tokens) {
    const color = COLORS.get(key);
    if (!color) throw new Error(`BRAND_TOKEN_UNKNOWN_COLOR:${token}=${key}`);
    lines.push(`${indent}--cm-${kebab(token)}: ${color.oklch}; /* ${key} ${color.hex} */`);
  }
  return lines.join("\n");
}

function paletteDeclarations() {
  return [...COLORS]
    .map(([key, color]) => `  --cm-palette-${kebab(key)}: ${color.oklch}; /* ${color.hex} */`)
    .join("\n");
}

const output = `/*
 * GENERATED FILE — do not edit.
 *
 * Source of truth: src/config/brand-tokens.ts
 * Regenerate with: npm run brand:css
 *
 * The CornerMex palette: Arena Beige, Sunset Orange and Black, plus the
 * supporting neutrals that usability requires. See
 * docs/cornermex-2/BRAND-SYSTEM.md for the usage rules.
 */

:root {
${paletteDeclarations()}

${declarations(LIGHT)}
}

.dark {
${declarations(DARK)}
}
`;

const outputPath = path.join(root, "src/styles/brand-tokens.css");
if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== output) {
    console.error("BRAND_CSS_DRIFT: src/styles/brand-tokens.css is not what the tokens produce");
    console.error("Run: npm run brand:css");
    process.exit(1);
  }
  console.log(`brand css in sync: ${COLORS.size} palette colours, ${LIGHT.size} tokens per theme`);
} else {
  await writeFile(outputPath, output);
  console.log(`brand css written: ${COLORS.size} palette colours, ${LIGHT.size} tokens per theme`);
}
