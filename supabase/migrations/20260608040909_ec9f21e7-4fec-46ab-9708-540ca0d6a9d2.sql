CREATE OR REPLACE FUNCTION public.admin_update_order_state(
  p_order_id uuid,
  p_status public.order_status DEFAULT NULL,
  p_payment_status public.payment_status DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.orders;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL AND p_payment_status IS NULL THEN
    RAISE EXCEPTION 'At least one state must be supplied';
  END IF;

  UPDATE public.orders
  SET
    status = COALESCE(p_status, status),
    payment_status = COALESCE(p_payment_status, payment_status)
  WHERE id = p_order_id
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.seller_update_order_item_fulfillment(
  p_item_id uuid,
  p_status public.order_status
)
RETURNS public.order_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_item public.order_items;
  result public.order_items;
  next_order_status public.order_status;
BEGIN
  SELECT oi.*
  INTO current_item
  FROM public.order_items oi
  JOIN public.sellers s ON s.id = oi.seller_id
  WHERE oi.id = p_item_id
    AND s.user_id = auth.uid()
  FOR UPDATE;

  IF current_item.id IS NULL THEN
    RAISE EXCEPTION 'Order item not found or not owned by seller' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('pending', 'preparing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Unsupported fulfillment status';
  END IF;

  IF current_item.fulfillment_status IN ('delivered', 'cancelled', 'refunded')
     AND p_status <> current_item.fulfillment_status THEN
    RAISE EXCEPTION 'Final fulfillment states cannot be changed';
  END IF;

  IF p_status = 'shipped' AND current_item.shipment_id IS NULL THEN
    RAISE EXCEPTION 'Create a shipment before marking an item shipped';
  END IF;

  IF p_status = 'delivered'
     AND current_item.fulfillment_status NOT IN ('shipped', 'delivered') THEN
    RAISE EXCEPTION 'Only shipped items can be marked delivered';
  END IF;

  UPDATE public.order_items
  SET fulfillment_status = p_status
  WHERE id = current_item.id
  RETURNING * INTO result;

  SELECT CASE
    WHEN bool_and(fulfillment_status = 'delivered') THEN 'delivered'::public.order_status
    WHEN bool_or(fulfillment_status IN ('shipped', 'delivered')) THEN 'shipped'::public.order_status
    WHEN bool_or(fulfillment_status = 'preparing') THEN 'preparing'::public.order_status
    WHEN bool_and(fulfillment_status IN ('cancelled', 'refunded')) THEN 'cancelled'::public.order_status
    ELSE 'pending'::public.order_status
  END
  INTO next_order_status
  FROM public.order_items
  WHERE order_id = current_item.order_id;

  UPDATE public.orders
  SET status = next_order_status
  WHERE id = current_item.order_id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_state(uuid, public.order_status, public.payment_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seller_update_order_item_fulfillment(uuid, public.order_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_order_state(uuid, public.order_status, public.payment_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seller_update_order_item_fulfillment(uuid, public.order_status) TO authenticated;