# CM-MCP-1 — CornerMex Operations MCP contract

## Purpose

CornerMex will expose a remote Model Context Protocol interface for approved AI agents and partner systems. The MCP layer is an operations gateway over the canonical CornerMex commerce model. It is not a database console and it does not replace the existing storefront or Admin.

The target architecture is:

`MCP client / partner system → OAuth identity → CornerMex MCP policy layer → canonical CornerMex operations`

## Protocol and transport

- Remote MCP over stateless HTTP.
- Target protocol generation: MCP 2026-07-28.
- Server implementation should use the official MCP TypeScript server SDK v2 line.
- The MCP service must be isolated from the storefront runtime so it can be deployed, scaled, disabled and audited independently.
- Production activation is a separate governance gate.

## Identity and authorization

Authentication and authorization are separate concerns.

### Authentication

Supabase Auth OAuth 2.1 is the intended identity provider. A connected MCP client authenticates a real CornerMex user and receives a user-bound access token. The MCP server forwards that user context to canonical Supabase/RPC operations.

The MCP client must never receive or authenticate with privileged server credentials.

### CornerMex permissions

OAuth standard scopes are not the CornerMex permission model. CornerMex maintains its own fine-grained grant layer keyed by the authenticated user and OAuth client identity.

Initial permissions:

- `catalog:read`
- `inventory:read`
- `orders:read`
- `orders:note`
- `orders:transition`
- `b2b:read`
- `b2b:write`
- `ops:read`

Every tool has exactly one required CornerMex permission. Missing or inactive grants fail closed.

## Tool registry

### Read-only tools

#### `catalog.search`
Permission: `catalog:read`

Search active, public CornerMex products using query, category, brand, origin, stock and price filters. Results must follow the same sellability rules as the public catalog.

#### `catalog.get_product`
Permission: `catalog:read`

Return one public product by slug or canonical ID. Non-sellable products fail closed.

#### `inventory.get_availability`
Permission: `inventory:read`

Return sellable variant availability and quantity signals for a product. This tool never changes stock.

#### `orders.list`
Permission: `orders:read`

Return authorized order summaries. Default output excludes unnecessary customer PII.

#### `orders.get`
Permission: `orders:read`

Return authorized order detail and lifecycle history using the canonical order model.

#### `b2b.list_leads`
Permission: `b2b:read`

Return B2B pipeline records visible to the authenticated principal.

#### `b2b.get_lead`
Permission: `b2b:read`

Return one B2B lead with lifecycle history and notes when authorized.

#### `ops.summary`
Permission: `ops:read`

Return canonical operational KPIs such as order counts, GMV, active products and low-stock signals.

### Mutating tools

Mutating tools must preserve existing RPC/lifecycle invariants and emit an audit event.

#### `b2b.update_lead`
Permission: `b2b:write`

Update the human-owned B2B pipeline through reviewed lifecycle operations only.

#### `b2b.add_note`
Permission: `b2b:write`

Add an internal B2B note. Notes are append-only through the MCP tool surface in v1.

#### `orders.add_note`
Permission: `orders:note`

Add an internal note to an order through the canonical order note operation.

#### `orders.transition_status`
Permission: `orders:transition`

Request an allowed order lifecycle transition. The tool requires the expected current state and fails on stale state or invalid transitions.

## Mutations intentionally excluded from v1

The MCP must not expose tools for:

- arbitrary SQL or arbitrary table access;
- product price changes;
- inventory adjustments;
- product import or bulk publication;
- payment execution;
- payout execution;
- infrastructure or deployment changes;
- account-role administration.

These are not hidden tools. They do not exist in the v1 MCP registry.

## Data minimization

- Read tools return only fields required for the operation.
- Order list responses exclude customer contact/address data unless a future explicitly approved tool requires it.
- Tool logs store tool name, caller identity, client identity, outcome, timestamps and a non-reversible input fingerprint rather than raw sensitive arguments.
- Error responses use stable operation codes and do not expose database internals.

## Audit requirements

Every MCP request records or makes available for audit:

- authenticated user ID;
- OAuth client ID;
- tool name;
- read vs mutation classification;
- authorization decision;
- success/failure outcome;
- request correlation ID;
- timestamp.

Mutation audit records additionally include the affected canonical entity ID and lifecycle outcome, but not raw secrets or unnecessary PII.

## Fail-closed rules

The MCP returns no operational result when:

- the bearer token is absent or invalid;
- no OAuth client identity is present once OAuth mode is active;
- the user/client grant is absent, inactive or expired;
- the required permission is missing;
- canonical data validation fails;
- a mutation cannot execute through its reviewed operation/RPC;
- a lifecycle expected-current-state check fails.

## Delivery sequence

1. Contract, registry and threat model.
2. Isolated MCP server skeleton with no production activation.
3. OAuth consent/auth integration in staging.
4. Read-only tools.
5. Fine-grained grant store and audit trail.
6. Approval-scoped write tools.
7. External-client interoperability rehearsal.
8. Independent review and Founder activation gates.

## Governance

Code merge, database migrations, OAuth configuration changes, Railway service creation/deployment and production activation remain separate authorization gates. A merge authorization never implies authorization for any later production configuration or deployment action.
