import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Intermex brand config preserves Brand Book 2025 authority", async () => {
  const source = await readFile("src/config/brand.ts", "utf8");
  assert.match(source, /moleBrown: "#6e441d"/);
  assert.match(source, /verdeJalapeno: "#2d9849"/);
  assert.match(source, /Del barrio pa’l mundo/);
  assert.match(source, /Tradition you can taste/);
});

test("Intermex asset manifest is provenance-backed and fail-closed for pending IP", async () => {
  const manifest = JSON.parse(
    await readFile("public/brand-kit/intermex/asset-provenance.json", "utf8"),
  );
  assert.ok(manifest.assets.length >= 9);
  assert.ok(manifest.assets.every((asset) => asset.sourceType === "official-live-site"));
  assert.ok(
    manifest.awaitingOfficialAsset.some(
      (asset) => asset.id === "juan-mascot" && asset.status === "awaiting_official_asset",
    ),
  );
});

test("storefront components use semantic Intermex brand variables", async () => {
  const [layout, card, home] = await Promise.all([
    readFile("src/components/site/SiteLayout.tsx", "utf8"),
    readFile("src/components/site/ProductCard.tsx", "utf8"),
    readFile("src/routes/index.tsx", "utf8"),
  ]);
  assert.match(layout, /brandCssVariables/);
  assert.match(card, /var\(--brand-mole-brown\)/);
  assert.match(home, /INTERMEX_BRAND/);
});
