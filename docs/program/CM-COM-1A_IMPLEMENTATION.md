# CM-COM-1A — Desert Glass storefront foundation

This sprint adds the staging-first visual foundation for the CornerMex single-merchant storefront. It does not authorize production deployment or commercial activation.

## Included

- reusable surface, header, control, drawer shell, overlay and badge primitives;
- warm ivory, cactus, chile and amber tokens with reduced-transparency and no-backdrop-filter fallbacks;
- selective use on navigation, search, category/filter controls, cart shell and dashboard topbar;
- solid product, price, inventory, order, customer, KPI, table and chart surfaces;
- Phase 1 admin navigation with seller onboarding, KYC and payouts hidden;
- direct Phase 2 admin routes redirected to `/admin` before their components can query or mutate;
- checkout and add-to-cart controls fail closed unless the existing public capability is explicitly enabled.

## Deferred boundary

`CM-ADMIN-1` remains pending for an authorized admin-runtime activation review. This sprint does not change authentication, users, roles, service credentials, database policy, migrations or platform configuration.

## Commercial state

Marketplace, checkout, payment execution, external messaging and automated inventory capabilities remain disabled by default. No product, price, stock, discount or operational metric is invented by this implementation.
