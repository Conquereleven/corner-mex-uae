export const APPLICATION_REFERENCE_CLASSIFICATIONS = Object.freeze([
  "canonical_supported",
  "lovable_live_only",
  "requires_future_migration",
]);

const BASE_COUNTS = Object.freeze({
  canonical_supported: 21,
  lovable_live_only: 21,
  requires_future_migration: 2,
});
const COMBINED_COUNTS = Object.freeze({
  canonical_supported: 21,
  lovable_live_only: 19,
  requires_future_migration: 18,
});

export function expandApplicationSchemaReferenceContract(base, extensions) {
  const combined = structuredClone(base);
  const references = combined.references ?? [];
  const byIdentity = new Map(
    references.map((reference) => [`${reference.kind}:${reference.name}`, reference]),
  );

  for (const removal of extensions?.fileRemovals ?? []) {
    const identity = `${removal.kind}:${removal.name}`;
    const reference = byIdentity.get(identity);
    if (!reference) throw new Error(`schema reference removal target missing: ${identity}`);
    const removedFiles = new Set(removal.files ?? []);
    reference.files = (reference.files ?? []).filter((file) => !removedFiles.has(file));
  }

  for (let index = references.length - 1; index >= 0; index -= 1) {
    const reference = references[index];
    if ((reference.files ?? []).length > 0) continue;
    byIdentity.delete(`${reference.kind}:${reference.name}`);
    references.splice(index, 1);
  }

  for (const addition of extensions?.fileAdditions ?? []) {
    const identity = `${addition.kind}:${addition.name}`;
    const reference = byIdentity.get(identity);
    if (!reference) throw new Error(`schema reference extension target missing: ${identity}`);
    reference.files = [...new Set([...(reference.files ?? []), ...(addition.files ?? [])])].sort();
  }

  for (const reference of extensions?.newReferences ?? []) {
    const identity = `${reference.kind}:${reference.name}`;
    if (byIdentity.has(identity))
      throw new Error(`duplicate schema reference extension: ${identity}`);
    const next = {
      ...structuredClone(reference),
      files: [...new Set(reference.files ?? [])].sort(),
    };
    references.push(next);
    byIdentity.set(identity, next);
  }

  return combined;
}

export function validateApplicationSchemaReferenceExtensions(base, extensions) {
  const errors = [];
  if (!extensions || extensions.contractVersion !== "application-schema-reference-extensions-v1") {
    return ["application reference extension contract version mismatch"];
  }
  if (extensions.canonicalProjectRef !== "wlrfknmrhowldygmvtvn")
    errors.push("application reference extension project mismatch");
  if (extensions.baseContractVersion !== base.contractVersion)
    errors.push("application reference extension base mismatch");

  const allowed = new Set(APPLICATION_REFERENCE_CLASSIFICATIONS);
  const extensionIdentities = new Set();
  const baseReferences = base.references ?? [];
  const baseIdentities = new Set(
    baseReferences.map((reference) => `${reference.kind}:${reference.name}`),
  );
  const baseByIdentity = new Map(
    baseReferences.map((reference) => [`${reference.kind}:${reference.name}`, reference]),
  );

  for (const removal of extensions.fileRemovals ?? []) {
    const identity = `${removal.kind}:${removal.name}`;
    const reference = baseByIdentity.get(identity);
    if (!reference) errors.push(`schema reference removal target missing: ${identity}`);
    if (!Array.isArray(removal.files) || removal.files.length === 0) {
      errors.push(`schema reference removal files missing: ${identity}`);
      continue;
    }
    for (const file of removal.files) {
      if (!reference?.files?.includes(file)) {
        errors.push(`schema reference removal file missing from base: ${identity}:${file}`);
      }
    }
  }

  for (const addition of extensions.fileAdditions ?? []) {
    const identity = `${addition.kind}:${addition.name}`;
    if (!baseIdentities.has(identity))
      errors.push(`schema reference extension target missing: ${identity}`);
    if (!Array.isArray(addition.files) || addition.files.length === 0)
      errors.push(`schema reference extension files missing: ${identity}`);
  }
  for (const reference of extensions.newReferences ?? []) {
    const identity = `${reference.kind}:${reference.name}`;
    if (baseIdentities.has(identity) || extensionIdentities.has(identity))
      errors.push(`duplicate schema reference extension: ${identity}`);
    extensionIdentities.add(identity);
    if (!allowed.has(reference.classification))
      errors.push(`invalid extension classification: ${identity}`);
    if (!Array.isArray(reference.files) || reference.files.length === 0)
      errors.push(`schema reference extension files missing: ${identity}`);
    if (reference.classification !== "requires_future_migration")
      errors.push(`unapplied schema extension must require future migration: ${identity}`);
    if (reference.rationale !== "owned_by_unapplied_canonical_migration")
      errors.push(`unapplied schema extension rationale mismatch: ${identity}`);
  }
  return errors;
}

export function validateApplicationSchemaReferenceContract(contract) {
  const errors = [];
  if (contract.contractVersion !== "application-schema-reference-baseline-v1")
    errors.push("application reference contract version mismatch");
  if (contract.canonicalProjectRef !== "wlrfknmrhowldygmvtvn")
    errors.push("application reference project mismatch");
  if (!Array.isArray(contract.references)) return [...errors, "references missing"];
  const allowed = new Set(APPLICATION_REFERENCE_CLASSIFICATIONS);
  const identities = new Set();
  const counts = Object.fromEntries(
    APPLICATION_REFERENCE_CLASSIFICATIONS.map((value) => [value, 0]),
  );
  for (const reference of contract.references) {
    const identity = `${reference.kind}:${reference.name}`;
    if (identities.has(identity)) errors.push(`duplicate reference: ${identity}`);
    identities.add(identity);
    if (!allowed.has(reference.classification)) {
      errors.push(`invalid or unreachable classification: ${identity}`);
    } else {
      counts[reference.classification] += 1;
    }
  }

  const isCombined = identities.has("function:admin_import_product_row_v1");
  const expectedCount = isCombined ? 58 : 44;
  const expectedCounts = isCombined ? COMBINED_COUNTS : BASE_COUNTS;
  if (contract.references.length !== expectedCount) errors.push("reference count mismatch");
  for (const [classification, expected] of Object.entries(expectedCounts)) {
    if (counts[classification] !== expected)
      errors.push(`${classification} count mismatch: ${counts[classification]}`);
  }
  return errors;
}
