import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERSIONS = Object.freeze({
  export: "cornerops-cornermex-catalog-export-v1",
  media: "cornerops-cornermex-media-manifest-v1",
  execution: "cornermex-catalog-import-execution-v1",
});
export const CLASSES = Object.freeze([
  "ready_to_import",
  "needs_review",
  "missing_media",
  "duplicate",
  "compliance_blocked",
  "price_blocked",
  "identity_blocked",
  "invalid_data",
  "excluded_non_catalog_record",
]);
export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
export const stable = (value) => JSON.stringify(value, Object.keys(value).sort());
export function parseCsv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i],
      n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (quoted) throw new Error("CSV_MALFORMED");
  const filtered = rows.filter((r) => r.some(Boolean)),
    header = filtered.shift() || [];
  return filtered.map((values) =>
    Object.fromEntries(header.map((key, i) => [key, values[i] ?? ""])),
  );
}
const clean = (v, max = 5000) =>
  String(v ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
const slug = (v) =>
  clean(v)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
const validMedia = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !/\.(?:exe|js|html?|svg)(?:$|\?)/i.test(u.pathname);
  } catch {
    return false;
  }
};
export function classify(rows, { sourceSha, sourceChecksum }) {
  const seen = new Map();
  return rows.map((row, index) => {
    const name = clean(row.name, 300),
      sku = clean(row.sku, 120).toUpperCase(),
      price = Number(row.price_aed),
      image = clean(row.image_url, 2048),
      identity = sha256(JSON.stringify([sku, name.toLowerCase(), clean(row.source_product_id)]));
    let classification = "ready_to_import",
      reason = null;
    if (!name || !sku) {
      classification = "identity_blocked";
      reason = "missing_name_or_sku";
    } else if (!Number.isFinite(price) || price < 0) {
      classification = "price_blocked";
      reason = "invalid_aed_price";
    } else if (!image || !validMedia(image)) {
      classification = "missing_media";
      reason = "missing_or_unsafe_media";
    } else if (seen.has(sku)) {
      classification = "duplicate";
      reason = `duplicate_sku:${seen.get(sku)}`;
    } else if (!clean(row.category)) {
      classification = "needs_review";
      reason = "missing_category";
    }
    seen.set(sku, index + 2);
    return {
      sourceRow: index + 2,
      sourceId: clean(row.source_product_id) || null,
      stableProductIdentity: identity,
      sku,
      name,
      description: clean(row.description),
      category: clean(row.category) || null,
      priceMinorAed: Number.isFinite(price) ? Math.round(price * 100) : null,
      mediaUrl: image || null,
      safeSupplierReference: "Intermex UAE",
      sourceEvidence: clean(row.matched_intermex_url) || null,
      sourceSha,
      sourceChecksum,
      classification,
      rejectionReasons: reason ? [reason] : [],
      duplicateGroup: classification === "duplicate" ? sku : null,
      publicationState: "draft",
      sellable: false,
      commercialInventory: 0,
      sourceStockIgnored: true,
    };
  });
}
export function buildPackages(rows, meta) {
  const records = classify(rows, meta),
    counts = Object.fromEntries(
      CLASSES.map((k) => [k, records.filter((r) => r.classification === k).length]),
    );
  if (Object.values(counts).reduce((a, b) => a + b, 0) !== rows.length)
    throw new Error("CLASSIFICATION_RECONCILIATION_FAILED");
  const media = records
    .filter((r) => r.mediaUrl)
    .map((r) => ({
      stableProductIdentity: r.stableProductIdentity,
      sourceUrl: r.mediaUrl,
      objectPath: `catalog/${r.stableProductIdentity}/${sha256(r.mediaUrl)}.source`,
      sourceReferenceChecksum: sha256(r.mediaUrl),
      copyStatus: "pending_manifest_validation",
    }));
  const base = {
    contractVersion: VERSIONS.export,
    sourceRepo: "Conquereleven/cornerops-ai",
    sourceRepoSha: meta.sourceSha,
    sourceChecksum: meta.sourceChecksum,
    sourceCount: rows.length,
    normalizedProductCount: records.length,
    classificationCounts: counts,
    records,
  };
  const fingerprint = sha256(JSON.stringify(base));
  return {
    catalog: { ...base, sourceFingerprint: fingerprint },
    media: {
      contractVersion: VERSIONS.media,
      sourceFingerprint: fingerprint,
      itemCount: media.length,
      items: media,
      policy: {
        mimeAllowlist: ["image/jpeg", "image/png", "image/webp"],
        maxBytes: 10485760,
        executablesRejected: true,
        pathTraversalRejected: true,
      },
    },
    fingerprint,
  };
}
export function assertSafePackage(pkg) {
  if (pkg.contractVersion !== VERSIONS.export) throw new Error("EXPORT_VERSION_MISMATCH");
  if (pkg.sourceCount !== pkg.records.length) throw new Error("SOURCE_COUNT_MISMATCH");
  for (const r of pkg.records) {
    if (r.publicationState !== "draft" || r.sellable !== false || r.commercialInventory !== 0)
      throw new Error("UNSAFE_CATALOG_RECORD");
    if (!CLASSES.includes(r.classification)) throw new Error("UNKNOWN_CLASSIFICATION");
    if (r.priceMinorAed !== null && (!Number.isInteger(r.priceMinorAed) || r.priceMinorAed < 0))
      throw new Error("INVALID_AED_MINOR_PRICE");
  }
  return true;
}
export function loadSource(sourcePath) {
  const bytes = fs.readFileSync(sourcePath);
  return { rows: parseCsv(bytes.toString("utf8")), checksum: sha256(bytes) };
}
export function resolveSource(env = process.env) {
  const repo = env.CORNEROPS_REPO_PATH || "/Users/rodrigom./cornerops-ai";
  return path.join(repo, "docs/data/cornermex-products-master-enriched-from-intermex.csv");
}
