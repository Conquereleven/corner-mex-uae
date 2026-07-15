# Founder decision checklist A3.2a

Two decisions were approved by Joel / Founder at `2026-07-15T15:21:27-06:00`. Eleven decisions remain unanswered and block A3.2b review readiness. Record only explicit `yes` or `no`; do not infer an answer.

| Decision                                   | Yes |  No | Required detail                     |
| ------------------------------------------ | --: | --: | ----------------------------------- |
| Activate a Railway production environment? | [x] | [ ] | A3.2b execution only; not executed  |
| Lovable rollback window?                   | [x] | [ ] | 14 days post-cutover; not started   |
| Custom domain and DNS timing?              | [ ] | [ ] | domain, window, owner               |
| Auth bootstrap timing?                     | [ ] | [ ] | founder identity and recovery owner |
| Create Storage bucket?                     | [ ] | [ ] | purpose, policy, size limit         |
| First catalog batch?                       | [ ] | [ ] | exact bounded batch                 |
| First physical inventory verification?     | [ ] | [ ] | location, counter, approver         |
| Enable checkout?                           | [ ] | [ ] | separate gate evidence              |
| Enable payment provider?                   | [ ] | [ ] | test/live mode and owner            |
| Enable email provider?                     | [ ] | [ ] | provider, sender, approval          |
| Customer communication?                    | [ ] | [ ] | audience, channel, approver         |
| Assign rollback owner?                     | [ ] | [ ] | named person and backup             |
| Observation window?                        | [ ] | [ ] | duration, owner, thresholds         |

Machine-readable status: `contracts/cornermex-founder-decisions-v1.json`. Validate with `npm run validate:a3-2a:founder-decisions`.

## Approved scope

- Railway: `approved_for_a3_2b_execution_only`. Creation/activation requires merged A3.2a, Claude approval of the exact A3.2b execution head, immediate founder authorization, fresh unexpired verification, no Critical/High findings, exact Railway identity, assigned rollback owner, executable rollback, and no duplicate resource. No environment was created and no deployment, variable, DNS, callback, checkout, payment, product, or inventory action occurred.
- Lovable: retain the current commercial runtime as rollback anchor for 14 full days beginning only after a successful future A3.2b cutover. The window has not started. Lovable was not modified or retired; retirement requires a separate future founder decision.
