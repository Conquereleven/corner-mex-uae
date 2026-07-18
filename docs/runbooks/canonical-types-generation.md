# Canonical Types Generation

Canonical authority is Supabase project `wlrfknmrhowldygmvtvn`.

1. Generate TypeScript types using read-only Supabase tooling for that exact ref.
2. Save output outside the repository.
3. Run `CANONICAL_SUPABASE_PROJECT_REF=wlrfknmrhowldygmvtvn npm run generate:canonical-types -- --input <file>`.
4. Update the types SHA-256 and evidence in `contracts/canonical-supabase-schema-fingerprint-v1.json`.
5. Run `npm run validate:canonical-types` and `npm run validate:schema-authority`.

The generator rejects another project ref and never reads or prints database
credentials. CI validates the committed fingerprint and exact 20-table identity.
