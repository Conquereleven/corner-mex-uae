# Commerce Foundation Security A2

- Target-only migration; active project `ywyiejqnbyzjfatojvkh` is untouched.
- Forced RLS on all A2 commerce tables.
- Anonymous writes are limited to bounded B2B/catalog event intake; no order, payment, inventory, profile or admin writes.
- Customer access uses `auth.uid()` ownership.
- Admin authorization uses private role rows and a restricted, fixed-search-path function.
- Service role stays server-only and is never a `VITE_` variable.
- Products/variants default inactive, inventory defaults zero, and external capabilities fail closed.
- No seed data, seller auth, payouts, commissions, public Storage writes or external actions.

Rollback disables Railway staging first. Schema removal requires a separate reviewed migration; no automatic drop is authorized.
