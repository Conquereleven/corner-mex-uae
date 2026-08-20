-- CM-LAUNCH-1-L5R review hardening
-- Keep persisted quote drafts structurally compatible with the strict server schema.
-- This is storage integrity only: no quote send, order, payment, inventory or outreach behavior.

alter table public.b2b_leads
  drop constraint if exists b2b_leads_quote_draft_object_check;

alter table public.b2b_leads
  add constraint b2b_leads_quote_draft_object_check
  check (
    quote_draft is null or (
      jsonb_typeof(quote_draft) = 'object'
      and char_length(quote_draft::text) <= 20000
      and quote_draft ?& array[
        'items_summary',
        'delivery_fee_aed',
        'vat_treatment',
        'availability_note',
        'valid_until',
        'payment_terms',
        'recipient',
        'notes'
      ]
      and (
        quote_draft - array[
          'items_summary',
          'delivery_fee_aed',
          'vat_treatment',
          'availability_note',
          'valid_until',
          'payment_terms',
          'recipient',
          'notes'
        ]
      ) = '{}'::jsonb
      and jsonb_typeof(quote_draft -> 'items_summary') in ('string', 'null')
      and jsonb_typeof(quote_draft -> 'delivery_fee_aed') in ('number', 'null')
      and jsonb_typeof(quote_draft -> 'vat_treatment') in ('string', 'null')
      and jsonb_typeof(quote_draft -> 'availability_note') in ('string', 'null')
      and jsonb_typeof(quote_draft -> 'valid_until') in ('string', 'null')
      and jsonb_typeof(quote_draft -> 'payment_terms') in ('string', 'null')
      and jsonb_typeof(quote_draft -> 'recipient') in ('string', 'null')
      and jsonb_typeof(quote_draft -> 'notes') in ('string', 'null')
      and (
        quote_draft ->> 'items_summary' is null
        or char_length(quote_draft ->> 'items_summary') <= 8000
      )
      and (
        case
          when jsonb_typeof(quote_draft -> 'delivery_fee_aed') = 'number' then
            (quote_draft ->> 'delivery_fee_aed')::numeric between 0 and 999999
          else jsonb_typeof(quote_draft -> 'delivery_fee_aed') = 'null'
        end
      )
      and (
        quote_draft ->> 'vat_treatment' is null
        or char_length(quote_draft ->> 'vat_treatment') <= 500
      )
      and (
        quote_draft ->> 'availability_note' is null
        or char_length(quote_draft ->> 'availability_note') <= 1000
      )
      and (
        quote_draft ->> 'valid_until' is null
        or quote_draft ->> 'valid_until' ~ '^\d{4}-\d{2}-\d{2}$'
      )
      and (
        quote_draft ->> 'payment_terms' is null
        or char_length(quote_draft ->> 'payment_terms') <= 1000
      )
      and (
        quote_draft ->> 'recipient' is null
        or char_length(quote_draft ->> 'recipient') <= 320
      )
      and (
        quote_draft ->> 'notes' is null
        or char_length(quote_draft ->> 'notes') <= 4000
      )
    )
  );
