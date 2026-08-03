# CM-GTM-1 — manual sample workflow

Internal use only. This workflow records requests; it does not reserve inventory, create fulfillment, place orders, or send messages.

## Safety contract

- `MANUAL_SEND_ONLY`
- `NO_EMAIL_AUTOMATION`
- `NO_WHATSAPP_API`
- `NO_REMOTE_WRITES`
- `NO_CHECKOUT_OR_PAYMENTS`
- `NO_INVENTORY_MUTATION`
- `NO_A3_2B`
- `NO_PUBLICATION`

## Manual state flow

```text
REQUEST_RECORDED
  -> PROVENANCE_VERIFIED
  -> FOUNDER_REVIEW
  -> AVAILABILITY_CHECK_PENDING
  -> SAMPLE_APPROVED | SAMPLE_DECLINED
  -> MANUAL_HANDOFF_PENDING
  -> MANUAL_HANDOFF_RECORDED
  -> CLOSED
```

No state transition performs an external action. Each transition is a human-authored internal record.

## Request record

Capture these fields in the account row notes or a reviewed internal evidence record:

- account ID;
- request date;
- Founder-approved Wave 1 product reference;
- requested presentation and quantity, or `UNKNOWN`;
- intended business use;
- public-contact provenance;
- requested delivery location, or `UNKNOWN`;
- owner;
- decision and decision date;
- evidence link or repository record;
- blocker and next action.

Never infer availability, stock, sample quantity, delivery time, compliance, or product suitability.

## Gate 1 — provenance

Confirm that the account is real and that contact information came from the recorded public `source_url`. If provenance is absent or conflicts with the request, stop and return the pipeline row to `ON_HOLD`.

## Gate 2 — Founder review

The Founder decides whether the request should proceed and approves the specific product, presentation, maximum sample quantity, cost treatment, and owner. Silence is not approval.

## Gate 3 — manual availability confirmation

An authorized human confirms whether the sample can be supported. The pipeline may record only `PENDING_CONFIRMATION`, `CONFIRMED_FOR_SAMPLE`, or `NOT_AVAILABLE_FOR_SAMPLE`. This is a point-in-time decision record, not inventory.

## Gate 4 — manual handoff

Only after Gates 1–3 pass may a human coordinate a handoff. Record the actual handoff date and evidence after it occurs. Do not promise courier, delivery time, or service coverage unless separately approved and evidenced.

## Closure

Close the request as `MANUAL_HANDOFF_RECORDED`, `SAMPLE_DECLINED`, or `CANCELLED`. A sample never creates a checkout session, payment, order, inventory mutation, marketplace event, or automated message.
