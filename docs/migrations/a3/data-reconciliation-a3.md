# Data Reconciliation A3

## Greenfield Baseline

Expected canonical counts before activation are zero for Auth, Storage and all business domains. The live clean-state evidence is committed without credentials or PII.

## Rehearsal Checks

- deterministic output checksum;
- repeated-run idempotency;
- unique synthetic SKU;
- no orphan product/category, variant/product or inventory/variant relation;
- AED monetary total in integer minor units;
- zero synthetic commercial inventory;
- zero customer, order, payment and review rows;
- no stock-50 or planning-stock-100 input.

Any future approved data load must add row counts, duplicate/orphan checks, monetary totals, inventory totals, timestamp ranges and content checksums before activation. A mismatch tolerance for counts and identities is zero; monetary tolerance defaults to zero minor units unless an independently reviewed processor reconciliation requires otherwise.
