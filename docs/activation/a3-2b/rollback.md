# A3.2b Rollback

Owner: Joel / Founder. Trigger on runtime failure, secret exposure, public/active product, nonzero inventory, unauthorized Auth user, Storage policy failure, reconciliation mismatch, checkout/payment exposure or commit mismatch. Roll back Railway to the prior deployment and delete only rows/objects tied to the import execution ID/manifest. Lovable remains unchanged; its 14-day clock does not start in this sprint.

`npm run catalog:rollback:preview` produces deterministic evidence against synthetic data. CI runs `npm run test:catalog-rollback:db` against disposable PostgreSQL and proves execution A is removed without touching execution B, pre-existing products, inventory, orders, payments or reviews. A completed execution ID becomes an idempotent no-op; an unknown ID fails closed. The tooling rejects canonical project `wlrfknmrhowldygmvtvn` before any SQL and contains no production rollback adapter.
