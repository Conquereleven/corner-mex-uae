# Commerce Foundation A2

CornerMex is a single merchant. The A2 target is an empty, isolated Supabase project used only by Railway staging.

The baseline contains profiles, customer addresses, roles, categories, products, translations, images, variants, inventory, inventory movements, carts, orders, payments, reviews, coupons, catalog events and B2B leads. Every user-facing table has forced RLS. Anonymous users receive read access only to active catalog data, approved reviews and currently valid coupons. Customer rows are owner-scoped. Admin authority comes from `user_roles`, checked server-side by a restricted function.

Marketplace entities are deliberately absent. Product status defaults to `draft`, variant activity defaults false, inventory defaults zero, and checkout/payment/email/message flags default false. No business rows, Auth users or Storage buckets are created.
