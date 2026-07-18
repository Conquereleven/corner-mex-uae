import fs from "node:fs";
import path from "node:path";
import { assertSafeMediaUrl } from "./media-validation.mjs";
const file = path.resolve(".artifacts/catalog-import-preview.json");
if (!fs.existsSync(file)) throw new Error("PREVIEW_ARTIFACT_MISSING");
const preview = JSON.parse(fs.readFileSync(file));
let failed = 0;
const items = preview.media.items.map((item) => {
  try {
    assertSafeMediaUrl(item.sourceUrl);
    return {
      ...item,
      validationStatus: "deferred",
      reason: "live_content_validation_requires_explicit_pre_execution_mode",
    };
  } catch (error) {
    failed++;
    return { ...item, validationStatus: "failed", errorCode: error.message };
  }
});
if (failed) throw new Error(`MEDIA_REFERENCE_VALIDATION_FAILED:${failed}`);
const evidence = {
  contractVersion: "cornermex-media-validation-evidence-v1",
  generatedAt: new Date().toISOString(),
  sourceFingerprint: preview.sourceFingerprint,
  total: items.length,
  validated: 0,
  deferred: items.length,
  failed,
  items,
  writes: false,
};
const evidencePath = path.resolve(".artifacts/catalog-media-validation-evidence.json");
fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ contractVersion: evidence.contractVersion, sourceFingerprint: evidence.sourceFingerprint, total: evidence.total, validated: evidence.validated, deferred: evidence.deferred, failed: evidence.failed, evidencePath, writes: false }, null, 2)}\n`,
);
