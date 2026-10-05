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
  The application refuses to run against the UAE database.
- PR #81 and PR #82 stay open as reference until the Founder closes them as
  superseded. They are not merged into `main`.

## Mexico hosting (created 2026-10-05)

| | |
| --- | --- |
| Railway project | `CornerMex MX` — `1ad78bd2-d7ff-4807-9c1c-aa3fca67d06a` |
| Service | `corner-mex-mx` — `e1752106-eb13-4be6-9077-d8142b725fd7` |
| Environment | `production` — `2329cb54-8ad4-454e-81e3-8af03014a725` |
| Source | `mx/main` |

Initial configuration: `CORNERMEX_MARKET=MX`, `CORNERMEX_APPLICATION_ENV=staging`,
checkout off (server and build flag), real payment execution off, real shipping
purchase off, every provider disabled, cash on delivery off. The quote-signing
secret and the Clip webhook secret were generated on the machine and piped
straight into Railway; they were never displayed or written to disk.

Not set yet, because they do not exist: the Mexico Supabase variables and the
public URL. Until they are, the service answers `/api/health` but refuses the
database (`/api/ready` → `target: "refused"`), which is the intended behaviour.

It is a separate Railway project from `CornerMex UAE`; the UAE service was not
reused or modified.

## When Mexico becomes the only line

Once the UAE service is retired, `mx/main` can become the repository default.
That is a later, deliberate step: repoint the default branch, archive `main` as
`uae/main`, and only then delete nothing — history stays.

## UAE production today

On 2026-10-05 the UAE checkout was switched off:
`CORNERMEX_CHECKOUT_ENABLED=false` and `VITE_CORNERMEX_CHECKOUT_ENABLED=false`
on the `corner-mex-uae` service. Verified after redeploy: `/api/ready` →
`checkoutEnabled: false`, same commit `f90134b`, service healthy. Orders,
database, migrations and code are untouched. To reverse it, set both variables
back to `true`.
