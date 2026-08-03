# CM-GTM-1 — manual outreach library

Internal use only. The Founder-approved Wave 1 selection is fixed and is not reopened by this workflow.

## Safety contract

- `MANUAL_SEND_ONLY`
- `NO_EMAIL_AUTOMATION`
- `NO_WHATSAPP_API`
- `NO_REMOTE_WRITES`
- `NO_CHECKOUT_OR_PAYMENTS`
- `NO_INVENTORY_MUTATION`
- `NO_A3_2B`
- `NO_PUBLICATION`

Every message requires a human to verify the recipient, public-source provenance, business relevance, product reference, commercial terms, and final text before sending. Templates never constitute consent, approval, availability, price, stock, delivery, compliance, or a binding offer.

## Required pre-send record

Before any manual send, the account row must contain:

1. a real business name copied from a public source;
2. a valid `source_url` showing provenance;
3. a public contact copied from that source, or `UNKNOWN` if none exists;
4. an assigned owner and priority;
5. a concrete `next_action`;
6. notes containing `BUSINESS_SOURCE_VERIFIED` after a human verifies the business source;
7. notes identifying the public source used for any contact or decision-maker data, using `CONTACT_SOURCE_VERIFIED` or `DECISION_MAKER_SOURCE_VERIFIED` when those values are present.

If any requirement is missing, stop. Do not guess a name, email address, telephone number, role, website, or company domain.

## Manual introduction

**Subject:** CornerMex UAE — manual B2B product conversation

Hello `{{decision_maker_or_team}}`,

I’m `{{sender_name}}` from CornerMex UAE. We are speaking with UAE hospitality and retail businesses about a Founder-approved first wave of Mexican products.

Would a short conversation about your current requirements be useful? If so, we can discuss the relevant product, presentation, sample needs, availability confirmation, and a manually approved AED quote.

This message is exploratory. It is not an offer, stock confirmation, delivery promise, or automated sales message.

Regards,
`{{sender_name}}`

## Manual follow-up

Hello `{{decision_maker_or_team}}`,

Following up once on my earlier note about CornerMex UAE’s Founder-approved Wave 1 products. If this is relevant, I can arrange a short human conversation. If it is not relevant, no response is needed and we will close the follow-up.

Regards,
`{{sender_name}}`

## Manual meeting confirmation

Hello `{{decision_maker_or_team}}`,

Confirming our meeting for `{{meeting_date_time}}` to discuss `{{approved_product_reference}}`. We will treat all pricing, availability, sample, delivery, VAT, and payment terms as pending until explicitly confirmed and Founder-approved.

Regards,
`{{sender_name}}`

## Manual sample-request acknowledgement

Hello `{{decision_maker_or_team}}`,

Thank you for the sample request for `{{approved_product_reference}}`. We have logged the request for internal review. This acknowledgement does not confirm stock, sample approval, dispatch, delivery timing, price, or compliance status. We will respond only after the manual sample gate is complete.

Regards,
`{{sender_name}}`

## Manual quote cover note

Hello `{{decision_maker_or_team}}`,

Attached is quote `{{quote_id}}`, manually approved by the Founder. Please review the AED unit price, quantity, delivery fee, VAT status, availability statement, validity date, and payment terms shown in the quote. No term outside that approved record applies.

Regards,
`{{sender_name}}`

## Logging after a human action

- Record `last_contact` only after a human sends or completes the interaction.
- Move to `CONVERSATION` only after a two-way response.
- Move to a meeting stage only when a meeting is scheduled or completed.
- Log sample and quote stages only after their corresponding manual gates.
- Do not record inferred engagement, opens, clicks, automated events, or unverified replies.
