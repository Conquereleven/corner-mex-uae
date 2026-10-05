# Skydropx

**Capability level:** `SCAFFOLDED`. No credentials exist in this project; no
request has been sent to Skydropx.

**Source:** official API reference, <https://pro.skydropx.com/es-MX/api-docs>,
read 2026-10-04. This is the current "PRO" API generation (OAuth client
credentials). The older API-key API is not used.

## Contract implemented

| Operation | Request |
| --- | --- |
| Token | `POST /api/v1/oauth/token` — `{grant_type: "client_credentials", client_id, client_secret}` → `{access_token, token_type, expires_in, created_at}` |
| Quote | `POST /api/v1/quotations` — `{quotation: {address_from, address_to, parcels[]}}`, then poll `GET /api/v1/quotations/{id}` until `is_completed` |
| Create shipment | `POST /api/v1/shipments` — `{shipment: {rate_id, unique_shipment, address_from, address_to, packages[]}}` |
| Get shipment | `GET /api/v1/shipments/{id}` |
| Cancel | `POST /api/v1/shipments/{id}/cancellations` — `{reason}` |
| Tracking | `GET /api/v1/shipments/tracking?tracking_number=&carrier_name=` |
| Labels | `label_url` on each package of the shipment |

Documented facts the adapter relies on:

- The token **expires in 2 hours**; it is cached and refreshed 5 minutes early,
  with one token request in flight at a time. A `401` drops the token and retries
  once.
- **2 requests per second.** Requests are serialised and spaced 500 ms apart.
- Quotations are **asynchronous**; rates are **valid for 24 hours**.
- `unique_shipment: true` makes a repeated `rate_id` replay the original
  response (`200`), or return `409` while the first is in flight; cache 96 h. The
  adapter always sends it.
- Address field limits: name 30, company 60, reference 30 / 40.
- Webhooks: `Authorization: HMAC <hex>`, HMAC-SHA512 over the raw body; two
  retries, five minutes apart.

Available in the API but not used yet: pickups (`/api/v1/pickups`, v2),
multi-package quotations (`parcels[]` is already sent as an array), shipment
protection, office points (Ocurre), address templates.

## Open points to verify with a real account

1. **Host.** The reference's code samples call `pro.skydropx.com`; its quick-start
   note says to use `api-pro.skydropx.com`. The default follows the note; set
   `SKYDROPX_BASE_URL` if the account differs.
2. **Carta Porte codes.** Creating a label needs `consignment_note` and
   `package_type` per package. The right codes for food products must be chosen
   from the provider's list.
3. **`workflow_status` values.** Only `pending` and `success` are shown in the
   reference; others are mapped defensively and unknown values are preserved raw.
4. **v2 endpoints** (`/api/v2/shipments`, `/api/v2/quotations`) exist alongside
   v1 with no deprecation notice. v1 is implemented.

## Configuration

| Variable | |
| --- | --- |
| `SKYDROPX_ENABLED` | `true` to use the provider |
| `SKYDROPX_CLIENT_ID`, `SKYDROPX_CLIENT_SECRET` | From Skydropx → Conexiones → API |
| `SKYDROPX_ENVIRONMENT` | `sandbox` (default) or `production` |
| `SKYDROPX_BASE_URL` | Optional https override |
| `SKYDROPX_WEBHOOK_SECRET` | HMAC secret for webhooks (MX-3) |

Sandbox host `https://sb-pro.skydropx.com`. Production must be requested by
name, and production credentials alone are never reported as `CONNECTED`.

## To reach `SANDBOX`

Founder creates a Skydropx account, generates sandbox API credentials and
provides the Client ID and Client Secret through the deployment's secret store.
