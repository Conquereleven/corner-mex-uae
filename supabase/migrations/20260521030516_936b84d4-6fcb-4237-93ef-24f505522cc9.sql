
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('buyer', 'seller', 'admin');
CREATE TYPE public.seller_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE public.product_status AS ENUM ('draft', 'pending', 'active', 'archived');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE public.payment_method AS ENUM ('stripe', 'cod', 'bank_transfer', 'quote');
CREATE TYPE public.payment_status AS ENUM ('pending', 'authorized', 'paid', 'failed', 'refunded');
CREATE TYPE public.quote_status AS ENUM ('open', 'responded', 'accepted', 'rejected', 'expired');
CREATE TYPE public.lang_code AS ENUM ('en', 'ar', 'es');
CREATE TYPE public.emirate AS ENUM ('abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  preferred_lang public.lang_code NOT NULL DEFAULT 'en',
  company_name TEXT,
  trn TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger: every new auth.users gets a profile + buyer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ SELLERS ============
CREATE TABLE public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT,
  bio TEXT,
  logo_url TEXT,
  cover_url TEXT,
  status public.seller_status NOT NULL DEFAULT 'pending',
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 12.00,
  contact_email TEXT,
  contact_phone TEXT,
  trn TEXT,
  bank_name TEXT,
  bank_iban TEXT,
  bank_account_holder TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER sellers_touch BEFORE UPDATE ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_es TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  description_es TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  brand TEXT,
  status public.product_status NOT NULL DEFAULT 'draft',
  is_halal BOOLEAN NOT NULL DEFAULT true,
  is_bulk BOOLEAN NOT NULL DEFAULT false,
  spice_level INT CHECK (spice_level BETWEEN 0 AND 5),
  origin_region TEXT,
  attrs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE INDEX products_seller_idx ON public.products(seller_id);
CREATE INDEX products_category_idx ON public.products(category_id);
CREATE INDEX products_status_idx ON public.products(status);

CREATE TABLE public.product_translations (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lang public.lang_code NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (product_id, lang)
);
ALTER TABLE public.product_translations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT,
  format_label TEXT,            -- "250g jar", "Pack of 6", "5kg bulk bag"
  weight_grams INT,
  price_aed NUMERIC(10,2) NOT NULL,
  compare_at_price_aed NUMERIC(10,2),
  stock INT NOT NULL DEFAULT 0,
  bulk_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{min_qty:10, price_aed:..}, ...]
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE INDEX variants_product_idx ON public.product_variants(product_id);

CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- ============ ADDRESSES ============
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  emirate public.emirate NOT NULL,
  area TEXT NOT NULL,
  street TEXT,
  building TEXT,
  floor_apt TEXT,
  landmark TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE INDEX addresses_user_idx ON public.addresses(user_id);

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('CMX-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal_aed NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_aed NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_aed NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_aed NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL,
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  shipping_address JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE INDEX orders_buyer_idx ON public.orders(buyer_id);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.sellers(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID NOT NULL REFERENCES public.product_variants(id),
  product_name TEXT NOT NULL,
  variant_label TEXT,
  qty INT NOT NULL CHECK (qty > 0),
  unit_price_aed NUMERIC(10,2) NOT NULL,
  line_total_aed NUMERIC(12,2) NOT NULL,
  commission_aed NUMERIC(12,2) NOT NULL DEFAULT 0,
  fulfillment_status public.order_status NOT NULL DEFAULT 'pending'
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
CREATE INDEX order_items_seller_idx ON public.order_items(seller_id);

-- ============ QUOTES (B2B) ============
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE DEFAULT ('Q-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  company_name TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  status public.quote_status NOT NULL DEFAULT 'open',
  response JSONB,
  total_estimate_aed NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER quotes_touch BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  external_id TEXT,
  amount_aed NUMERIC(12,2) NOT NULL,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============ SELLER PAYOUTS ============
CREATE TABLE public.seller_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_aed NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_aed NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_aed NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Profiles: own select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: own update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: admin select all" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles (only admin can write; user can see own)
CREATE POLICY "Roles: own select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Roles: admin delete" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- sellers
CREATE POLICY "Sellers: public read active" ON public.sellers FOR SELECT USING (status = 'active');
CREATE POLICY "Sellers: own read" ON public.sellers FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sellers: self insert" ON public.sellers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Sellers: self update" ON public.sellers FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sellers: admin delete" ON public.sellers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- categories (public read, admin write)
CREATE POLICY "Categories: public read" ON public.categories FOR SELECT USING (is_active = true);
CREATE POLICY "Categories: admin all" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- products (public read active; seller own; admin all)
CREATE POLICY "Products: public read active" ON public.products FOR SELECT USING (status = 'active');
CREATE POLICY "Products: seller own read" ON public.products FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = products.seller_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Products: seller insert" ON public.products FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
);
CREATE POLICY "Products: seller update" ON public.products FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = products.seller_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Products: seller delete" ON public.products FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = products.seller_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- product_translations / variants / images: piggyback on product visibility
CREATE POLICY "ProductTr: public read" ON public.product_translations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active')
);
CREATE POLICY "ProductTr: seller/admin all" ON public.product_translations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.products p JOIN public.sellers s ON s.id = p.seller_id WHERE p.id = product_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.sellers s ON s.id = p.seller_id WHERE p.id = product_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE POLICY "Variants: public read" ON public.product_variants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active')
);
CREATE POLICY "Variants: seller/admin all" ON public.product_variants FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.products p JOIN public.sellers s ON s.id = p.seller_id WHERE p.id = product_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.sellers s ON s.id = p.seller_id WHERE p.id = product_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE POLICY "Images: public read" ON public.product_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active')
);
CREATE POLICY "Images: seller/admin all" ON public.product_images FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.products p JOIN public.sellers s ON s.id = p.seller_id WHERE p.id = product_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.sellers s ON s.id = p.seller_id WHERE p.id = product_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- addresses
CREATE POLICY "Addresses: own all" ON public.addresses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- orders
CREATE POLICY "Orders: buyer read" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Orders: seller read involved" ON public.orders FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.order_items oi JOIN public.sellers s ON s.id = oi.seller_id WHERE oi.order_id = orders.id AND s.user_id = auth.uid())
);
CREATE POLICY "Orders: buyer insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Orders: admin update" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- order_items
CREATE POLICY "OrderItems: buyer read" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "OrderItems: buyer insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid())
);
CREATE POLICY "OrderItems: seller update own" ON public.order_items FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- quotes
CREATE POLICY "Quotes: buyer all own" ON public.quotes FOR ALL TO authenticated USING (auth.uid() = buyer_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = buyer_id OR public.has_role(auth.uid(), 'admin'));

-- payments
CREATE POLICY "Payments: buyer read own" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- payouts
CREATE POLICY "Payouts: seller read own" ON public.seller_payouts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Payouts: admin write" ON public.seller_payouts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SEED CATEGORIES ============
INSERT INTO public.categories (slug, name_en, name_ar, name_es, sort_order) VALUES
  ('chiles', 'Dried Chiles', 'الفلفل المجفف', 'Chiles Secos', 1),
  ('salsas', 'Salsas & Sauces', 'الصلصات', 'Salsas', 2),
  ('masa', 'Masa & Flours', 'الذرة والدقيق', 'Masa y Harinas', 3),
  ('snacks', 'Snacks & Sweets', 'الوجبات الخفيفة والحلويات', 'Snacks y Dulces', 4),
  ('beverages', 'Beverages', 'المشروبات', 'Bebidas', 5),
  ('bulk', 'HORECA Supply', 'إمدادات المطاعم والفنادق', 'Mayoreo HORECA', 6);
