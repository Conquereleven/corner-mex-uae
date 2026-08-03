# CM-CAT-1 Wave 1 readiness matrix — internal use

This matrix is a deterministic, non-publishing review artifact. It is not an import file, catalog export, price list, stock record, supplier record, or authorization to change any commercial capability.

## Fixed shortlist

The matrix contains exactly Haiku candidates 1, 2, 3, and 9 through 20. Candidates 4–6 are excluded as duplicates. Candidates 7–8 are excluded because they are template-only examples.

Legacy demo and SEO content is quarantined in `evidence_notes`. It must never populate operative identity, supplier, commercial, availability, compliance, MOQ, margin, or media fields. `source_class` is controlled by these values:

- `verified_repo_evidence`
- `legacy_demo_reference`
- `seo_reference_only`
- `founder_required`

The current matrix uses only `legacy_demo_reference` and `seo_reference_only`; every unresolved operational decision is marked `founder_required` through `commercial_priority`.

## Truth contract

For all 15 rows:

- `cost`, `cost_currency`, `aed_price`, `availability`, `compliance_registration`, `gross_margin`, and `moq` are exactly `UNKNOWN`;
- `publish_ready` is exactly `false`;
- operative `product_name`, `brand`, `category`, `presentation`, `supplier_source`, and `media_status` are `UNKNOWN` because their only current references are demo or SEO material;
- `source_file` and `source_line_or_record` point to committed repository evidence;
- the source line must contain the row's stable candidate identifier.

## UNKNOWN counts

| Field | UNKNOWN rows |
| --- | ---: |
| cost | 15 |
| cost_currency | 15 |
| aed_price | 15 |
| availability | 15 |
| compliance_registration | 15 |
| gross_margin | 15 |
| moq | 15 |
| **Mandatory commercial UNKNOWN total** | **105** |

Additional conservative UNKNOWN fields: `product_name`, `brand`, `category`, `presentation`, `supplier_source`, and `media_status` each have 15 UNKNOWN rows.

## Local validation

```bash
npm run validate:cm-cat-1
npm run test:cm-cat-1
```

The validator reads only local committed files. It performs no network request, database connection, import, mutation, or publication. Updating a row requires primary evidence, a provenance update, and the appropriate Founder decision; the current Wave 1 contract still forbids `publish_ready=true`.
