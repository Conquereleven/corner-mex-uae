# CM-CAT-1 — Wave 1 Catalog Readiness

## Objective

Build a verified commercial-readiness matrix for an initial wave of 15 to 20 CornerMex SKUs without importing, publishing or mutating remote catalog data.

## Base

- Repository: `Conquereleven/corner-mex-uae`
- Base branch: `main`
- Base commit: `d9f7f47155a12c1d3cc7efe25b3fc4a0e9c33480`
- Working branch: `feature/cm-cat-1-wave-1-catalog-readiness`

## Agent routing

- ChatGPT 5.6 Thinking: prioritization, data-contract control and Founder decision queue.
- Claude Haiku: rapid inventory of repository-local catalog evidence and candidate SKU extraction.
- Codex: deterministic matrix generation, validation scripts, tests and repository integration.
- Claude Code with Opus 5: data provenance, safety and publication-gate review.
- Claude Sonnet: exact-delta review after the shortlist and tooling are frozen.
- `cornermexuae-netizen`: independent GitHub approval on the final exact head.
- Fable 5: not available and excluded from this sprint.

## Allowed evidence sources

- repository CSV, JSON, TypeScript seed data and fixtures;
- catalog export artifacts already committed;
- migration and schema documentation;
- existing product images and metadata;
- previously approved local documentation.

No remote Supabase, Railway, marketplace or supplier write is authorized.

## Required fields

- SKU or stable candidate identifier;
- product name;
- brand;
- category;
- presentation or pack size;
- supplier/source;
- supplier cost with currency, when evidenced;
- proposed or existing AED price, when evidenced;
- gross margin, only when both cost and price are verified;
- availability status;
- MOQ or wholesale rule;
- compliance/registration status;
- media status;
- commercial priority;
- blocker;
- next action;
- `source_file`;
- `source_line_or_record`.

## Truth rules

- Use `UNKNOWN` when evidence is missing.
- Never infer stock, cost, price, registration, halal status, delivery time or margin.
- A candidate may be shortlisted while still blocked, but it must not be marked publish-ready.
- The matrix is an internal readiness artifact, not a remote catalog import.

## Expected outputs

- `docs/catalog/CM-CAT-1_WAVE_1_READINESS.csv` with 15 to 20 evidence-backed candidate rows;
- a machine-readable schema or validator for required fields and provenance;
- `docs/catalog/CM-CAT-1_WAVE_1_DECISIONS.md` listing Founder decisions and missing evidence;
- tests that fail on invented numeric values, missing provenance or invalid readiness states.

## Excluded

- merge;
- remote catalog import or publication;
- Supabase writes or migrations;
- A3.2b execution;
- product registration submission;
- inventory synchronization;
- price activation;
- checkout, payments, marketplace or messaging activation;
- DNS or production deployment.

## Required gates

1. Haiku inventory report from repository-local sources.
2. Codex implementation and deterministic validation.
3. All required CI checks green.
4. Claude Code Opus 5 provenance and safety review.
5. Founder approval of the shortlist and unresolved decisions.
6. Sonnet exact-delta review.
7. `cornermexuae-netizen` approval.
8. Separate Founder merge authorization.

## Definition of Done

- 15 to 20 candidates are traceable to repository evidence;
- every unknown remains explicit;
- no remote data was read or written unless separately authorized;
- no product is represented as sellable without availability and compliance evidence;
- Founder has a short, actionable decision list for pricing, supplier confirmation and registration;
- exact-head evidence and review packet are complete.
