# Founder Decision Record
## Temporary Public Contact Channel and Domain Status

**Decision ID:** FD-CM-PUBLIC-CONTACT-001
**Status:** APPROVED — FOUNDER-ATTESTED / TEMPORARY
**Owner:** Joel / Founder
**Evidence class:** `FOUNDER-ATTESTED / TEMPORARY`
**Related:** [FD-CM-BUSINESS-IDENTITY-001](FD-CM-BUSINESS-IDENTITY-001.md), CM-COM-2A trust
architecture (PR #23), Codex review `REJECT_CM_COM_2A_R1_RELEASE_BLOCKER`

## Why this record exists

The CM-COM-2A-R1 independent review confirmed a contradiction: the repository
presented `@cornermex.ae` mailboxes as operational customer-contact channels and
`https://cornermex.ae` as the active company website, while the domain is not
owned. This record establishes the actual, currently authorized contact truth.

## Attested current state

| Field | Value |
| --- | --- |
| Temporary public contact | `cornermexuae` at `gmail.com` |
| Evidence class | FOUNDER-ATTESTED / TEMPORARY |
| Custom domain | **not purchased** |
| `cornermex.ae` | **not owned / not operational** |
| `@cornermex.ae` mailboxes | **not authorized** as active public contact channels |
| Verified web origin | the current Railway production origin |
| CM-COM-2B domain cutover | **ON HOLD** |

## What this decision authorizes

- Accurate public display of the Founder-authorized Gmail address above as the
  **temporary** CornerMex customer-contact address, across all customer-visible
  contact intents (general support, B2B, complaints, privacy/legal).
- Continued use of the currently verified Railway production origin as the
  application's canonical web origin until a separately authorized cutover.

## Explicit limits

- This record **does not assert independent mailbox verification**. No agent has
  proven the mailbox is monitored or deliverable; only the Founder's
  authorization to display it is recorded.
- `cornermex.ae` **must not be represented as active** — not as a website, not
  as a mailbox domain, and not as an implied asset — on any customer-visible
  surface.
- No `@cornermex.ae` alias (`support@`, `legal@`, `privacy@`, `complaints@`,
  `b2b@`) may be presented as operational.
- Any future domain purchase, DNS/MX configuration, mailbox creation or contact
  migration requires **separate Founder authorization**.

## Not authorized by this decision

- No domain purchase or registrar action; no DNS, MX or TLS configuration.
- No Railway custom domain, no OAuth callback change, no deployment.
- No email-provider configuration, mailbox creation or credential handling.
- No checkout, payment, bank-transfer, COD, A3.2b, catalog or inventory action.
- No external message send.
- No merge or Ready transition of any open PR.

## Implementation

`src/lib/public-contact.ts` is the single canonical source. It composes the
authorized address (never storing a raw address literal, per the A3 privacy
guard) and resolves every contact intent to it. Intent is preserved through
distinct `mailto` subjects, so a future per-intent mailbox rollout is a registry
change rather than a call-site change.

## Change control

Superseding this record requires a new Founder decision. When a domain and
mailboxes are activated, the replacement record must state the new addresses,
their evidence class, and the cutover authorization.
