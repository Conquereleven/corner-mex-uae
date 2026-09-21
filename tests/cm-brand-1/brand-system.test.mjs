// CornerMex Brand System 1.0 (Founder brand decision, 2026-09-20).
//
// These guards protect the two things that are easy to lose: the palette's
// accessibility, and the centralisation that makes a future brand change one
// edit instead of a hunt through components.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const tokens = await import("../../src/config/brand-tokens.ts");
const brand = await import("../../src/config/brand.ts");

const { CORNERMEX_PALETTE, CORNERMEX_LIGHT, CORNERMEX_DARK, CONTRAST_CONTRACT, contrastRatio } =
  tokens;

test("the core palette is exactly the three founder colours", () => {
  assert.equal(CORNERMEX_PALETTE.arenaBeige.hex, "#D8C3A5");
  assert.equal(CORNERMEX_PALETTE.sunsetOrange.hex, "#E77B30");
  assert.equal(CORNERMEX_PALETTE.black.hex, "#111111");
  const core = Object.entries(CORNERMEX_PALETTE)
    .filter(([, c]) => c.role === "core")
    .map(([name]) => name);
  assert.deepEqual(core.sort(), ["arenaBeige", "black", "sunsetOrange"]);
});

test("the supporting neutrals are the approved ones", () => {
  assert.equal(CORNERMEX_PALETTE.warmIvory.hex, "#F7F2EB");
  assert.equal(CORNERMEX_PALETTE.sandLight.hex, "#E9DDCC");
  assert.equal(CORNERMEX_PALETTE.charcoal.hex, "#2A2A2A");
  assert.equal(CORNERMEX_PALETTE.softBorder.hex, "#D7C9B8");
});

test("the retired clay/sage palette cannot come back through the brand config", () => {
  const retired = [/#B4362B/i, /#3E7A54/i, /#2A2622/i, /#F8F3E8/i];
  const values = JSON.stringify([CORNERMEX_PALETTE, brand.ACTIVE_BRAND.colors]);
  for (const pattern of retired)
    assert.doesNotMatch(values, pattern, `retired colour ${pattern} is back in the brand system`);
  assert.deepEqual(Object.keys(brand.ACTIVE_BRAND.colors).sort(), [
    "arenaBeige",
    "black",
    "sunsetOrange",
  ]);
});

test("every enforced contrast pair still passes", () => {
  for (const pair of CONTRAST_CONTRACT) {
    const ratio = contrastRatio(
      CORNERMEX_PALETTE[pair.foreground].hex,
      CORNERMEX_PALETTE[pair.background].hex,
    );
    assert.ok(
      ratio >= pair.minimum,
      `${pair.what}: ${pair.foreground} on ${pair.background} is ${ratio.toFixed(2)}:1, needs ${pair.minimum}`,
    );
  }
});

test("the primary CTA never carries a white label", () => {
  // White on Sunset Orange is 2.89:1. This is the mistake the palette invites.
  assert.ok(contrastRatio("#FFFFFF", CORNERMEX_PALETTE.sunsetOrange.hex) < 4.5);
  for (const theme of [CORNERMEX_LIGHT, CORNERMEX_DARK]) {
    const label = CORNERMEX_PALETTE[theme.ctaPrimaryText].hex;
    for (const state of ["ctaPrimary", "ctaPrimaryHover", "ctaPrimaryActive"]) {
      const ratio = contrastRatio(label, CORNERMEX_PALETTE[theme[state]].hex);
      assert.ok(ratio >= 4.5, `${state} label is ${ratio.toFixed(2)}:1`);
    }
  }
});

test("base Sunset Orange is never a text token", () => {
  // It is 2.59:1 on the page; emberInk is the readable orange.
  for (const theme of [CORNERMEX_LIGHT]) {
    for (const token of ["text", "textMuted", "eyebrowText", "saleColor", "priceColor"]) {
      assert.notEqual(
        theme[token],
        "sunsetOrange",
        `${token} must not be base Sunset Orange; use emberInk`,
      );
    }
  }
});

test("the generated stylesheet matches the token module", async () => {
  // Fails if someone edited src/styles/brand-tokens.css by hand, or changed the
  // tokens without running `npm run brand:css`.
  await run(process.execPath, ["scripts/brand/generate-brand-css.mjs", "--check"]);
});

test("the stylesheet holds no literal colour of its own", async () => {
  const css = await readFile("src/styles.css", "utf8");
  const literals = css.match(/#[0-9A-Fa-f]{6}\b|oklch\(\s*[\d.]+/g) ?? [];
  assert.deepEqual(literals, [], `src/styles.css must reference tokens only, found: ${literals}`);
});

test("public components do not hardcode colour", async () => {
  // Seller and admin surfaces are excluded: a seller's storefront theme picker
  // legitimately holds colour values, and those are the seller's data, not
  // CornerMex's brand.
  const offenders = [];
  for (const dir of ["src/components/site", "src/routes"]) {
    for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !/\.tsx$/.test(entry.name)) continue;
      const file = `${entry.parentPath ?? dir}/${entry.name}`;
      if (file.includes("_authenticated")) continue;
      const source = await readFile(file, "utf8");
      // A bare hex in markup means a colour that no token controls.
      for (const match of source.matchAll(/#[0-9A-Fa-f]{6}\b/g))
        offenders.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], `hardcoded colours: ${offenders.join(", ")}`);
});

test("the storefront no longer ships Intermex-named surface classes", async () => {
  const css = await readFile("src/styles.css", "utf8");
  assert.doesNotMatch(css, /\.intermex-/, "storefront surface classes must be CornerMex's");
  assert.match(css, /\.cornermex-header/);
  assert.match(css, /\.cornermex-footer/);
});

test("the logo variant is chosen per surface, never the retired full-colour mark", () => {
  const { logos } = brand.ACTIVE_BRAND.assets;
  assert.deepEqual(Object.keys(logos).sort(), ["onBeige", "onDark", "onIvory", "onSunset"]);
  for (const [surface, asset] of Object.entries(logos)) {
    assert.equal(asset.sourceType, "cornermex-brand-kit");
    assert.doesNotMatch(asset.src, /full-color/, `${surface} must not use the clay-red mark`);
    assert.doesNotMatch(asset.src, /intermex/i);
  }
  // Warm and orange surfaces take the black mark; dark surfaces take the light one.
  for (const surface of ["onIvory", "onBeige", "onSunset"])
    assert.match(logos[surface].src, /mono-black|charcoal/);
  assert.match(logos.onDark.src, /cream|mono-white|reversed/);
});

test("every brand asset exists on disk", async () => {
  const { access } = await import("node:fs/promises");
  const { logos, hero, collections } = brand.ACTIVE_BRAND.assets;
  for (const asset of [...Object.values(logos), hero, ...Object.values(collections)])
    await access(`public${asset.src}`);
});

test("category tiles stay small, so the brand work did not cost mobile payload", async () => {
  const { stat } = await import("node:fs/promises");
  for (const [slug, asset] of Object.entries(brand.ACTIVE_BRAND.assets.collections)) {
    assert.match(asset.src, /\/master-scenes\/tiles\//, `${slug} must use the tile derivative`);
    const { size } = await stat(`public${asset.src}`);
    assert.ok(size < 200 * 1024, `${slug} tile is ${Math.round(size / 1024)} KB`);
  }
});

test("transactional email and the error page read the same tokens", async () => {
  for (const file of ["src/lib/email-templates.ts", "src/lib/error-page.ts"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /brand-tokens/, `${file} must derive its colours from the token module`);
    const literals = (source.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).filter(
      (hex) => !/^#f{6}$/i.test(hex) && !/^#0{6}$/i.test(hex),
    );
    assert.deepEqual(literals, [], `${file} still hardcodes ${literals.join(", ")}`);
  }
});

test("Intermex stays a supplier and never returns as public branding", async () => {
  // Deliberately narrow: supplier data and persisted identifiers are legitimate.
  const source = await readFile("src/config/brand.ts", "utf8");
  assert.equal(brand.ACTIVE_BRAND.displayName, "CornerMex");
  assert.doesNotMatch(source, /Del barrio|Tradition you can taste/i);
  assert.doesNotMatch(source, /brand-kit\/intermex/);
});
