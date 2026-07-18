export const APPLICATION_REFERENCE_CLASSIFICATIONS = Object.freeze([
  "canonical_supported",
  "lovable_live_only",
  "requires_future_migration",
]);

const EXPECTED_COUNTS = Object.freeze({
  canonical_supported: 16,
  lovable_live_only: 25,
  requires_future_migration: 2,
});

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
  if (contract.references.length !== 43) errors.push("reference count mismatch");
  for (const [classification, expected] of Object.entries(EXPECTED_COUNTS)) {
    if (counts[classification] !== expected)
      errors.push(`${classification} count mismatch: ${counts[classification]}`);
  }
  return errors;
}
