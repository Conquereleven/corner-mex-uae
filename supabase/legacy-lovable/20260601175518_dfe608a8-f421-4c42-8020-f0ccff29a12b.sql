
-- ============ ENUMS ============
CREATE TYPE public.review_status AS ENUM ('pending','approved','hidden');
CREATE TYPE public.loyalty_tier AS ENUM ('bronze','silver','gold','platinum');
CREATE TYPE public.loyalty_txn_kind AS ENUM ('earn','redeem','adjust','expire');
CREATE TYPE public.return_status AS ENUM ('requested','approved','rejected','received','refunded','cancelled');
CREATE TYPE public.return_reason AS ENUM ('damaged','wrong_item','not_as_described','quality_issue','no_longer_needed','other');

-- ============ PRODUCT REVIEWS ============
CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  order_id uuid,
  seller_id uuid,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  status public.review_status NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, buyer_id, order_id)
);
CREATE INDEX idx_reviews_product ON public.product_reviews(product_id, status);
CREATE INDEX idx_reviews_buyer ON public.product_reviews(buyer_id);

GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews: public read approved" ON public.product_reviews
  FOR SELECT USING (status = 'approved');
CREATE POLICY "Reviews: buyer read own" ON public.product_reviews
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Reviews: buyer insert own" ON public.product_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Reviews: buyer update own" ON public.product_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Reviews: buyer delete own" ON public.product_reviews
  FOR DELETE TO authenticated USING (auth.uid() = buyer_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Reviews: admin all" ON public.product_reviews
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_reviews_touch BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ WISHLIST ============
CREATE TABLE public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
CREATE INDEX idx_wishlists_user ON public.wishlists(user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wishlist: own all" ON public.wishlists
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ LOYALTY ACCOUNTS + TRANSACTIONS ============
CREATE TABLE public.loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tier public.loyalty_tier NOT NULL DEFAULT 'bronze',
  points_balance int NOT NULL DEFAULT 0,
  lifetime_spend_aed numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;

ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Loyalty acc: own read" ON public.loyalty_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Loyalty acc: admin all" ON public.loyalty_accounts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_loyalty_acc_touch BEFORE UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TABLE public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid,
  kind public.loyalty_txn_kind NOT NULL,
  points int NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_txn_user ON public.loyalty_transactions(user_id, created_at DESC);

GRANT SELECT ON public.loyalty_transactions TO authenticated;
GRANT ALL ON public.loyalty_transactions TO service_role;

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Loyalty txn: own read" ON public.loyalty_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Loyalty txn: admin all" ON public.loyalty_transactions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ RETURNS / RMA ============
CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL DEFAULT ('RMA-'||to_char(now(),'YYYYMMDD')||'-'||substr(gen_random_uuid()::text,1,6)),
  order_id uuid NOT NULL,
  order_item_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  qty int NOT NULL CHECK (qty > 0),
  reason public.return_reason NOT NULL,
  status public.return_status NOT NULL DEFAULT 'requested',
  buyer_notes text,
  seller_response text,
  refund_aed numeric(12,2),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_returns_buyer ON public.returns(buyer_id, created_at DESC);
CREATE INDEX idx_returns_seller ON public.returns(seller_id, status);
CREATE INDEX idx_returns_order ON public.returns(order_id);

GRANT SELECT, INSERT, UPDATE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Returns: buyer read own" ON public.returns
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id);
CREATE POLICY "Returns: buyer insert own" ON public.returns
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Returns: buyer update own pending" ON public.returns
  FOR UPDATE TO authenticated USING (auth.uid() = buyer_id AND status IN ('requested')) WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Returns: seller read own" ON public.returns
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = returns.seller_id AND s.user_id = auth.uid()));
CREATE POLICY "Returns: seller update own" ON public.returns
  FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = returns.seller_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = returns.seller_id AND s.user_id = auth.uid()));
CREATE POLICY "Returns: admin all" ON public.returns
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_returns_touch BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
