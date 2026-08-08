# Founder Decision Record
## Canonical Customer-Visible Business Identity

**Decision ID:** FD-CM-BUSINESS-IDENTITY-001
**Status:** APPROVED — FOUNDER-ATTESTED
**Owner:** Joel / Founder
**Evidence class:** `FOUNDER-ATTESTED`
**Related:** CM-COM-2A trust architecture (PR #23), review CM-COM-2A-X1 finding **P1-1**

## Why this record exists

The independent CM-COM-2A-X1 review traced the customer-visible legal identity
(legal entity, licensing authority/location and trade licence) to
`gpt-engineer-app[bot]` commits dated 2026-07-02 — the ungoverned Lovable
direct-to-main channel — with no supporting evidence or decision artifact in
`docs/`. That made a publicly displayed legal identity unsupported in-repo,
classified **P1-1**.

This record closes that gap by placing the values under explicit Founder
authority.

## Attested values

| Field | Value |
| --- | --- |
| Brand name | `CornerMex` |
| Legal entity | `RodMor TradeCo LLC` |
| Licensing authority | `Sharjah Media City` |
| Licensing authority / location wording | `Sharjah Media City, Free Zone, UAE` |
| Trade licence | `2647014.01` |
| Bank-account beneficiary | `RodMor TradeCo LLC` |

## Provenance and limits of this record

These values are **attested by the Founder**. They are recorded here on the
Founder's authority as the authoritative business identity for repository
governance and for accurate customer-visible display.

Explicit limits:

- This record does **not** claim independent documentary verification.
- No review agent has verified these values against an external registry, and
  no such external verification is claimed by this record or by any CM-COM-2A
  artifact.
- The evidence class is `FOUNDER-ATTESTED`, not `VERIFIED`.

## Values deliberately NOT attested

The following remain **undefined** in `src/lib/business-identity.ts` and must
not be fabricated on any surface. Public surfaces must render gracefully
without them:

- public phone number
- street address for visits
- published support hours
- TRN / VAT registration number

`/contact` states plainly that a phone line, visiting address and published
support hours are not yet available.

## Canonical application source

`src/lib/business-identity.ts` is the single canonical source for these values.
Duplicated literals elsewhere were removed so the identity cannot drift;
`src/lib/legal-docs.ts` and `src/lib/payment-methods.ts` now derive from the
registry rather than restating it.

The prior conflicting spelling `RodMor Trade Co LLC` (bank beneficiary
fallback) is resolved to the attested `RodMor TradeCo LLC`.

## Explicitly NOT authorized by this decision

- No bank-transfer, COD, checkout or payment activation. Recording a
  beneficiary name does not enable any payment path; bank transfer remains
  gated on configuration.
- No Railway, Supabase, DNS, domain-registrar, OAuth or CornerOps write.
- No production deployment, A3.2b execution or catalog population.
- No custom-domain selection, purchase or cutover. CM-COM-2B remains ON HOLD.
- No external messaging.
- No merge or Ready transition of any open PR.

## Change control

Any change to an attested value requires a new Founder decision record. If
documentary verification is later obtained, a follow-up record may upgrade the
evidence class from `FOUNDER-ATTESTED` to `VERIFIED`.
