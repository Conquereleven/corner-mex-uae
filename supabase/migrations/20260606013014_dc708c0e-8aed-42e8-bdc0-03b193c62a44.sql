
do $$
declare
  v_seller_id uuid := 'b88f10d7-c0f4-4b55-a6eb-a657bb8547e6';
  v_buyer_id uuid := '36d9e32a-12bb-48d0-8d88-1d5e5acb1ca3';
  v_cat_chiles uuid; v_cat_salsas uuid; v_cat_snacks uuid;
  v_p1 uuid; v_p2 uuid; v_p3 uuid;
  v_v1 uuid; v_v2 uuid; v_v3 uuid;
  v_o1 uuid; v_o2 uuid;
begin
  if not exists (select 1 from public.sellers where id = v_seller_id) then return; end if;
  if exists (select 1 from public.products where seller_id = v_seller_id) then return; end if;

  select id into v_cat_chiles from public.categories where slug = 'chiles' limit 1;
  select id into v_cat_salsas from public.categories where slug = 'salsas' limit 1;
  select id into v_cat_snacks from public.categories where slug = 'snacks' limit 1;

  v_p1 := gen_random_uuid(); v_p2 := gen_random_uuid(); v_p3 := gen_random_uuid();

  insert into public.products (id, seller_id, category_id, slug, brand, status, is_halal, is_bulk, spice_level, origin_region) values
    (v_p1, v_seller_id, v_cat_chiles, 'intermex-chile-guajillo-200g', 'Intermex', 'active', true, false, 3, 'Zacatecas'),
    (v_p2, v_seller_id, v_cat_salsas, 'intermex-salsa-verde-450g', 'Intermex', 'active', true, false, 2, 'Jalisco'),
    (v_p3, v_seller_id, v_cat_snacks, 'intermex-totopos-azules-300g', 'Intermex', 'active', true, false, 1, 'Oaxaca');

  insert into public.product_translations (product_id, lang, name, description) values
    (v_p1, 'en', 'Guajillo Chiles 200g', 'Whole dried guajillo chiles, mild heat, rich flavor.'),
    (v_p1, 'es', 'Chile Guajillo 200g', 'Chiles guajillo enteros, picor suave y sabor profundo.'),
    (v_p2, 'en', 'Green Salsa 450g', 'Tomatillo and serrano green salsa, ready to serve.'),
    (v_p2, 'es', 'Salsa Verde 450g', 'Salsa verde de tomatillo y serrano, lista para servir.'),
    (v_p3, 'en', 'Blue Corn Tortilla Chips 300g', 'Stone-ground blue corn totopos.'),
    (v_p3, 'es', 'Totopos de Maiz Azul 300g', 'Totopos de maiz azul molidos en metate.');

  v_v1 := gen_random_uuid(); v_v2 := gen_random_uuid(); v_v3 := gen_random_uuid();

  insert into public.product_variants (id, product_id, sku, format_label, weight_grams, price_aed, stock, is_default) values
    (v_v1, v_p1, 'INT-GUA-200', '200g bag', 200, 24.00, 50, true),
    (v_v2, v_p2, 'INT-SLV-450', '450g jar', 450, 18.50, 40, true),
    (v_v3, v_p3, 'INT-TOT-300', '300g bag', 300, 14.00, 60, true);

  insert into public.product_images (product_id, url, sort_order) values
    (v_p1, 'https://images.unsplash.com/photo-1583398701829-3055cf0baf78?w=800', 0),
    (v_p2, 'https://images.unsplash.com/photo-1599909533730-1b9c218ba61a?w=800', 0),
    (v_p3, 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=800', 0);

  v_o1 := gen_random_uuid();
  insert into public.orders (id, buyer_id, status, subtotal_aed, shipping_aed, tax_aed, total_aed, payment_method, payment_status, shipping_address) values
    (v_o1, v_buyer_id, 'preparing', 62.00, 15.00, 0, 77.00, 'card', 'paid',
      jsonb_build_object('name','Demo Buyer','line1','Sheikh Zayed Rd','city','Dubai','country','AE'));
  insert into public.order_items (order_id, seller_id, product_id, variant_id, product_name, variant_label, qty, unit_price_aed, line_total_aed, commission_aed, fulfillment_status) values
    (v_o1, v_seller_id, v_p1, v_v1, 'Chile Guajillo 200g', '200g bag', 2, 24.00, 48.00, 4.80, 'pending'),
    (v_o1, v_seller_id, v_p3, v_v3, 'Totopos de Maiz Azul 300g', '300g bag', 1, 14.00, 14.00, 1.40, 'pending');

  v_o2 := gen_random_uuid();
  insert into public.orders (id, buyer_id, status, subtotal_aed, shipping_aed, tax_aed, total_aed, payment_method, payment_status, shipping_address) values
    (v_o2, v_buyer_id, 'pending', 37.00, 12.00, 0, 49.00, 'cod', 'pending',
      jsonb_build_object('name','Demo Buyer','line1','Al Wasl Rd','city','Dubai','country','AE'));
  insert into public.order_items (order_id, seller_id, product_id, variant_id, product_name, variant_label, qty, unit_price_aed, line_total_aed, commission_aed, fulfillment_status) values
    (v_o2, v_seller_id, v_p2, v_v2, 'Salsa Verde 450g', '450g jar', 2, 18.50, 37.00, 3.70, 'pending');
end $$;
