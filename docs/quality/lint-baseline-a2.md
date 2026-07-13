# Lint Baseline A2

The inherited repository had 5,953 lint findings during A1, concentrated in generated Supabase types, broad `any` usage, legacy seller/admin surfaces and formatting drift. A2 does not reformat or repair that backlog.

`npm run lint:changed` gates JavaScript and TypeScript files changed relative to `origin/main`. New work must pass this bounded gate. Global cleanup should proceed by owned module in a later sprint and must not obscure functional/security changes.
