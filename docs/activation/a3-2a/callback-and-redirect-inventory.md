# Callback and redirect inventory A3.2a

No callback was changed. Values below are classifications and future placeholders, never credentials.

| Item                    | Owner    | Classification                   | Current status   | Future target                 | Validation                    | Cutover                         | Rollback                       | Blocker           | Founder decision |
| ----------------------- | -------- | -------------------------------- | ---------------- | ----------------------------- | ----------------------------- | ------------------------------- | ------------------------------ | ----------------- | ---------------- |
| Auth site URL           | founder  | public URL                       | unconfigured     | production domain pending     | Supabase Auth settings review | set after authorization         | restore Lovable site URL       | domain decision   | yes              |
| Auth redirect allowlist | founder  | public URL list                  | unconfigured     | production callbacks pending  | exact allowlist match         | add before Auth bootstrap       | restore previous allowlist     | Auth timing       | yes              |
| Password reset          | founder  | public URL                       | unconfigured     | production callback pending   | controlled reset smoke        | set before Auth bootstrap       | restore previous callback      | Auth timing       | yes              |
| OAuth callbacks         | founder  | public URL list                  | not verified     | provider not selected         | provider console review       | configure only if authorized    | disable provider               | provider absent   | yes              |
| Stripe webhook          | founder  | public endpoint, secret separate | unconfigured     | production webhook pending    | signed test event             | after payment gate              | restore or disable             | payments disabled | yes              |
| Payment success         | founder  | public URL                       | unconfigured     | production URL pending        | test-mode redirect            | after payment gate              | restore previous URL           | payments disabled | yes              |
| Payment cancel          | founder  | public URL                       | unconfigured     | production URL pending        | test-mode redirect            | after payment gate              | restore previous URL           | payments disabled | yes              |
| Email confirmation      | founder  | public URL                       | unconfigured     | production URL pending        | controlled email smoke        | after email gate                | disable email and restore      | email disabled    | yes              |
| Railway public URL      | platform | public URL                       | not verified     | production environment absent | metadata and HTTP             | create only after authorization | disable target; retain staging | not authorized    | yes              |
| Custom domain           | founder  | public domain                    | unconfigured     | pending                       | DNS/TLS smoke                 | switch after authorization      | restore Lovable DNS            | domain decision   | yes              |
| Health/readiness        | platform | public endpoints                 | verified staging | `/api/health`, `/api/ready`   | HTTP 200                      | verify exact deployed commit    | restore previous host          | none              | no               |
| Lovable dependency      | founder  | configuration metadata           | not verified     | retain through observation    | settings review               | document before changes         | retain Lovable anchor          | not inspected     | yes              |

The machine-readable source is `contracts/cornermex-callback-inventory-v1.json` and is validated by `npm run validate:a3-2a:callbacks`.
