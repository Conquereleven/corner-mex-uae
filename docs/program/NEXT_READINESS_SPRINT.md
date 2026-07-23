# Next Commercial Sprint — CM-COM-1 Storefront Conversion Foundation

The production frontend is live and ready under `FD-CM-PROD-LAUNCH-001`. PR #14 has been merged and CM-PROD-1 is complete.

This handoff records roadmap direction only. It does not authorize Railway, Supabase, production deployment, commercial activation, migration, DNS, payment, checkout, marketplace, inventory, messaging, or external actions.

## Current baseline

- production frontend: live;
- production health and readiness: verified green before the evidence merge;
- production auto-deploy: disabled;
- staging: healthy and available for the next implementation sprint;
- all reported commercial execution capabilities: disabled.

## Next sprint

`CM-COM-1 — Storefront Conversion Foundation`

Primary workstreams:

1. Implement `MexGlass v1` in staging for the header, search, categories, filters, cart shell, selectors, modals and mobile navigation.
2. Keep product cards, prices, ingredients, quantity controls and future checkout surfaces solid and highly legible.
3. Expose the approved initial catalog through read-only storefront views.
4. Validate category discovery, AED pricing presentation, delivery coverage and UAE trust messaging.
5. Define the first controlled order path without activating checkout, payment or external messaging.

## MexGlass guardrails

- staging-first implementation and founder visual approval;
- warm CornerMex palette, not generic blue glass;
- no heavy shader or WebGL dependency in v1;
- solid fallback when backdrop blur is unavailable;
- reduced-motion support;
- accessible contrast, focus and keyboard navigation;
- no material mobile performance regression;
- commercial capability flags remain false.

## Exit criteria

- approved MexGlass design system and reusable components;
- responsive header, search, filters, cart shell and mobile navigation;
- readable catalog and product detail surfaces;
- read-only initial catalog visible in staging;
- mobile, accessibility and fallback checks pass;
- no production or commercial activation performed;
- founder decision prepared for the next bounded production release.

Full sequencing and later commercial phases are recorded in `docs/program/COMMERCIAL_ROADMAP.md`.

Recommended implementation owner: `Codex`.

Recommended visual reviewer: `Founder`, followed by a short independent frontend delta review.
