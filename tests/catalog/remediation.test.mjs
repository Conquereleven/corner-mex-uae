import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  buildPackages,
  buildPreview,
  requirePinnedSource,
  verifyPreview,
} from "../../scripts/catalog/catalog-lib.mjs";
import {
  assertSafeMediaUrl,
  fetchMediaContent,
  validateMediaBatch,
  validateMediaContent,
} from "../../scripts/catalog/media-validation.mjs";
import { buildRollbackPreview, CANONICAL_PROJECT } from "../../scripts/catalog/rollback.mjs";
const sha = "a".repeat(40),
  checksum = "b".repeat(64),
  row = {
    source_product_id: "1",
    sku: "SKU",
    name: "Tajin",
    category: "spices",
    price_aed: "10",
    image_url: "https://example.test/a.png",
    description: "",
  };
const packs = buildPackages([row], { sourceSha: sha, sourceChecksum: checksum }),
  fresh = buildPreview(packs, "2026-07-16T00:00:00Z");
test("preview requires explicit pin and rejects unavailable commit", () => {
  assert.throws(() => requirePinnedSource({ CORNEROPS_REPO_PATH: "/tmp/nope" }), /PINNED/);
  assert.throws(
    () =>
      requirePinnedSource({
        CORNEROPS_SOURCE_SHA: "f".repeat(40),
        CORNEROPS_REPO_PATH: "/tmp/nope",
      }),
    /SOURCE_COMMIT/,
  );
});
test("fresh preview verifies and stale source dimensions fail closed", () => {
  assert.equal(verifyPreview(structuredClone(fresh), fresh, sha).verified, true);
  for (const [field, value, code] of [
    ["sourceFingerprint", "c".repeat(64), /FINGERPRINT/],
    ["sourceCommitSha", "d".repeat(40), /COMMIT/],
    ["sourceRecordCount", 2, /COUNT/],
    ["mediaManifestFingerprint", "e".repeat(64), /MEDIA_MANIFEST/],
  ]) {
    const stale = structuredClone(fresh);
    stale[field] = value;
    assert.throws(() => verifyPreview(stale, fresh, sha), code);
  }
  const stale = structuredClone(fresh);
  stale.classificationCounts.ready_to_import = 0;
  assert.throws(() => verifyPreview(stale, fresh, sha), /STALE/);
  assert.throws(() => verifyPreview(fresh, fresh, null), /PINNED/);
});
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(24)]),
  jpeg = Buffer.from([255, 216, 255, 1, 2, 3]);
test("content media validation accepts matching bytes and checksum", () => {
  const result = validateMediaContent(
    { sourceUrl: "https://example.test/a.png" },
    { bytes: png, contentType: "image/png", contentLength: png.length },
  );
  assert.equal(result.validationStatus, "validated");
});
test("media attacks fail closed", () => {
  assert.throws(() => assertSafeMediaUrl("https://example.test/a.png?X-Amz-Signature=x"), /SIGNED/);
  assert.throws(() => assertSafeMediaUrl("https://127.0.0.1/a.png"), /PRIVATE/);
  const cases = [
    () =>
      validateMediaContent(
        { sourceUrl: "https://example.test/a.png" },
        { bytes: png, contentType: "image/jpeg", contentLength: png.length },
      ),
    () =>
      validateMediaContent(
        { sourceUrl: "https://example.test/a.jpg", contentSha256: "0".repeat(64) },
        { bytes: jpeg, contentType: "image/jpeg", contentLength: jpeg.length },
      ),
    () =>
      validateMediaContent(
        { sourceUrl: "https://example.test/a.svg" },
        { bytes: Buffer.from("<svg></svg>"), contentType: "image/svg+xml", contentLength: 11 },
      ),
    () =>
      validateMediaContent(
        { sourceUrl: "https://example.test/a.png" },
        { bytes: Buffer.from("<html></html>"), contentType: "text/html", contentLength: 13 },
      ),
    () =>
      validateMediaContent(
        { sourceUrl: "https://example.test/a.png" },
        {
          bytes: Buffer.from("MZpayload"),
          contentType: "application/octet-stream",
          contentLength: 9,
        },
      ),
    () =>
      validateMediaContent(
        { sourceUrl: "https://example.test/a.png" },
        { bytes: Buffer.alloc(20), contentType: "image/png", contentLength: 20, maxBytes: 10 },
      ),
    () => validateMediaContent({ sourceUrl: "https://example.test/a.png" }, { bytes: null }),
  ];
  for (const attack of cases) assert.throws(attack);
});
test("batch records failures and never treats them as copyable", () => {
  const evidence = validateMediaBatch(
    [{ sourceUrl: "https://example.test/a.png" }, { sourceUrl: "https://example.test/b.png" }],
    (item) =>
      item.sourceUrl.endsWith("a.png")
        ? { bytes: png, contentType: "image/png", contentLength: png.length }
        : { bytes: Buffer.from("bad"), contentType: "image/png", contentLength: 3 },
  );
  assert.deepEqual([evidence.validated, evidence.failed], [1, 1]);
});
test("media loader rejects private redirects and timeouts without internet", async () => {
  const redirectResponse = {
    status: 302,
    ok: false,
    headers: new Headers({ location: "http://127.0.0.1/private.png" }),
  };
  await assert.rejects(
    fetchMediaContent(
      { sourceUrl: "https://example.test/a.png" },
      { fetchImpl: async () => redirectResponse },
    ),
    /REDIRECT_PRIVATE/,
  );
  const hangingFetch = (_url, { signal }) =>
    new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
      ),
    );
  await assert.rejects(
    fetchMediaContent(
      { sourceUrl: "https://example.test/a.png" },
      { fetchImpl: hangingFetch, timeoutMs: 5 },
    ),
    /MEDIA_TIMEOUT/,
  );
});
const fixture = {
  executions: [{ id: "A" }, { id: "B" }],
  ownership: [
    { execution_id: "A", product_id: "pA" },
    { execution_id: "B", product_id: "pB" },
  ],
  media: [
    { execution_id: "A", object_path: "a/x.png" },
    { execution_id: "B", object_path: "b/x.png" },
  ],
  reviews: [
    { execution_id: "A", id: "rA" },
    { execution_id: "B", id: "rB" },
  ],
};
test("rollback preview scopes exactly one execution and refuses canonical", () => {
  const p = buildRollbackPreview({ executionId: "A", targetProject: "ephemeral-test", ...fixture });
  assert.equal(p.mode, "synthetic_fixture_preview");
  assert.equal(p.evidenceClass, "NON_PRODUCTION_SYNTHETIC");
  assert.equal(p.realDatabaseQueried, false);
  assert.equal(p.eligibleAsExecutionEvidence, false);
  assert.deepEqual(p.productIds, ["pA"]);
  assert.deepEqual(p.objectPaths, ["a/x.png"]);
  assert.equal(p.untouched.orders, true);
  assert.throws(
    () => buildRollbackPreview({ executionId: "A", targetProject: CANONICAL_PROJECT, ...fixture }),
    /CANONICAL/,
  );
  assert.throws(
    () => buildRollbackPreview({ executionId: "unknown", targetProject: "ephemeral", ...fixture }),
    /UNKNOWN/,
  );
  const overlap = structuredClone(fixture);
  overlap.ownership.push({ execution_id: "A", product_id: "pA" });
  assert.throws(
    () => buildRollbackPreview({ executionId: "A", targetProject: "ephemeral", ...overlap }),
    /OVERLAPPING/,
  );
});

test("rollback preview command cannot be presented as execution evidence", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/catalog/catalog-rollback.mjs", "preview"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        CATALOG_IMPORT_EXECUTION_ID: "00000000-0000-4000-8000-00000000000a",
        CATALOG_ROLLBACK_TARGET_PROJECT: "ephemeral-test",
      },
    },
  );
  const preview = JSON.parse(output);
  assert.equal(preview.mode, "synthetic_fixture_preview");
  assert.equal(preview.evidenceClass, "NON_PRODUCTION_SYNTHETIC");
  assert.equal(preview.realDatabaseQueried, false);
  assert.equal(preview.eligibleAsExecutionEvidence, false);
});
