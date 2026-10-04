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
