const EXPECTED_PROJECT_REF = "wlrfknmrhowldygmvtvn";
const EXPECTED_GENERATION_METHOD = "canonical_supabase_read_only_generation";
const SHA256 = /^[0-9a-f]{64}$/;
const SECRET_VALUE = /(?:sb_secret_|service[_-]?role|bearer\s+[a-z0-9._-]{16,})/i;

export function validateCanonicalProvenance(contract) {
  const errors = [];
  if (contract.projectRef !== EXPECTED_PROJECT_REF) errors.push("project ref mismatch");
  if (contract.canonicalProjectRef !== EXPECTED_PROJECT_REF)
    errors.push("canonical project ref mismatch");
  if (contract.projectRef !== contract.canonicalProjectRef)
    errors.push("project ref aliases disagree");
  if (contract.generationMethod !== EXPECTED_GENERATION_METHOD)
    errors.push("unknown canonical generation method");
  if (typeof contract.generatorVersion !== "string" || !contract.generatorVersion.trim())
    errors.push("generator version missing");
  const generatedAt = new Date(contract.generatedAt);
  if (Number.isNaN(generatedAt.getTime()) || generatedAt.toISOString() !== contract.generatedAt) {
    errors.push("generated timestamp invalid");
  }
  if (!SHA256.test(contract.typesSha256 ?? "")) errors.push("types SHA-256 invalid");
  if (!SHA256.test(contract.schemaFingerprint ?? "")) errors.push("schema fingerprint invalid");
  if (contract.schemaFingerprint !== contract.schemaFingerprintSha256)
    errors.push("schema fingerprint aliases disagree");
  if (SECRET_VALUE.test(JSON.stringify(contract))) errors.push("secret-like provenance value");
  return errors;
}
