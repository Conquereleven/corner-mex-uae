# CM-MCP-3 — OAuth identity and live read boundary

## Purpose

CM-MCP-3 replaces the temporary hand-rolled CM-MCP-2 protocol skeleton with an
isolated, standards-based MCP resource server. The source is mergeable without
activating remote access.

## Architecture

```text
MCP client / approved agent
        |
        | Supabase OAuth access token
        v
cornermex-mcp Edge Function
        |
        | verify bearer token + user + client_id
        v
CornerMex MCP policy layer
        |
        | authenticated JWT, never service-role
        v
reviewed read-only RPCs
        |
        v
canonical CornerMex data
```

The storefront `/api/mcp` route is intentionally not the MCP service. It returns
`503 CM_MCP_REMOTE_ENDPOINT_NOT_ACTIVATED` until the isolated service is
separately activated.

## Protocol

The Edge Function uses `@modelcontextprotocol/server@2.0.0` and
`createMcpHandler`. It serves the modern MCP 2026-07-28 era only in this cut by
setting `legacy: "reject"`.

CM-MCP-2's hand-written JSON-RPC `initialize` implementation is removed so the
application does not claim modern protocol compliance through a legacy
handshake.

## Authentication

The server is a resource server only. Supabase Auth remains the intended OAuth
2.1 authorization server.

The bearer verifier:

1. sends the supplied access token to Supabase Auth for validation;
2. parses claims only after Supabase has accepted the token;
3. requires the token subject to match the authenticated Supabase user;
4. requires an OAuth `client_id`, preventing ordinary non-OAuth app sessions
   from acting as MCP clients;
5. validates expiry, issuer and the `authenticated` audience;
6. returns MCP `AuthInfo` without mapping CornerMex permissions to OAuth scopes.

CornerMex permissions are resolved separately from the private MCP grant store.
This is deliberate because the current Supabase OAuth server only exposes
standard identity scopes, not CornerMex application permissions.

## Authorization

The pending canonical migration defines `commerce_private.mcp_grants`, keyed by
`user_id + client_id + permission`. A grant must be active and unexpired.

The permission vocabulary remains the CM-MCP-1 contract:

- `catalog:read`
- `inventory:read`
- `orders:read`
- `orders:note`
- `orders:transition`
- `b2b:read`
- `b2b:write`
- `ops:read`

Only the five read permissions are consumed by the CM-MCP-3 Edge Function.
Write permissions remain dormant and no write tools are registered.

## Read surface

CM-MCP-3 registers eight tools when their required grant is present:

- `catalog.search`
- `catalog.get_product`
- `inventory.get_availability`
- `orders.list`
- `orders.get`
- `b2b.list_leads`
- `b2b.get_lead`
- `ops.summary`

The Edge Function does not query tables directly. Every tool calls a reviewed
read-only Postgres RPC using the caller's OAuth JWT. Each RPC independently
checks `auth.uid()` plus the token's `client_id`, providing a second
fail-closed authorization boundary.

## Data minimization

Order tools exclude buyer IDs, shipping addresses and legal-acceptance payloads.
B2B tools exclude contact name, email, phone, message and admin notes. The first
remote cut is intended for operational discovery and coordination, not broad PII
export.

## Explicit non-activation

This change does not:

- enable Supabase OAuth;
- register an OAuth client;
- apply the pending migration;
- create live MCP grants;
- deploy the Edge Function;
- add a service-role credential;
- enable write tools;
- mutate Railway configuration.

Each external mutation requires a later, separately authorized execution gate.
