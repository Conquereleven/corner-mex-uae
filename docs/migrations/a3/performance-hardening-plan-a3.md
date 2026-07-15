# Performance Hardening Plan A3

No performance migration is applied in A3.1.

## Classification

- `must_fix_before_data_load`: none proven.
- `must_fix_before_cutover`: RLS init-plan findings must be reviewed and corrected if staging measurements show row-scale cost; overlapping permissive policies must receive a security-equivalence review.
- `safe_to_defer`: unindexed foreign keys that are not on a demonstrated delete/update path.
- `expected_on_empty_baseline`: all unused-index findings.
- `false_positive_or_not_applicable`: none declared without evidence.
- `needs_measurement`: foreign-key indexes, RLS init plans and multiple permissive policies.

Proposed changes must be generated as separate reviewed migrations after representative synthetic load/query plans exist. Removing unused indexes from an empty database is prohibited because absence of usage is not evidence of future uselessness.
