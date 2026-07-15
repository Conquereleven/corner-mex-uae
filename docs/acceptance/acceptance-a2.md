# Acceptance A2

Status: accepted on Railway staging; production cutover and data migration remain blocked.

- Starting CornerMex SHA: `b0afeb7f14bda8a3623b152228b9372094248559`
- Starting CornerOps SHA: `6e7f25dc894f687eed00861019717e3112bfe7f2`
- Railway project: existing `CornerMex UAE`; initially empty
- Active Supabase: `ywyiejqnbyzjfatojvkh` (unchanged)
- Target Supabase: `wlrfknmrhowldygmvtvn`; empty before baseline
- A1 hardening: preserved
- Baseline decision: `approved_for_target_application`
- Baseline checksum: `4fab86557c628d4e1ecc91a11e12a15fa2443ff584b023044aee5c401e22d13c`
- Data migration: `not_started`
- Production cutover: `not_started`
- Current production: unchanged Lovable Cloud deployment
- CornerMex implementation PR: `#2`, merged as `80ec9a5b635e6654c07fa41648bba6899ddd7599`
- Implementation head: `8e34ab9d05d2dfb3c471b67412d44b6fdb778806`
- CI: repository checks and Railway deployment succeeded
- Railway project: `CornerMex UAE` (`06d2ecdd-3c03-4480-8299-48c539595a94`)
- Railway staging environment: `385b8cb8-878b-4d83-ad46-2bc831fed829`
- Railway service: `cornermex-web` (`5a6b85da-3156-4fc1-828d-ec9e4019de7e`)
- Railway staging URL: `https://cornermex-web-staging.up.railway.app`
- Main deployment and restart verification: `f1e27c4e-6dba-4601-8a0b-276954437ad5`, successful
- Health/readiness: `/api/health` HTTP 200; `/api/ready` HTTP 200
- SSR/static acceptance: root HTTP 200; built CSS asset HTTP 200; guarded routes redirect as designed
- Browser acceptance: the implementation deployment was visually accepted with no console errors. A repeat against the final main URL was blocked by the local Chrome security policy; HTTP, SSR, static-asset and route checks were repeated successfully instead.
- Target schema: 20 public tables, all 20 RLS-enabled, 37 policies
- Target data after restart: Auth users 0, Storage buckets 0, products 0, inventory 0, orders 0, payments 0, reviews 0
- Private boundary: `anon` has neither schema usage on `commerce_private` nor execute on `commerce_private.is_admin(uuid)`
- Applied migrations: A1 execution revocation plus A2 commerce foundation, private admin boundary and public read policy boundary
- Security advisor: no findings
- Performance advisor: non-blocking INFO/WARN findings for unindexed foreign keys, RLS init plans, unused indexes on the empty baseline and overlapping permissive policies
- Generated TypeScript types: present and validated
- Checkout/payment execution: disabled
- External messages and automatic imports/sync: disabled
- Marketing gate: `marketing_v1_16_internal_only_unblocked`; external publishing remains blocked
- Rollback: previous successful Railway deployment plus unchanged Lovable production anchor
