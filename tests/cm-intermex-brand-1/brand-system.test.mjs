// Founder decision 2026-09-19: CornerMex = public brand, RodMor TradeCo LLC =
// seller of record, Intermex = supplier only. This file previously pinned the
// Intermex Brand Book (workstream CM-INTERMEX-BRAND-1); it keeps its path for CI
// and now pins the CornerMex brand and legal identity.
import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const { ACTIVE_BRAND, CORNERMEX_BRAND } = await import("../../src/config/brand.ts");
const identity = await import("../../src/lib/business-identity.ts");

test("the active storefront brand is CornerMex with the brand-kit palette", () => {
  assert.equal(ACTIVE_BRAND, CORNERMEX_BRAND);
  assert.equal(ACTIVE_BRAND.displayName, "CornerMex");
  // public/brand-kit/guide/brand-guide.md: Clay #B4362B, Sage #3E7A54, Cream #F8F3E8, Obsidian #2A2622
  assert.deepEqual(ACTIVE_BRAND.colors, {
    structuralRed: "#B4362B",
    cream: "#F8F3E8",
    moleBrown: "#2A2622",
    verdeJalapeno: "#3E7A54",
  });
});

test("every brand asset is a CornerMex kit file that exists on disk", async () => {
  const { logo, hero, collections } = ACTIVE_BRAND.assets;
  for (const asset of [logo, hero, ...Object.values(collections)]) {
    assert.equal(asset.sourceType, "cornermex-brand-kit");
    assert.match(asset.src, /^\/brand-kit\//);
    assert.doesNotMatch(asset.src, /intermex/i);
    await access(`public${asset.src}`);
  }
});

test("homepage category tiles only use slugs the brand provides imagery for", async () => {
  const home = await readFile("src/routes/index.tsx", "utf8");
  const block = home.slice(home.indexOf("const items = ["), home.indexOf("] as const;"));
  const slugs = [...block.matchAll(/\["([a-z-]+)",/g)].map((m) => m[1]);
  assert.ok(slugs.length >= 6);
  for (const slug of slugs)
    assert.ok(slug in ACTIVE_BRAND.assets.collections, `no image for ${slug}`);
  assert.doesNotMatch(block, /from-our-production|Intermex/);
});

test("RodMor TradeCo LLC is the seller of record; CornerMex is its trading brand", () => {
  const b = identity.BUSINESS_IDENTITY;
  assert.equal(b.brandName, "CornerMex");
  assert.equal(b.legalEntity, "RodMor TradeCo LLC");
  assert.equal(b.merchantOfRecord, b.legalEntity);
  assert.equal(identity.sellerOfRecordLine(), "Sold by RodMor TradeCo LLC, trading as CornerMex");
  assert.match(
    identity.businessIdentityLine(),
    /^CornerMex, a trading brand of RodMor TradeCo LLC/,
  );
});

test("every seller-of-record statement in the legal documents names RodMor", async () => {
  const legal = await readFile("src/lib/legal-docs.ts", "utf8");
  const statements = legal.split("\n").filter((line) => /seller of record/i.test(line));
  assert.ok(statements.length >= 5);
  for (const line of statements) {
    assert.match(
      line,
      /\$\{LEGAL_ENTITY_NAME\}/,
      `seller of record not named as the legal entity: ${line.trim()}`,
    );
    assert.doesNotMatch(line, /Intermex (is|acts as|remains) the seller/);
  }
  assert.match(legal, /sellerOfRecord: BUSINESS_IDENTITY\.merchantOfRecord/);
});

test("Intermex is registered as a supplier entity, never as the merchant", () => {
  const supplier = identity.SUPPLIER_ENTITIES.find((s) => /Intermex/.test(s.name));
  assert.ok(supplier, "Intermex supplier entity must stay recorded");
  assert.equal(supplier.role, "supplier");
  assert.notEqual(supplier.name, identity.BUSINESS_IDENTITY.merchantOfRecord);
});

test("persisted compatibility identifiers are unchanged", async () => {
  const [op, confirmed, po] = await Promise.all([
    readFile("src/lib/checkout-operation.ts", "utf8"),
    readFile("src/routes/order-confirmed.tsx", "utf8"),
    readFile("src/lib/po/domain.ts", "utf8"),
  ]);
  for (const source of [op, confirmed]) {
    assert.match(source, /`intermex-card-operation:\$\{/);
    assert.match(source, /`intermex-checkout:\$\{/);
  }
  assert.match(po, /PO_VERSION = "intermex-po-v1"/);
});

test("the Intermex verbal territory is not used by the CornerMex storefront", async () => {
  // "Del barrio pa'l mundo" and "Tradition you can taste" are Intermex Brand
  // Book lines (GitHub issue #70). They were hardcoded in the storefront and are
  // not CornerMex's to use.
  const { readdir } = await import("node:fs/promises");
  const roots = ["src/routes", "src/components/site", "src/lib"];
  const offenders = [];
  for (const dir of roots) {
    for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
      const file = `${entry.parentPath ?? dir}/${entry.name}`;
      const source = await readFile(file, "utf8");
      if (/Del barrio|Tradition you can taste/i.test(source)) offenders.push(file);
    }
  }
  assert.deepEqual(offenders, [], `Intermex verbal territory in: ${offenders.join(", ")}`);
});

test("the header uses the light mark, because its band is the brand red", async () => {
  const header = await readFile("src/components/site/Header.tsx", "utf8");
  const logos = header.match(/<BrandLogo[^>]*/g) ?? [];
  assert.ok(logos.length > 0, "the header must show the brand mark");
  for (const tag of logos) assert.match(tag, /reversed/, `dark-on-red contrast: ${tag}`);
  assert.match(ACTIVE_BRAND.assets.logoReversed.src, /cream|reversed|mono-white/);
});

test("category tiles use the small derivatives, not the full-size master scenes", async () => {
  const { stat } = await import("node:fs/promises");
  for (const [slug, asset] of Object.entries(ACTIVE_BRAND.assets.collections)) {
    assert.match(asset.src, /\/master-scenes\/tiles\//, `${slug} must use the tile derivative`);
    const { size } = await stat(`public${asset.src}`);
    assert.ok(size < 200 * 1024, `${slug} tile is ${Math.round(size / 1024)} KB; keep tiles small`);
  }
});
