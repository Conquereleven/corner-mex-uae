import { assert, readJson } from "./lib.mjs";

const ENUM_FIELDS = [
  "sourceDomain",
  "targetDomain",
  "migrationDecision",
  "privacyClassification",
  "moneyStrategy",
  "timestampStrategy",
  "validationMethod",
  "rollbackTreatment",
];

export async function validateMigrationMap(options = {}) {
  const map =
    options.map ?? (await readJson("contracts/cornermex-greenfield-activation-map-v1.json"));
  const inventory =
    options.inventory ??
    (await readJson("contracts/cornermex-canonical-baseline-inventory-v1.json"));
  const schema = await readJson(
    "contracts/schemas/cornermex-greenfield-activation-map-v1.schema.json",
  );
  for (const field of schema.required) {
    assert(Object.hasOwn(map, field), `schema-required field missing: ${field}`);
  }
  assert(
    map.contractVersion === "cornermex-greenfield-activation-map-v1",
    "unexpected map contract",
  );
  assert(map.mode === "greenfield_activation", "map must be greenfield");
  assert(map.canonicalProjectRef === inventory.canonicalProjectRef, "unexpected canonical project");

  const entrySchema = schema.properties.mappings.items;
  for (const entry of map.mappings) {
    for (const field of entrySchema.required) {
      assert(Object.hasOwn(entry, field), `schema-required mapping field missing: ${field}`);
      if (!["manualReviewRequired", "blockers", "notes"].includes(field)) {
        assert(typeof entry[field] === "string" && entry[field].length > 0, `missing ${field}`);
      }
    }
    assert(entry.manualReviewRequired === true, `manual review missing for ${entry.sourceObject}`);
    assert(
      Array.isArray(entry.blockers) && Array.isArray(entry.notes),
      "blockers and notes must be arrays",
    );
    assert(entry.blockers.length === 0, `mapping contains blockers: ${entry.sourceObject}`);
    for (const field of ENUM_FIELDS) {
      const allowed = entrySchema.properties[field].enum;
      assert(allowed.includes(entry[field]), `unsupported ${field} for ${entry.sourceObject}`);
    }
  }

  const sourceObjects = map.mappings.map(({ sourceObject }) => sourceObject);
  const duplicateSources = sourceObjects.filter(
    (value, index) => sourceObjects.indexOf(value) !== index,
  );
  assert(duplicateSources.length === 0, `duplicate source objects: ${duplicateSources.join(",")}`);

  const expectedTargets = new Set([
    ...inventory.tables.map((table) => `public.${table}`),
    "auth.users",
    "storage.objects",
  ]);
  const expectedExclusions = new Set(inventory.requiredExclusionMappings);
  const canonicalTargetRows = map.mappings.filter(({ targetObject }) => targetObject !== "none");
  const targetObjects = canonicalTargetRows.map(({ targetObject }) => targetObject);
  const duplicateTargets = targetObjects.filter(
    (value, index) => targetObjects.indexOf(value) !== index,
  );
  assert(
    duplicateTargets.length === 0,
    `duplicate canonical targets: ${duplicateTargets.join(",")}`,
  );

  const coveredTargets = new Set(targetObjects.filter((target) => expectedTargets.has(target)));
  const coveredExclusions = new Set(
    map.mappings
      .filter(
        ({ sourceObject, targetObject, migrationDecision }) =>
          expectedExclusions.has(sourceObject) &&
          targetObject === "none" &&
          migrationDecision === "excluded",
      )
      .map(({ sourceObject }) => sourceObject),
  );
  const missingObjects = [
    ...[...expectedTargets].filter((target) => !coveredTargets.has(target)),
    ...[...expectedExclusions].filter((source) => !coveredExclusions.has(source)),
  ].sort();
  const unexpectedObjects = map.mappings
    .filter(({ sourceObject, targetObject }) =>
      targetObject === "none"
        ? !expectedExclusions.has(sourceObject)
        : !expectedTargets.has(targetObject),
    )
    .map(({ sourceObject, targetObject }) => `${sourceObject}->${targetObject}`)
    .sort();
  const expectedCount = expectedTargets.size + expectedExclusions.size;
  const coveredCount = coveredTargets.size + coveredExclusions.size;
  const computedCoverage = Math.floor((coveredCount / expectedCount) * 100);

  assert(missingObjects.length === 0, `missing mapping objects: ${missingObjects.join(",")}`);
  assert(
    unexpectedObjects.length === 0,
    `unexpected mapping objects: ${unexpectedObjects.join(",")}`,
  );
  assert(
    map.mappingCoveragePercent === computedCoverage,
    "declared mapping coverage differs from computed coverage",
  );
  assert(computedCoverage === 100, "computed mapping coverage must equal 100");

  return {
    status: "a3_mapping_valid",
    expectedObjects: expectedCount,
    coveredObjects: coveredCount,
    missingObjects,
    unexpectedObjects,
    duplicateObjects: [...new Set([...duplicateSources, ...duplicateTargets])],
    computedCoverage,
    declaredCoverage: map.mappingCoveragePercent,
    mappings: map.mappings.length,
    coverage: computedCoverage,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await validateMigrationMap()));
}
