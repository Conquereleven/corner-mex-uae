-- CM-PRESENT-2 canonical catalogue taxonomy dry run.
-- READ ONLY. This file performs no INSERT, UPDATE, DELETE, DDL, or migration apply.
-- It is intended to prove exact population coverage before any separately authorized
-- production-data patch is prepared or executed.

with taxonomy(slug, name_en, name_es, name_ar, sort_order) as (
  values
    ('chiles-spices', 'Chiles & Spices', 'Chiles y especias', 'الفلفل والتوابل', 10),
    ('salsas-moles', 'Salsas & Moles', 'Salsas y moles', 'الصلصات والمولي', 20),
    ('tortillas-masa', 'Tortillas & Masa', 'Tortillas y masa', 'التورتيلا والماسا', 30),
    ('pantry-staples', 'Pantry Staples', 'Despensa básica', 'أساسيات المؤن', 40),
    ('snacks-sweets', 'Snacks & Sweets', 'Snacks y dulces', 'الوجبات الخفيفة والحلويات', 50),
    ('drinks', 'Drinks', 'Bebidas', 'المشروبات', 60),
    ('chilled-frozen', 'Chilled & Frozen', 'Refrigerados y congelados', 'مبرد ومجمد', 70),
    ('kitchen-tableware', 'Kitchen & Tableware', 'Cocina y mesa', 'المطبخ وأدوات المائدة', 80),
    ('gifts-lifestyle', 'Gifts & Lifestyle', 'Regalos y estilo mexicano', 'هدايا وأسلوب حياة', 90)
),
base as (
  select
    p.id,
    p.slug,
    p.category_id,
    coalesce(max(pt.name) filter (where pt.lang = 'en'), p.slug) as name_en,
    lower(coalesce(max(pt.name) filter (where pt.lang = 'en'), p.slug)) as normalized_name
  from public.products p
  left join public.product_translations pt on pt.product_id = p.id
  where p.status = 'active'
  group by p.id, p.slug, p.category_id
),
classified as (
  select
    base.*,
    case
      -- Exact overrides for catalogue records whose customer-facing name alone is ambiguous.
      when slug = 'banderilla-tamaroca-tamarind-mexican-stick-30pcs' then 'snacks-sweets'
      when slug in (
        'clemente-jacques-chipotle-peppers-in-adobo',
        'la-costena-diced-chipotle-peppers',
        'herdez-white-mexican-corn'
      ) then 'pantry-staples'
      when slug = 'handwoven-palm-coasters' then 'kitchen-tableware'
      when slug = 'homestyle-la-costen-475gm' then 'salsas-moles'

      -- Lifestyle and non-food merchandise.
      when normalized_name ~ '(bandana|sombrero|t-shirt|table runner|zarape|piñata|pinata|coaster|basket|party kit|floral)'
        then 'gifts-lifestyle'

      -- Kitchen tools and tabletop items.
      when normalized_name ~ '(tortilla press|molcajete|mortar|pestle|heat-resistant mat)'
        then 'kitchen-tableware'

      -- Drinks and drink concentrates.
      when normalized_name ~ '(jarritos|clamato|horchata|jamaica drink|tamarind concentrate|drink concentrate|chocolate abuelita)'
        then 'drinks'

      -- Products whose handling is materially chilled/frozen.
      when normalized_name ~ '(chorizo|queso cotija|popsicle)'
        then 'chilled-frozen'

      -- Masa, flour, tortillas and tostadas. Chips are intentionally excluded.
      when normalized_name ~ '(tortilla|tostada|masa flour|corn flour|nixtamalized corn flour)'
        and normalized_name !~ '(chips)'
        then 'tortillas-masa'

      -- Snacks are classified before sauce keywords so names such as
      -- "Ruffles Mega Crunch Red Salsa" and "Chicharron Green Sauce" stay snacks.
      when normalized_name ~ '(candy|candies|mazapan|pulparindo|pelon pelo|lucas muecas|paleta payaso|palebola|banderilla|churrito|nachos|tortilla chips|ruffles|fritos|peanuts|barritas|gansito|choco roles|chicharron|hungry guru|snack wheel|rancheritos)'
        then 'snacks-sweets'

      -- Prepared sauces, mole and condiments. Generic seasoning sauce is pantry.
      when normalized_name ~ '(hot sauce|salsa|sauce|mole|guacamole|chamoy|chipotle sauce|dip |mojito|piñera|bichi|bichola|marisquera)'
        and normalized_name !~ '(seasoning sauce)'
        then 'salsas-moles'

      -- Whole/powdered dried chiles and chile seasoning.
      when normalized_name ~ '(whole .*chili|whole chile|chili powder|chile ancho|dried chil|tajin classico seasoning|árbol chili|guajillo chili|ancho chili|cascabel chili|pasilla chili|chipotle chili)'
        then 'chiles-spices'

      -- Shelf-stable pantry ingredients and preserved produce.
      when normalized_name ~ '(apricot|peach|guava|beans|bean|rice|corn starch|hominy|maiz blanco|white corn|esquite|cactus|nopales|nopalitos|huitlacoche|jalapeño|jalapeno|tomatillo|corn husks|instant noodles|maruchan|agave syrup|jam|mayonesa|mayonnaise|maggi|achiote|cajeta|chipotle peppers)'
        then 'pantry-staples'
      else null
    end as proposed_category
  from base
),
counts as (
  select proposed_category, count(*)::int as products
  from classified
  group by proposed_category
),
placeholder as (
  select id
  from public.categories
  where slug = 'uncategorized'
  limit 1
)
select jsonb_build_object(
  'expected_active_products', 195,
  'actual_active_products', (select count(*) from base),
  'taxonomy', (
    select jsonb_agg(
      jsonb_build_object(
        'slug', taxonomy.slug,
        'name_en', taxonomy.name_en,
        'name_es', taxonomy.name_es,
        'name_ar', taxonomy.name_ar,
        'sort_order', taxonomy.sort_order,
        'products', coalesce(counts.products, 0)
      )
      order by taxonomy.sort_order
    )
    from taxonomy
    left join counts on counts.proposed_category = taxonomy.slug
  ),
  'unclassified', (
    select coalesce(
      jsonb_agg(jsonb_build_object('slug', slug, 'name_en', name_en) order by slug),
      '[]'::jsonb
    )
    from classified
    where proposed_category is null
  ),
  'products_outside_expected_placeholder_before_apply', (
    select count(*)
    from classified
    where category_id is distinct from (select id from placeholder)
  ),
  'zero_or_negative_price_active_products', (
    select coalesce(
      jsonb_agg(distinct jsonb_build_object('slug', p.slug, 'sku', pv.sku, 'price_aed', pv.price_aed)),
      '[]'::jsonb
    )
    from public.products p
    join public.product_variants pv on pv.product_id = p.id
    where p.status = 'active'
      and pv.is_active
      and pv.price_aed <= 0
  )
) as cm_present_2_taxonomy_dry_run;
