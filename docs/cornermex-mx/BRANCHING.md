# Branch and deployment strategy

Mexico development is isolated from the UAE production deployment.

```
main      f90134b   ← UAE production. Railway service corner-mex-uae deploys this.
  └─ launch/cornermex-2  c3fa0ba   (PR #81, UAE launch — superseded, not merged)
        └─ mx/main       c3fa0ba   ← Mexico integration line (created 2026-10-05)
              └─ feat/cornermex-mx   ← PR #83 targets mx/main
```

## Rules

- **`main` is UAE production and is not a Mexico target.** Railway redeploys the
  UAE service on every push to it. No Mexico pull request targets `main`.
- **`mx/main` is the Mexico line.** It was created at the head of PR #81, so it
  already contains the canonical commerce core and Brand System 1.0. Mexico work
  merges here.
- **CI runs for `mx/main`** (`.github/workflows/ci.yml` triggers on `main` and
  `mx/main`).
- **Mexico gets its own hosting and database** — a new Railway project/service
  that deploys `mx/main`, and a new Supabase project (`DATABASE-BOOTSTRAP.md`).
  The application refuses to run against any database but the declared Mexico
  project.
- PR #81 and PR #82 stay open as reference until the Founder closes them as
  superseded. They are not merged into `main`.

## Mexico hosting (created 2026-10-05)

| | |
| --- | --- |
| Railway project | `CornerMex MX` — `1ad78bd2-d7ff-4807-9c1c-aa3fca67d06a` |
| Service | `corner-mex-mx` — `e1752106-eb13-4be6-9077-d8142b725fd7` |
| Environment | `production` — `2329cb54-8ad4-454e-81e3-8af03014a725` |
| Source | `feat/cornermex-mx` until PR #83 is merged, then `mx/main` |
| Database | Supabase `cornermex-mx` — `bdknutgpbflenzefussq` |

Initial configuration: `CORNERMEX_MARKET=MX`, `CORNERMEX_APPLICATION_ENV=staging`,
checkout off (server and build flag), real payment execution off, real shipping
purchase off, every provider disabled, cash on delivery off. The quote-signing
secret and the Clip webhook secret were generated on the machine and piped
straight into Railway; they were never displayed or written to disk.

Database attached on 2026-10-05: `SUPABASE_URL`, `VITE_SUPABASE_URL`, the
publishable key (server and build) and `CORNERMEX_MX_SUPABASE_PROJECT_REF`.
`SUPABASE_SERVICE_ROLE_KEY` is **not** set: the tooling used for this work can
read a project's publishable key but not its secret key, and the secret was not
fetched any other way. Catalogue reads and `/api/ready` work without it; server
writes (orders, payments, admin) need it. It is one copy-paste for the Founder,
dashboard to dashboard (`MX-LAUNCH-PLAN.md`).

It is a separate Railway project from `CornerMex UAE`; the UAE service was not
reused or modified.

## When Mexico becomes the only line

Once the UAE service is retired, `mx/main` can become the repository default.
That is a later, deliberate step: repoint the default branch, archive `main` as
`uae/main`, and only then delete nothing — history stays.

## UAE production today

The UAE Supabase project was deleted by the Founder on 2026-10-04, so the UAE
service has no database behind it (`DEFERRED-UAE.md`). Before that, on
2026-10-05 the UAE checkout was switched off:
`CORNERMEX_CHECKOUT_ENABLED=false` and `VITE_CORNERMEX_CHECKOUT_ENABLED=false`
on the `corner-mex-uae` service. Verified after redeploy: `/api/ready` →
`checkoutEnabled: false`, same commit `f90134b`, service healthy. Code and
migrations are untouched.
