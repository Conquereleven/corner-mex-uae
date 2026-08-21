# CM-PRESENT-1 Presentation Readiness Baseline

This note captures the evidence used to prepare CornerMex for a live operating presentation without
creating synthetic commerce activity.

## Production catalogue snapshot

Read-only verification against canonical Supabase project `wlrfknmrhowldygmvtvn` established:

- 195 active products;
- 204 variants;
- 195 active products with at least one image;
- 195 active products with an active variant;
- 194 active products with at least one positive AED price;
- 125 products with available inventory;
- 223 total available units;
- one active placeholder category (`uncategorized`);
- zero B2B leads at the audit point;
- two orders recorded.

## Presentation contract

The live presentation should demonstrate only capabilities already backed by production code and
current data:

1. home and catalogue discovery;
2. product detail and cart navigation;
3. signed-in cash-on-delivery checkout boundaries;
4. B2B enquiry intake and the human-reviewed lead/quote workflow;
5. admin operational surfaces for catalogue and B2B management.

The presentation must not imply automatic fulfilment, instant B2B quotation, real payment execution,
or automated external outreach where those capabilities remain gated or manual.

## Data hygiene boundary

The known zero-price record `fermin-guava-paste-400-g-copy` / SKU `810943000304` is excluded from
public shop cards by CM-PRESENT-1. This repository lane does not modify that production record.
Category taxonomy cleanup is likewise a separate production-data operation requiring explicit
Founder authorization.

## Safety

CM-PRESENT-1 creates no demonstration orders, leads, payments, inventory movements or external
messages. Presentation readiness is achieved through accurate public copy, fail-closed catalogue
rendering and regression coverage rather than synthetic production activity.
