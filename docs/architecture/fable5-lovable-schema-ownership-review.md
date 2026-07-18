# Fable 5 Lovable Schema Ownership Review

Fable 5 found that current `main` mixed DB1 Lovable migrations/types with DB2
canonical migrations. The approved remediation preserves the eight direct
Lovable commits, moves DB1 SQL to an audited quarantine, regenerates types from
DB2 and introduces schema-authority CI.

The reviewed base is `a558785d3fc2c1eb2aa9298087bba7f940094bcb`.
The eight preserved commits are `0de7d73`, `1855dd2`, `4de6f2c`, `879da2b`,
`5fdf797`, `8512353`, `95244a8` and `a558785`.

`lovable/live` points at the audited Lovable-live tree. Retargeting Lovable's
GitHub synchronization to that branch is not verified and was not attempted.
