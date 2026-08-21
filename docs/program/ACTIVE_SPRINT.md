# Active Sprint: CM-PRESENT-1 — Operational Presentation Readiness

- Owner: Codex
- Reviewer: independent reviewer
- Branch: `feature/cm-present-1-operational-readiness`
- Base/main source: `09071b11bba0569af89cc3a39f0900d310228ef7`
- Tracking issue: #42
- Status: implementation in progress; repository-only; no Supabase production writes

## Goal

Make CornerMex presentation-ready as an operating UAE commerce platform using the current production
catalogue and workflows without inventing demo data or weakening production governance.

## Fresh production baseline

Read-only production verification against canonical Supabase project `wlrfknmrhowldygmvtvn` found:

- 195 active products and 204 variants;
- 195/195 active products with images;
- 195/195 active products with active variants;
- 194/195 active products with a positive price;
- 125 products with available inventory and 223 total available units;
- one active placeholder category, `uncategorized`;
- zero B2B leads at audit time;
- two orders recorded.

Railway production was re-observed healthy before this sprint and the latest deployment for base
`main` was `SUCCESS` on commit `09071b11bba0569af89cc3a39f0900d310228ef7`.

## Current implementation scope

1. Replace customer-facing `commercial preview` language on home and shop with accurate operational
   UAE commerce language.
2. Hide the placeholder `uncategorized` taxonomy from customer-facing shop filters while preserving
   `All` browsing.
3. Fail closed in the public shop so products with non-finite or non-positive prices are never
   rendered as sellable catalogue cards.
4. Add regression coverage for presentation copy, catalogue price safety, placeholder taxonomy and
   the home → shop / B2B entry journey.
5. Preserve checkout, B2B, admin, inventory, payment and messaging boundaries unchanged.

## Production-data boundary

The known zero-price record `fermin-guava-paste-400-g-copy` / SKU `810943000304` and all category
assignments are production data. CM-PRESENT-1 does not change them. Any direct product-price or
category correction requires a separate explicit Founder production-data authorization.

This sprint performs no Supabase production write, migration, Railway configuration write,
environment-variable change, order, inventory, payment, lead, message or outbound-email mutation.

## Governance note

`docs/program/CURRENT_STATE.json` remains coupled to `DEPLOYMENT_REGISTRY.json` by the existing
program-state validator. Reconstructing that historical deployment registry is outside this
presentation-focused code lane and must not be silently mixed into CM-PRESENT-1.

## Landing gates

- exact-head CI green;
- merged-tree verification green;
- independent review on the exact candidate head;
- explicit Founder merge authorization after review.
