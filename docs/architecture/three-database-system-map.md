# Three-Database System Map

| Database                | Authority                              | Current role                                                                                          | Repository treatment                                                                                              |
| ----------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| DB1 Lovable Cloud       | `d9495376-339d-44dd-9c8a-db0f7b451f96` | `live_legacy_production`; 150 products, 4 orders, 7 Auth users and 1 seller; custodian Joel / Founder | Migration history quarantined, never applied to DB2; final disposition deferred; no destructive action authorized |
| DB2 CornerMex canonical | `wlrfknmrhowldygmvtvn`                 | Canonical A-track target; verified 20 public tables, 2 public functions, all RLS enabled              | Sole authority for active migrations and generated types                                                          |
| DB3 CornerOps           | `nhxpujypqxbjiqqddxqt`                 | CornerOps operational source                                                                          | External source only; never copied into CornerMex schema by this remediation                                      |

The three systems have separate credentials, data ownership and deployment
lifecycles. Repository co-location never implies database interchangeability.

DB1 custody is governed by `FD-CM-LOVABLE-DB1-CUSTODY-001`. The verified
figures are aggregate evidence only: 150 products, 4 orders, 7 Auth users and
1 seller. No PII or order contents are recorded here. Its status remains
`live_legacy_production`, Joel / Founder is custodian, final disposition is
deferred, and no destructive action is authorized.
