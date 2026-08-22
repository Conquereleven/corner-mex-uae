# CM-MCP-4 — OAuth and MCP activation readiness

## Goal

Prepare the CornerMex application and operating runbook for a controlled first remote MCP activation without enabling OAuth, registering a client, provisioning grants, applying DB2, or deploying the Edge Function in this change.

## Current production state

Canonical Supabase project: `wlrfknmrhowldygmvtvn`.

Project URL: `https://wlrfknmrhowldygmvtvn.supabase.co`.

Planned MCP protected resource URL:

`https://wlrfknmrhowldygmvtvn.supabase.co/functions/v1/cornermex-mcp`

At the time this readiness work was prepared, production had no deployed Supabase Edge Functions for this project. The MCP remains inactive.

## Consent route

The storefront now contains `/oauth/consent` as the prepared Supabase OAuth consent UI.

The route:

- requires an `authorization_id`;
- requires an authenticated CornerMex user;
- preserves the authorization identifier through the existing safe internal login redirect;
- obtains authoritative authorization details from Supabase Auth;
- displays the registered client name, callback URI, and identity scopes;
- approves or denies only through Supabase OAuth APIs;
- redirects only to the redirect URL returned by Supabase after the decision;
- states clearly that OAuth consent alone does not grant CornerMex operational data access.

Operational MCP access remains controlled by the separate `commerce_private.mcp_grants` boundary from CM-MCP-DB2.

## First activation posture

The first production activation should use the smallest possible surface:

1. CM-MCP-DB2 is merged and separately applied to the canonical production database.
2. SEC-RLS-1 is applied and postflight-verified before remote B2B reads are enabled.
3. Supabase Auth uses an asymmetric JWT signing key suitable for OAuth/OIDC verification.
4. Enable the Supabase OAuth 2.1 authorization server with `/oauth/consent` as the authorization path.
5. Keep dynamic client registration disabled.
6. Register one static production OAuth client with exact redirect URI matching.
7. Do not grant any CornerMex MCP permission merely because OAuth consent succeeded.
8. Provision only the minimum `mcp_grants` rows needed for the exact user + production OAuth `client_id`.
9. Deploy `cornermex-mcp` only after a separate deployment authorization.
10. Start with native/non-browser MCP clients. Keep browser Origin allowlists empty until a specific browser client and exact origin are approved.

## Edge Function environment

The isolated Edge Function should receive only non-secret/public boundary configuration plus Supabase's normal function runtime environment:

```text
MCP_PUBLIC_URL=https://wlrfknmrhowldygmvtvn.supabase.co/functions/v1/cornermex-mcp
MCP_ALLOWED_HOSTNAMES=wlrfknmrhowldygmvtvn.supabase.co
MCP_ALLOWED_ORIGIN_HOSTNAMES=
```

`SUPABASE_SERVICE_ROLE_KEY` must not be introduced for the MCP service. The function authenticates the caller's OAuth token and invokes the database RPCs as that caller.

## Initial permission set

The first remote rehearsal should grant only:

- `catalog:read`
- `inventory:read`
- `ops:read`

Order and B2B read permissions should remain absent until the basic OAuth/token/resource boundary is proven. Dormant write permissions remain ungranted and no write MCP tools exist.

## Required smoke sequence

After all separately authorized activation steps are complete:

1. Protected-resource metadata is reachable at the advertised RFC 9728 path.
2. An unauthenticated MCP request returns the expected Bearer challenge and no data.
3. OAuth authorization redirects to `/oauth/consent` and survives login if necessary.
4. Denial returns through the registered client flow without a CornerMex data grant.
5. Approval produces a caller token with the expected issuer, audience, subject, expiry, and OAuth `client_id`.
6. A caller with no `mcp_grants` rows sees no MCP operational tools/data.
7. A caller with the three initial read permissions can perform catalogue search, availability lookup, and aggregate operations summary only.
8. Order and B2B tools remain unavailable.
9. No table-level access, service-role path, inventory mutation, order mutation, B2B mutation, email, payment, or Railway mutation occurs.

## Rollback

If any activation smoke fails:

1. Revoke/deactivate the caller's `mcp_grants` rows.
2. Disable or remove the production OAuth client.
3. Disable the OAuth server if the issue is authorization-server-wide.
4. Remove the deployed `cornermex-mcp` function or deploy the previously verified inactive version.
5. Keep the storefront consent route in place; without an enabled OAuth server/client it is inert.
6. Investigate using Auth, Edge Function, and Postgres logs before reactivation.

## Separate Founder gates

The following are intentionally independent gates:

- SEC-RLS-1 production apply;
- CM-MCP-DB2 production apply;
- OAuth server enablement;
- OAuth client registration;
- initial MCP grant provisioning;
- Edge Function deployment and environment configuration;
- first remote activation rehearsal.

No gate is implied by merging this readiness PR.
