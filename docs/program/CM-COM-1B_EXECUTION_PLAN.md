# CM-COM-1B — Commercial Preview Mode

## Objective

Prepare CornerMex as a credible pre-launch commercial storefront on staging, ready for later domain connection, without enabling checkout, payments, marketplace, automated messaging, inventory writes, A3.2b, DNS or production deployment.

## Base

- Repository: `Conquereleven/corner-mex-uae`
- Base branch: `main`
- Base commit: `d9f7f47155a12c1d3cc7efe25b3fc4a0e9c33480`
- Working branch: `feature/cm-com-1b-commercial-preview-mode`

## Agent routing

- ChatGPT 5.6 Thinking: technical program manager, sequencing, scope control and founder handoff.
- Codex: primary implementation, tests and CI fixes.
- Claude Code with Opus 5: architecture, security and commercial-truthfulness pre-review.
- Claude Haiku: rapid copy, route and content completeness QA.
- Claude Sonnet: exact-delta independent review after implementation is frozen.
- `cornermexuae-netizen`: independent GitHub approval on the final exact head.
- Fable 5: not available and excluded from this sprint.

## Included

- commercial homepage refinement;
- complete storefront navigation and footer;
- About and B2B commercial pages;
- shipping, returns, privacy and terms presentation;
- domain-ready metadata, canonical URL abstraction, social metadata, favicon and manifest review;
- AED-first presentation;
- clear emirates served and delivery expectations, only where verified;
- honest pre-launch and commerce-disabled states;
- removal of obsolete template language, unsupported marketplace language and misleading CTAs;
- contact and quote-intent paths that remain manual or draft-only;
- tests directly related to these changes.

## Commercial truth rules

- Do not claim stock, availability, price, delivery time, compliance, registration, payment acceptance or shipping coverage without repository evidence.
- Do not expose functional checkout, add-to-cart, subscription or lead submission controls unless the corresponding capability is explicitly enabled and authorized.
- Prefer honest labels such as `Commercial preview`, `Request a quote`, `Availability confirmed before order` and `Payment method confirmed in quotation`.
- Existing company identity and license details may remain only when already documented in the repository and should not be expanded without evidence.

## Excluded

- merge;
- DNS or domain connection;
- Railway variable or service changes;
- manual production deployment;
- Supabase writes or migrations;
- A3.2b execution;
- checkout or payment activation;
- marketplace or seller activation;
- automated messaging;
- inventory mutation or synchronization;
- catalog import execution.

## Required gates

1. Codex implementation complete on one reviewable exact head.
2. All required CI checks green.
3. Claude Code Opus 5 architecture/security/commercial-truthfulness review.
4. Founder visual and commercial review on the exact head.
5. Sonnet exact-delta review.
6. `cornermexuae-netizen` approval.
7. Separate Founder merge authorization.

## Definition of Done

- staging looks and reads like a real UAE commercial pre-launch storefront;
- no misleading live-commerce affordances remain;
- all public routes are coherent on desktop and mobile;
- legal and commercial pages are discoverable;
- metadata is ready to receive the purchased domain through a later configuration-only change;
- no platform writes or commercial capability activation occurred;
- exact-head evidence and review packet are complete.
