# CM-MCP-3 — OAuth identity and live read boundary

## Purpose

CM-MCP-3 replaces the temporary hand-rolled CM-MCP-2 protocol skeleton with an
isolated, standards-based MCP resource server. The source is mergeable without
activating remote access.

## Architecture

```text
MCP client / approved agent
        |
        | OAuth discovery + Supabase access token
        v
cornermex-mcp Edge Function
        |
        | Host + Origin allowlist
        | verify bearer token + user + client_id
        v
CornerMex MCP policy layer
        |
        | authenticated JWT, never service-role
        v
reviewed read-only RPC contract
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

## OAuth discovery

`MCP_PUBLIC_URL` defines the future public HTTPS resource URL. It is required by
the isolated service and may not contain a query string or fragment.

The bearer middleware advertises a protected-resource metadata URL in its
`WWW-Authenticate` challenge. The Edge Function serves that RFC 9728 document
under the MCP resource path and identifies Supabase Auth as the authorization
server. This avoids depending on root-level `/.well-known` routing at the
Supabase Edge gateway while still giving an MCP client the exact metadata URL in
the 401 challenge.

When that metadata document is requested, the service reads and validates
Supabase's OAuth authorization-server discovery document. It tries the current
path-aware RFC 8414 location first and retains the issuer-local form as a
compatibility fallback. The returned issuer must exactly match the expected
`SUPABASE_URL/auth/v1` issuer.

Protected-resource metadata is intentionally available before browser Origin
validation and carries permissive CORS, as required for web-based MCP discovery.
Host validation still runs first. No OAuth endpoint is enabled by this PR.

## Request boundary

The fetch-native Edge Function uses the SDK's own
`hostHeaderValidationResponse` and `originValidationResponse` helpers. This
follows the official DNS-rebinding posture for web-standard MCP servers instead
of comparing the incoming `Host` header with a URL derived from the same request.

Allowed Host values are port-agnostic hostnames. The canonical Supabase hostname
and the hostname from `MCP_PUBLIC_URL` are included automatically. Additional
deployment hostnames may be supplied later through `MCP_ALLOWED_HOSTNAMES` as a
comma-separated list.

Browser Origin values for the MCP endpoint are denied unless their hostname is
explicitly listed in `MCP_ALLOWED_ORIGIN_HOSTNAMES`. A request with no Origin
header is allowed at this layer because normal non-browser MCP clients do not
send one. No Host or Origin allowlist configuration is changed by this PR because
the Edge Function is not deployed.

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

CornerMex permissions are resolved separately from the proposed private MCP
grant store. This is deliberate because the current Supabase OAuth server only
exposes standard identity scopes, not CornerMex application permissions.

## Authorization proposal

`CM-MCP-3-DB-PROPOSAL.md` specifies a future
`commerce_private.mcp_grants` relation keyed by
`user_id + client_id + permission`. A grant must be active and unexpired.

CM-MCP-3 does not add or alter any canonical or pending migration. The database
proposal must be promoted later through the repository's migration-ownership
process and a separately authorized DB2 gate.

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

The Edge Function does not query tables directly. Every tool calls a proposed
read-only Postgres RPC using the caller's OAuth JWT. The future DB2 implementation
must independently check `auth.uid()` plus the token's `client_id`, providing a
second fail-closed authorization boundary.

Until those RPCs exist, the undeployed Edge Function cannot become a functioning
remote data path.

## Data minimization

Order tools exclude buyer IDs, shipping addresses and legal-acceptance payloads.
B2B tools exclude contact name, email, phone, message and admin notes. The first
remote cut is intended for operational discovery and coordination, not broad PII
export.

## Explicit non-activation

This change does not:

- enable Supabase OAuth;
- enable dynamic client registration;
- register an OAuth client;
- add, alter or apply a canonical migration;
- create live MCP grants;
- create the proposed RPCs in any database;
- deploy the Edge Function;
- configure `MCP_PUBLIC_URL`, Host or Origin allowlists in a live environment;
- add a service-role credential;
- enable write tools;
- mutate Railway configuration.

Each external mutation requires a later, separately authorized execution gate.
