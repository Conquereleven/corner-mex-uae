# CornerMex Independent Railway Migration A1

## Decision

CornerOps and CornerMex require separate Railway projects, services, variables, credentials, domains, staging environments, deploys and rollbacks. A new CornerMex production deployment is not created in A1. Current hosting remains `corner-mex-uae.lovable.app` temporarily.

Target project: `cornermex-commerce`. Initial service: `cornermex-web`. Optional worker, cron and webhook services are deferred.

## Runtime assessment

This repository is a TanStack Start SSR application, not a static-only site: it has `src/server.ts`, server functions and public API routes including Stripe webhooks. Current production hosting is Lovable Cloud at `corner-mex-uae.lovable.app`.

- Install: `npm ci`
- Build: `NITRO_PRESET=node_server npm run build`
- Start: `node .output/server/index.mjs`
- Health check provisional: `/` (local Node smoke returned HTTP 200); add a dedicated side-effect-free `/api/health` route before project creation

The default build remains `cloudflare-module` and is not a Railway Node server. The explicit `NITRO_PRESET=node_server` build produced a `node-server` Nitro manifest, started on `PORT`, and returned HTTP 200 locally.

## Variable names

Map values independently for staging and production; never share CornerOps values: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only where strictly required), `SUPABASE_USER_ACCESS_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `PUBLIC_SITE_URL`, `SITE_ORIGIN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `VITE_BANK_ACCOUNT_NAME`, `VITE_BANK_IBAN`, `VITE_BANK_NAME` and Railway-provided `PORT`.

## Creation gate

Before creation: confirm the active Supabase project and target migration, pass build/start locally, map every variable owner/scope, add a health endpoint, prepare Supabase Auth redirects, Stripe/payment callbacks, email origins, canonical URLs and rollback. Staging must use separate Supabase/payment/email configuration and a staging domain.

## Domain migration

1. Deploy staging and verify SSR, Auth, checkout, webhooks and read/write isolation.
2. Deploy production behind a Railway-generated domain without DNS cutover.
3. Add the future production domain to Supabase Auth redirects and payment callbacks.
4. Lower DNS TTL, verify TLS and perform a controlled cutover.
5. Keep the old host available during the rollback window; never run two writable consumers unless idempotency is proven.

Rollback restores DNS to the current host and disables the Railway service without switching Supabase projects or rewriting data. Final A1 decision: `cornermex_independent_railway_migration_plan_ready`; current hosting remains until the creation gate is completed.
