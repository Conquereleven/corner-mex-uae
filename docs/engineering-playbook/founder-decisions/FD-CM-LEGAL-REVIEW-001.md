# Founder Decision Record

## CornerMex legal review completion

**Decision ID:** FD-CM-LEGAL-REVIEW-001
**Status:** APPROVED — FOUNDER-ATTESTED
**Owner:** Joel / Founder
**Date recorded:** 2026-09-20
**Evidence class:** `FOUNDER-ATTESTED`
**Related:** `FD-CM-BUSINESS-IDENTITY-001`, `docs/cornermex-2/LEGAL-IDENTITY.md`

## Decision

The Founder reports that legal review of the customer-facing CornerMex legal
documents is **complete**. Legal review is therefore no longer a launch blocker,
and the documents must no longer be presented to customers as unfinished
templates pending review.

Commercial identity is unchanged: **CornerMex** is the public brand, **RodMor
TradeCo LLC** is the seller / merchant of record, and **Intermex is a supplier
only**.

## What changed in the repository

- `src/lib/legal-docs.ts`: the nine customer-facing documents move from
  `Legal Review Required` to `Approved`, and `BUSINESS_MODEL.legalReviewStatus`
  follows.
- The **Seller Agreement stays `Draft`**. It is explicitly a Phase 2 document
  for a third-party marketplace that is not active, so calling it approved
  would be inaccurate. Its on-page notice now says it is a draft for a future
  phase rather than an unreviewed template.
- `src/components/site/LegalDocPage.tsx`: the amber banner no longer tells
  customers the document "must be reviewed by qualified UAE legal counsel"; it
  now appears only for drafts and says so.
- `src/routes/terms.tsx`: removes "pending review by qualified UAE legal
  counsel" and "finalised with qualified UAE legal review before commercial
  activation".
- `src/routes/_authenticated/admin.legal.tsx`: the compliance panel shows legal
  review complete; the Arabic translation row stays pending, which is a separate
  and still-open item.

## Provenance and limits

This record carries the Founder's attestation and nothing more.

- It does **not** name counsel, a firm, a review date, an engagement reference
  or any approval artefact, because none was supplied. Nothing of that kind was
  invented.
- No review agent has seen or verified external evidence of the review.
- The evidence class is `FOUNDER-ATTESTED`, not `VERIFIED`, consistent with
  `FD-CM-BUSINESS-IDENTITY-001`.
- Document **substance** was not rewritten under this decision. Only review
  status and statements about review status changed.

If an approval artefact (counsel sign-off, dated letter, engagement reference)
becomes available, attach it here and the evidence class can be raised.
