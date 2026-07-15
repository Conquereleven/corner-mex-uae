# Greenfield-to-Canonical Mapping A3.1

The machine contract is `contracts/cornermex-active-to-target-migration-map-v1.json`. Because the legacy source is retired, every domain has one explicit decision:

- `initialize_empty`: target structure exists; no rows are fabricated.
- `new_enrollment_only`: identities/customers are created only through approved future user flows.
- `runtime_only`: carts and bounded analytics are created only by the future accepted runtime.
- `excluded`: legacy marketplace and planning-only concepts never enter commerce.

Products, categories, translations, images, variants, commercial inventory, customers, orders, order items, payments, reviews, Auth and Storage are covered. Money uses AED integer minor units without FX. IDs are new canonical IDs; synthetic rehearsal IDs are deterministic and never persisted. Parent rows must validate before children.

Coverage is 100% across the 25 declared domains. This is activation coverage, not evidence of migrated production records.
