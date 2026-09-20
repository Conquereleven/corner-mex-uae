# CornerMex — domain cutover to cornermex.ae

**Status:** YELLOW — pending. `cornermex.ae` is not purchased yet (verified
2026-09-20: no A record, no NS delegation). Nothing here has been configured,
and no DNS change is possible without domain access.
**Today the site serves from:** `https://corner-mex-uae-production.up.railway.app`
(the only domain attached to the Railway production service).

This document is the switch list. The application is already domain-ready: one
environment variable moves every server-rendered absolute URL.

---

## 1. The single control

`CORNERMEX_PUBLIC_APPLICATION_URL` (Railway production variable) feeds
`siteOrigin()` in `src/lib/site-url.ts`, which every canonical link, OpenGraph
URL, sitemap entry and Stripe callback derives from.

```
CORNERMEX_PUBLIC_APPLICATION_URL  ──▶ siteOrigin()/siteUrl()  ──▶ canonical, og:url, JSON-LD
                                  └─▶ stripe-checkout-provider.server.ts ──▶ success_url / cancel_url
```

Two things deliberately do **not** read it, and both are correct:

- **Browser-side redirects** (`/auth/callback` for Google) use
  `window.location.origin`, so they follow whatever host the customer is on.
- **`/robots.txt` and `/sitemap.xml`** are server routes that use the request's
  own origin. `public/robots.txt` used to hardcode the Railway host and was
  replaced by `src/routes/robots[.]txt.ts` for exactly this reason.

**Fallback behaviour to know about:** if the variable is unset,
`siteOrigin()` falls back to the hardcoded Railway origin rather than guessing.
That is fail-safe today, but after cutover an unset variable would silently
publish Railway canonicals. Setting the variable is therefore step 2 below, not
an afterthought.

## 2. Cutover checklist

Order matters: DNS and certificate first, then the app's own URL, then the
external systems that must match it.

| #   | Where                                                   | Change                                                                                                                                                                                                                                       | Who                 |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | Registrar                                               | Purchase `cornermex.ae`; delegate NS                                                                                                                                                                                                         | Founder             |
| 2   | Railway → service `corner-mex-uae` → Settings → Domains | Add custom domain `cornermex.ae` (and `www` if used); create the CNAME/A records Railway shows; wait for the certificate                                                                                                                     | Founder             |
| 3   | Railway → Variables                                     | `CORNERMEX_PUBLIC_APPLICATION_URL=https://cornermex.ae`, then redeploy (it is read at request time, but a redeploy makes the change observable and auditable)                                                                                | Founder             |
| 4   | Verify                                                  | `curl -s https://cornermex.ae/api/health`; canonical, `og:url`, `/sitemap.xml` and `/robots.txt` must all show `cornermex.ae`                                                                                                                | Engineering         |
| 5   | Supabase → Authentication → URL Configuration           | Site URL `https://cornermex.ae`; add `https://cornermex.ae/auth/callback` to the redirect allow-list. **Keep the Railway callback while both hosts answer**, then remove it                                                                  | Founder (dashboard) |
| 6   | Google Cloud console → OAuth client                     | Add `https://cornermex.ae` to authorised JavaScript origins and the Supabase callback URL to authorised redirect URIs                                                                                                                        | Founder             |
| 7   | Stripe dashboard                                        | Webhook endpoint → `https://cornermex.ae/api/public/stripe-webhook`; keep the old endpoint enabled until traffic moves, then disable. **Only when card is activated** — card is intentionally off                                            | Founder             |
| 8   | Zoho                                                    | Nothing at cutover; the organisation is not configured yet (see LEGAL-IDENTITY.md §4)                                                                                                                                                        | —                   |
| 9   | Email                                                   | `EXTERNAL_EMAIL_FROM` is `CornerMex <…>` on the provider sender domain; links in emails come from `siteUrl()`, so they follow step 3. External email is currently disabled                                                                   | Founder             |
| 10  | Old host                                                | Decide whether `…up.railway.app` 301-redirects to the new domain or stays reachable. Until it redirects, both hosts serve the same content — acceptable because each serves canonicals for its own origin, but a redirect is cleaner for SEO | Founder             |

## 3. CORS and allowed origins

The storefront is same-origin: the browser talks to its own server functions,
and Supabase is reached with the publishable key over Supabase's own CORS
policy, which accepts any origin. There is **no application CORS allow-list to
change**. The origin-sensitive lists are the two dashboard ones in steps 5 and 6.

## 4. What must not be done

- Do not point DNS anywhere before Railway issues the certificate; a half-cut
  domain serving an untrusted certificate is worse than no domain.
- Do not remove the Railway callback from Supabase in the same step as adding
  the new one: a customer mid-sign-in would fail.
- Do not hardcode `cornermex.ae` anywhere in the application. The variable is
  the control; a second source of truth is how the current `robots.txt` problem
  happened.

## 5. Verification after cutover

```bash
curl -s https://cornermex.ae/api/health                 # commit + status ok
curl -s https://cornermex.ae/robots.txt | tail -2       # Sitemap: https://cornermex.ae/sitemap.xml
curl -s https://cornermex.ae/ | grep -o 'rel="canonical" href="[^"]*"'
curl -s https://cornermex.ae/sitemap.xml | head -5
```

Then sign in with Google once end to end, and place one COD order on the new
domain before announcing it.
