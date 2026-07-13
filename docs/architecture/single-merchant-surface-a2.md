# Single-Merchant Surface A2

| Surface | Previous classification | A2 behavior |
|---|---|---|
| `/sellers` and `/sellers/:slug` | public_active | Redirect to `/shop` |
| `/seller/*` | authenticated marketplace | Redirect to customer account |
| Shop catalog | public_active | “Sold directly by CornerMex UAE” |
| Product structured data/cart identity | legacy seller-shaped type | Fixed CornerMex merchant identity |
| Checkout | public_active | Fail-closed unless explicitly enabled |
| Admin seller/payout pages | legacy/future | Not part of staging acceptance; no backing schema |
| Seller code/types | code_type_only | Retained for future review, not activated |

SupplyGraph suppliers are operational evidence sources, never public marketplace sellers. There is no seller onboarding, seller login, payout, commission, split-payment or settlement claim in the active A2 public flow.
