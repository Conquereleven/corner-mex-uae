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

Rollback: redeploy the accepted implementation commit `80ec9a5b635e6654c07fa41648bba6899ddd7599` from Git if the current Railway deployment is unhealthy. Railway may retire prior deployment IDs after a newer successful deployment, so the commit is the durable rollback reference. Preserve the project/environment and target schema. The current Lovable Cloud deployment remains the commercial rollback anchor.
