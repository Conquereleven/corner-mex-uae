# Founder Decision Addendum

## Interim Custody of Lovable Cloud DB1 Live Data

**Decision ID:** FD-CM-LOVABLE-DB1-CUSTODY-001
**Status:** APPROVED
**Owner:** Joel / Founder
**Effective immediately:** Yes
**Related decisions:** FD-CM-LOVABLE-GOV-001, FD-CM-A3.2B-EXEC-001

## Verified live state at decision time

Lovable Cloud DB1 supports the currently published Lovable storefront.

Verified inventory:

```text
150 products
4 orders
7 Auth users
1 seller
```

## Interim custody decision

1. Lovable Cloud DB1 is designated `live_legacy_production` until an explicit DNS/cutover decision replaces it.
2. Joel / Founder is the business-data custodian.
3. The data must be preserved intact.
4. No bulk migration, archival deletion, discard, reset, destructive cleanup or decommission is authorized by this decision.
5. DB1 remains operationally separate from canonical CornerMex DB2.
6. Repository migrations for DB1 remain quarantined under `supabase/legacy-lovable/`.
7. DB1 records must not be copied into CornerOps.
8. Any future migration to DB2 requires:
   - a separately reviewed mapping;
   - privacy classification;
   - order/user handling plan;
   - reconciliation;
   - rollback;
   - founder authorization.
9. Before any future cutover or decommission:
   - create an immutable export or snapshot;
   - reconcile products, orders, users and seller records;
   - confirm custody and retention obligations;
   - complete independent Opus review.
10. Final disposition remains deferred and must be selected later from:
    - selective migration;
    - retained archive;
    - controlled decommission after verified migration.

## Current authorization boundary

This decision documents custody and preservation only.

It does not authorize:

- direct DB1 writes;
- customer-data migration;
- user migration;
- order migration;
- deletion;
- DNS cutover;
- public launch of DB2;
- checkout or payment changes;
- Lovable disconnect or freeze.

## Repository placement

Store at:

```text
docs/engineering-playbook/founder-decisions/FD-CM-LOVABLE-DB1-CUSTODY-001.md
```

Add to:

```text
docs/engineering-playbook/04_Founder_Decision_Registry.md
```

Recommended registry entry:

```text
Decision ID: FD-CM-LOVABLE-DB1-CUSTODY-001
Title: Interim Custody of Lovable Cloud DB1 Live Data
Status: approved
Owner: Joel / Founder
Scope: DB1 live-legacy preservation and custody
Execution state: approved_active
Verified live state: 150 products, 4 orders, 7 Auth users, 1 seller
Final disposition: deferred
```
