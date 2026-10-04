# Solo Envíos

**Capability level:** `SCAFFOLDED`. No credentials exist in this project; no
request has been sent to Solo Envíos.

**Source:** official API reference, <https://app.soloenvios.com/es-MX/api-docs>,
and help centre <https://ayuda.soloenvios.com>, read 2026-10-04.

## Same contract as Skydropx

Compared line by line on 2026-10-04, the Solo Envíos reference and the Skydropx
PRO reference describe the **same API**: identical paths, request and response
fields, error structure and webhook scheme. They differ in host, in where
credentials are found, and in branding. `src/lib/shipping/skydropx-platform.ts`
implements the contract once and `providers.ts` binds it to each provider.

They are still two independent providers to CornerMex — separate credentials,
token caches, rate limits and health — so each can quote and fail on its own. If
either contract diverges, it gets its own client.

Everything in `SKYDROPX.md` under "Contract implemented" applies. Specific to
Solo Envíos:

| | |
| --- | --- |
| Production host | `https://app.soloenvios.com` |
| Sandbox host | `https://sb-app.soloenvios.com` |
| Credentials | Solo Envíos → Integraciones → API |
| Token | Expires in 2 hours; 2 requests per second |
| Webhooks | HMAC (recommended) or token; HMAC-SHA512 over the raw body. Two retries, five minutes apart, then an email alert |
| Duplicate labels | Help centre warns against regenerating guides, since a cancelled guide can be reused within 90 days |

The duplicate-label warning is why `createShipment` is never retried: an unknown
outcome becomes `AMBIGUOUS_WRITE` and is resolved by lookup or by the provider's
idempotent replay (`SHIPPING.md`, "Label purchase").

## Configuration

`SOLO_ENVIOS_ENABLED`, `SOLO_ENVIOS_CLIENT_ID`, `SOLO_ENVIOS_CLIENT_SECRET`,
`SOLO_ENVIOS_ENVIRONMENT` (`sandbox` default), `SOLO_ENVIOS_BASE_URL` (optional),
`SOLO_ENVIOS_WEBHOOK_SECRET` (MX-3).

## To reach `SANDBOX`

Founder creates a Solo Envíos account, completes account verification (required
to activate carriers), and provides sandbox Client ID and Client Secret.
