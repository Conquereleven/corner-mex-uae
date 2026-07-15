# Railway Staging A2

- Existing project: `CornerMex UAE` (`06d2ecdd-3c03-4480-8299-48c539595a94`)
- Classification before A2: `project_exists_empty`
- Environment: `staging` only
- Service: `cornermex-web`
- Repository: `Conquereleven/corner-mex-uae`
- Build: `npm run build:railway` (Railpack performs dependency installation)
- Start: `npm run start:railway`
- Health: `/api/health`
- Readiness: `/api/ready`
- Supabase target: `wlrfknmrhowldygmvtvn`
- Generated domain: `https://cornermex-web-staging.up.railway.app`
- Accepted main deployment: `f1e27c4e-6dba-4601-8a0b-276954437ad5`

Only variable names are documented in `.env.example`. Staging uses the target URL and publishable key. Service-role credentials remain server-only and are unnecessary for public readiness. Checkout, payments, email and messages stay disabled. Use the Railway-generated domain; do not change DNS.

Rollback: select the preceding successful deployment `28c20d08-7947-4108-ac7d-30c7ae15bb9f` in Railway and choose Redeploy. Preserve the project/environment and target schema. The current Lovable Cloud deployment remains the commercial rollback anchor.
