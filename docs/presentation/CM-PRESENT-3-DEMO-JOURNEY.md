# CM-PRESENT-3 Demo Journey

Purpose: present CornerMex as an operating UAE commerce system without creating fake commercial activity or mutating production during the meeting.

## Current verified baseline

- Staging service: `cornermex-web-staging.up.railway.app`
- Starting application commit for this sprint: `908b9eb532b99c1ece9d2c1caf39c3135a0c36fb`
- Active catalogue products: 195
- Public canonical taxonomy: 9 categories
- Active products in `uncategorized`: 0
- Existing orders: 2, both delivered
- Existing B2B leads: 0
- Real payment execution remains outside the demo path
- B2B pricing and commercial terms remain human-reviewed

Do not put credentials, personal customer data, API keys or Supabase secrets in this document.

## Pre-demo check

1. Open `/api/health` and confirm `status: ok` and the expected deployed commit.
2. Open `/api/ready` and confirm `status: ready` and `target: reachable`.
3. Sign in with an existing authorized account before the meeting if the private admin segment will be shown.
4. Open `/admin` once and confirm Orders and B2B Leads render before starting the presentation.
5. Do not change Railway capability flags during the meeting.

If checkout execution is disabled by environment policy, keep the demo at the server-priced checkout preview and explain that execution is feature-gated. Do not activate a flag as part of the presentation.

## Recommended live sequence

### 1. Home

Open `/`.

Narrative:
- CornerMex is the UAE-facing single merchant.
- The storefront supports direct customer commerce and a separate human-reviewed B2B flow.

Click **Shop**.

### 2. Shop

Open `/shop`.

Show:
- category navigation generated from the canonical catalogue;
- AED pricing;
- filters/search;
- no placeholder `uncategorized` category;
- no zero-price product cards;
- CornerMex as the direct seller.

Recommended rehearsal product when still available:
- `Tajin Classico Seasoning 400gm`
- slug: `tajin-classico-seasoning-400gm`
- category: `chiles-spices`
- verified rehearsal price: AED 33.50

If that product becomes unavailable, choose any visible product with a positive displayed price. Do not alter inventory for the demo.

### 3. Product detail

Open the selected product.

Show:
- product imagery and description;
- category;
- positive AED price;
- CornerMex seller identity;
- checkout-verification language;
- **Add to cart**.

Add quantity 1 only.

### 4. Cart

Open `/cart`.

Show:
- single-merchant CornerMex grouping;
- subtotal and UAE VAT;
- shipping shown as pending destination verification;
- checkout CTA.

Click **Continue to checkout**.

### 5. Checkout

Open `/checkout`.

Show:
- delivery address fields;
- Emirate selection;
- server-derived price preview;
- COD-only payment method;
- legal acceptance;
- signed-in execution boundary.

For the presentation, stop before submitting an order unless there is a separate explicit reason to create a real order. The objective is to prove that the system reaches a trusted executable checkout, not to manufacture a transaction.

If the environment displays the checkout-disabled banner, explain the feature gate and demonstrate the interface/preview only. Do not change the flag live.

### 6. For Business

Navigate to `/b2b`, then `/b2b/catalog`.

Show:
- business-specific catalogue experience;
- curated product shortlist;
- quote selection;
- pricing/availability explicitly subject to human review.

Select one or two products and open `/b2b/quote`.

Show the structured business enquiry form and preview step. Do not submit a fake enquiry just to populate the pipeline.

### 7. Admin operations

Navigate to `/admin` using an already-authorized account.

Primary demo path only:
1. Overview
2. Orders
3. B2B Leads

In **Orders**, show the existing delivered-order history and operational status model.

In **B2B Leads**, the current truthful state is empty. Use that empty state to explain that a submitted B2B enquiry enters this human-owned pipeline with priority, owner, status, next action, risk flags, notes and first-purchase traceability.

Do not detour into navigation items marked `soon` during the core presentation.

## Safe fallback path

If any public data fetch is temporarily unavailable:
1. keep Home and B2B narrative available;
2. use the route's explicit retry/error state rather than refreshing repeatedly;
3. move to Admin Orders if authentication is already established;
4. never change database rows or Railway flags to rescue a live demo.

If admin authentication expires:
1. continue the public storefront/B2B portion;
2. sign in normally only if convenient;
3. do not weaken the admin route guard.

## Demo success criteria

The presentation is successful if the viewer can see one coherent operating loop:

`Home → Catalogue → Product → Cart → Checkout`

and one coherent business-operations loop:

`For Business → B2B Catalogue → Quote Enquiry → Admin B2B Leads`

with Orders demonstrating that CornerMex already has a real post-checkout operational surface.
