import { createHash } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "public/brand-kit/intermex/asset-provenance.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const forbidden =
  /(?:generated|ai[-_ ]?imagery|stock[-_ ]?(?:photo|replacement)|reconstructed|invented[-_ ]?category)/i;
const errors = [];

if (manifest.manifestVersion !== "cm-intermex-brand-1-assets-v1") {
  errors.push("unexpected Intermex manifest version");
}
for (const asset of manifest.assets ?? []) {
  if (forbidden.test(`${asset.path} ${asset.sourceUrl} ${asset.sourceType}`)) {
    errors.push(`forbidden/generated asset reference: ${asset.path}`);
  }
  const filePath = resolve(root, "public/brand-kit/intermex", asset.path);
  try {
    await access(filePath);
    const digest = createHash("sha256")
      .update(await readFile(filePath))
      .digest("hex");
    if (digest !== asset.sha256) errors.push(`checksum mismatch: ${asset.path}`);
  } catch {
    errors.push(`missing asset: ${asset.path}`);
  }
}
for (const pending of manifest.awaitingOfficialAsset ?? []) {
  if (pending.status !== "awaiting_official_asset")
    errors.push(`pending asset not fail-closed: ${pending.id}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Intermex asset provenance valid (${manifest.assets.length} approved assets; ${manifest.awaitingOfficialAsset.length} pending official assets).`,
  );
}
