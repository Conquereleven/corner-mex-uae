# Three-Database System Map

| Database | Authority | Current role | Repository treatment |
| --- | --- | --- | --- |
| DB1 Lovable Cloud | `d9495376-339d-44dd-9c8a-db0f7b451f96` | Live published Lovable runtime; 36 tables and historical business data | Migration history quarantined, never applied to DB2 |
| DB2 CornerMex canonical | `wlrfknmrhowldygmvtvn` | Canonical A-track target; verified 20 public tables, 2 public functions, all RLS enabled | Sole authority for active migrations and generated types |
| DB3 CornerOps | `nhxpujypqxbjiqqddxqt` | CornerOps operational source | External source only; never copied into CornerMex schema by this remediation |

The three systems have separate credentials, data ownership and deployment
lifecycles. Repository co-location never implies database interchangeability.
