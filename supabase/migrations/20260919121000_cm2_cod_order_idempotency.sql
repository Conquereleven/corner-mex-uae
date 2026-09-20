-- CornerMex 2.0 launch hardening: idempotent COD order creation for guest and
-- authenticated customers.
--
-- place_cod_order_v1/v2 take no operation id, so a network retry, a second tab
-- or a replayed request created a second order and decremented stock twice; the
-- only protection was a disabled button. See
-- docs/cornermex-2/LAUNCH-READINESS-PLAN.md §3.1.
--
-- This mirrors cm_create_card_order_v2, which already solved the same problem
-- for card: the request is fingerprinted and the operation row is locked, so
-- concurrent callers serialise and the second observes the order the first
-- created. The fingerprint begins with 'cod', so a COD and a card operation can
-- never be confused for one another.
--
-- One function serves both identities so idempotency, pricing, stock and ledger
-- behaviour cannot drift between guest and authenticated checkout:
--   * authenticated attempts are keyed in commerce_private.card_checkout_operations
--     by (buyer_id, operation_id), as card already is;
--   * guest attempts are keyed in commerce_private.guest_checkout_operations by
--     operation_id, because the card table's buyer_id is NOT NULL.
--
-- For a guest, the first successful call also mints a tracking capability
-- token. Only its sha256 is stored; the plaintext is returned exactly once to
-- the creating request and can never be recovered from the database.
--
-- place_cod_order_v2 keeps all pricing, stock and ledger authority; this
-- function only decides whether to call it or to replay the order it created.

create or replace function public.cm_create_cod_order_v2(
  p_buyer_id uuid,
  p_guest_email text,
  p_operation_id uuid,
  p_items jsonb,
  p_shipping_address jsonb,
  p_shipping_aed numeric,
  p_tax_rate numeric,
  p_legal_acceptance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guest_email text := nullif(btrim(lower(p_guest_email)), '');
  v_is_guest boolean;
  v_fingerprint text;
  v_existing_fingerprint text;
  v_order_id uuid;
  v_norm jsonb;
  v_result jsonb;
  v_order public.orders%rowtype;
  v_token text;
  v_recent integer;
begin
  if p_operation_id is null then
    raise exception 'CHECKOUT_IDENTITY_REQUIRED';
  end if;
  -- Exactly one identity, matching orders_identity_check.
  if (p_buyer_id is null) = (v_guest_email is null) then
    raise exception 'CHECKOUT_IDENTITY_REQUIRED';
  end if;
  v_is_guest := p_buyer_id is null;

  if p_legal_acceptance is null
     or not (p_legal_acceptance @> '{"terms":true,"privacy":true,"returns":true}')
  then
    raise exception 'LEGAL_ACCEPTANCE_REQUIRED';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 50
  then
    raise exception 'COD_ITEMS_INVALID';
  end if;

  -- Same normalisation the order engine performs, so the fingerprint is taken
  -- over the canonical request rather than over incidental client ordering.
  select jsonb_agg(jsonb_build_object('variant_id', variant_id, 'qty', qty) order by variant_id)
  into v_norm
  from (
    select (e->>'variant_id')::uuid as variant_id, sum((e->>'qty')::integer) as qty
    from jsonb_array_elements(p_items) e
    group by 1
  ) q;
  if exists (
    select 1 from jsonb_to_recordset(v_norm) x(variant_id uuid, qty integer)
    where x.qty is null or x.qty not between 1 and 500 or x.variant_id is null
  ) then
    raise exception 'COD_QTY_INVALID';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      jsonb_build_array(
        'cod', p_buyer_id, v_guest_email, v_norm, p_shipping_address,
        p_shipping_aed, p_tax_rate, p_legal_acceptance
      )::text,
      'sha256'
    ),
    'hex'
  );

  if v_is_guest then
    -- COD abuse control: a guest email cannot stack up unfulfilled orders.
    -- Cancelled and delivered orders do not count, and an idempotent replay
    -- never reaches this check because it returns earlier.
    select count(*) into v_recent
    from public.orders o
    where o.guest_email = v_guest_email
      and o.created_at > now() - interval '24 hours'
      and o.status in ('pending', 'confirmed', 'processing');
    if v_recent >= 5 then
      raise exception 'GUEST_ORDER_RATE_LIMITED';
    end if;

    insert into commerce_private.guest_checkout_operations (operation_id, fingerprint)
    values (p_operation_id, v_fingerprint)
    on conflict do nothing;

    select fingerprint, order_id into v_existing_fingerprint, v_order_id
    from commerce_private.guest_checkout_operations
    where operation_id = p_operation_id
    for update;
  else
    insert into commerce_private.card_checkout_operations (buyer_id, operation_id, fingerprint)
    values (p_buyer_id, p_operation_id, v_fingerprint)
    on conflict do nothing;

    select fingerprint, order_id into v_existing_fingerprint, v_order_id
    from commerce_private.card_checkout_operations
    where buyer_id = p_buyer_id and operation_id = p_operation_id
    for update;
  end if;

  if v_existing_fingerprint is null then
    -- The operation id belongs to another identity (for example a card
    -- attempt, or another guest). Never adopt it.
    raise exception 'CHECKOUT_IDEMPOTENCY_CONFLICT';
  end if;
  if v_existing_fingerprint <> v_fingerprint then
    raise exception 'CHECKOUT_IDEMPOTENCY_CONFLICT';
  end if;

  if v_order_id is null then
    v_result := public.place_cod_order_v2(
      p_buyer_id, v_guest_email, v_norm, p_shipping_address,
      p_shipping_aed, p_tax_rate, p_legal_acceptance
    );
    v_order_id := (v_result->>'order_id')::uuid;

    if v_is_guest then
      update commerce_private.guest_checkout_operations
      set order_id = v_order_id
      where operation_id = p_operation_id;

      -- Capability token for order tracking without an account. Returned once.
      v_token := encode(extensions.gen_random_bytes(32), 'hex');
      insert into commerce_private.guest_order_access (order_id, token_hash, email)
      values (
        v_order_id,
        encode(extensions.digest(v_token, 'sha256'), 'hex'),
        v_guest_email
      );
      v_result := v_result || jsonb_build_object('guest_token', v_token);
    else
      update commerce_private.card_checkout_operations
      set order_id = v_order_id
      where buyer_id = p_buyer_id and operation_id = p_operation_id;
    end if;

    return v_result || jsonb_build_object('replayed', false);
  end if;

  -- Replay: return the order this operation already created, never a new one.
  -- No token is re-issued: it exists only as a hash.
  select * into v_order from public.orders where id = v_order_id;
  if not found then
    raise exception 'CHECKOUT_OPERATION_ORDER_MISSING';
  end if;
  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'subtotal_aed', v_order.subtotal_aed,
    'shipping_aed', v_order.shipping_aed,
    'tax_aed', v_order.tax_aed,
    'total_aed', v_order.total_aed,
    'replayed', true
  );
end;
$$;

revoke all on function public.cm_create_cod_order_v2(uuid, text, uuid, jsonb, jsonb, numeric, numeric, jsonb)
  from public, anon, authenticated;
grant execute on function public.cm_create_cod_order_v2(uuid, text, uuid, jsonb, jsonb, numeric, numeric, jsonb)
  to service_role;

comment on function public.cm_create_cod_order_v2(uuid, text, uuid, jsonb, jsonb, numeric, numeric, jsonb) is
  'CornerMex 2.0: idempotent COD order creation for guest and authenticated customers. Fingerprints the normalised request, delegates to place_cod_order_v2, and mints a one-time guest tracking token. Service-role only.';

-- Guest order lookup by capability token. Returns only what a customer needs to
-- see their own order; never PII beyond what they submitted, and never anything
-- for a wrong or missing token.
create or replace function public.cm_guest_order_by_token_v1(
  p_order_id uuid,
  p_token text
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_hash text;
begin
  if p_order_id is null or p_token is null or char_length(p_token) <> 64 then
    return null;
  end if;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- Constant work whether or not the row exists: look the order up only through
  -- a matching token hash, so an order id alone reveals nothing.
  select o.* into v_order
  from public.orders o
  join commerce_private.guest_order_access g on g.order_id = o.id
  where o.id = p_order_id and g.token_hash = v_hash;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'subtotal_aed', v_order.subtotal_aed,
    'shipping_aed', v_order.shipping_aed,
    'tax_aed', v_order.tax_aed,
    'total_aed', v_order.total_aed,
    'created_at', v_order.created_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_name', i.product_name,
        'variant_label', i.variant_label,
        'qty', i.qty,
        'line_total_aed', i.line_total_aed
      ) order by i.product_name), '[]'::jsonb)
      from public.order_items i where i.order_id = v_order.id
    )
  );
end;
$$;

revoke all on function public.cm_guest_order_by_token_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cm_guest_order_by_token_v1(uuid, text)
  to service_role;

comment on function public.cm_guest_order_by_token_v1(uuid, text) is
  'CornerMex 2.0: returns a guest order only when the capability token matches. An order id alone reveals nothing. Service-role only.';

-- Guest order claim. Linking a past guest order to an account is a privacy
-- decision, so it requires BOTH proofs and never just one:
--   1. possession of the order's capability token, and
--   2. an account whose email is VERIFIED and equal to the order's guest email.
-- A matching but unverified email is insufficient, and a different account can
-- never claim the order even with the token.
create or replace function public.cm_claim_guest_order_v1(
  p_user_id uuid,
  p_order_id uuid,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_order public.orders%rowtype;
  v_hash text;
begin
  if p_user_id is null or p_order_id is null or p_token is null or char_length(p_token) <> 64 then
    raise exception 'ORDER_CLAIM_INVALID';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'ORDER_CLAIM_INVALID';
  end if;
  if v_confirmed is null then
    raise exception 'ORDER_CLAIM_EMAIL_NOT_VERIFIED';
  end if;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select o.* into v_order
  from public.orders o
  join commerce_private.guest_order_access g on g.order_id = o.id
  where o.id = p_order_id and g.token_hash = v_hash
  for update of o;

  if not found then
    -- Already claimed by this same user? Then this is a harmless repeat.
    select o.* into v_order from public.orders o
    where o.id = p_order_id and o.buyer_id = p_user_id;
    if found then
      return jsonb_build_object('order_id', v_order.id, 'claimed', true, 'repeat', true);
    end if;
    raise exception 'ORDER_CLAIM_INVALID';
  end if;

  if v_order.guest_email is null then
    raise exception 'ORDER_CLAIM_INVALID';
  end if;
  if v_order.guest_email <> v_email then
    raise exception 'ORDER_CLAIM_EMAIL_MISMATCH';
  end if;

  update public.orders
  set buyer_id = p_user_id, guest_email = null, updated_at = now()
  where id = p_order_id;

  -- The order now belongs to an account, so the capability token is retired.
  delete from commerce_private.guest_order_access where order_id = p_order_id;

  return jsonb_build_object('order_id', p_order_id, 'claimed', true, 'repeat', false);
end;
$$;

revoke all on function public.cm_claim_guest_order_v1(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cm_claim_guest_order_v1(uuid, uuid, text)
  to service_role;

comment on function public.cm_claim_guest_order_v1(uuid, uuid, text) is
  'CornerMex 2.0: links a guest order to an account. Requires the capability token AND a verified account email equal to the order guest email. Service-role only.';
