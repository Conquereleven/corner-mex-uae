# Supabase Commerce Baseline A1

## Project classification

- Active production: `ywyiejqnbyzjfatojvkh`, supported by repository `supabase/config.toml`, Supabase client environment mapping and the live `corner-mex-uae.lovable.app` deployment.
- Known candidate: `wlrfknmrhowldygmvtvn`, classified `target_production`. Inspection found no public tables, views, storage buckets/objects or applied migration history.
- CornerOps read replica: `nhxpujypqxbjiqqddxqt`, a separate operations project exposing a limited nine-row read model. It is not the CornerMex commerce system of record.

## Commerce schema baseline

The repository migration history contains definitions for profiles/customers, products, categories, variants/inventory, carts, cart items, orders, order items, payments represented in order/payment fields, reviews, promotions/coupons and analytics/catalog events. These are `present_in_repository_history`; direct active-project administrative verification was unavailable. The target candidate contains none of them, so its runtime classification is `absent` and no schema is fabricated.

The repository also contains multivendor seller, payout and commission surfaces. They are not authorized by the current single-merchant business model and remain legacy/future surfaces, not a mandate to enable marketplace behavior.

## `public.rls_auto_enable()`

Candidate inspection found a PostgreSQL `SECURITY DEFINER` event-trigger helper owned by `postgres`, signature `()`, with `search_path=pg_catalog`. It enables RLS for newly created public tables and has no business-table/runtime dependency. Before remediation, `PUBLIC`, `anon` and `authenticated` could execute it.

Migration `20260713222315_revoke_public_rls_auto_enable_execution.sql` revokes only those execute grants. It changes no tables, data, Auth or RLS policies. SHA-256: `02ab2d6a839d96167451614c05841887c41afed46e5e96c4ea1c5a78c228ca84`. Rollback must never restore public/client execution; only a reviewed administrative role may receive it.

Applied migration record: `20260713223138_revoke_public_rls_auto_enable_execution_a1`. Post-migration introspection reports execute privilege `false` for `PUBLIC`, `anon` and `authenticated`; security and performance advisors report no findings.

## Historical inventory

Migration `20260606013014_dc708c0e-8aed-42e8-bdc0-03b193c62a44.sql` contains sample inventory values including 50. It is classified `unsafe_legacy` for runtime inventory decisions. It must not be executed to initialize production stock and does not establish physical availability.
