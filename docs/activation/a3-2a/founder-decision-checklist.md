# Founder decision checklist A3.2a

Every decision is currently unanswered and blocks A3.2b review readiness. Record only explicit `yes` or `no`; do not infer an answer.

| Decision                                   | Yes |  No | Required detail                     |
| ------------------------------------------ | --: | --: | ----------------------------------- |
| Activate a Railway production environment? | [ ] | [ ] | authorized date/operator            |
| Lovable rollback window?                   | [ ] | [ ] | duration and close condition        |
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
