# CM-MCP-DB2 — canonical read database boundary

## Purpose

CM-MCP-DB2 promotes the database proposal from CM-MCP-3 into a canonical, reviewable migration without activating any remote MCP access.

## Private grant store

`commerce_private.mcp_grants` is keyed by `user_id + client_id + permission` and stores active, optionally expiring grants. It supports the full CM-MCP permission vocabulary, but this release consumes read permissions only.

The table has ordinary RLS enabled, no row policies, and no direct table privileges for `PUBLIC`, `anon`, `authenticated`, or `service_role`. Access is only through reviewed RPC logic owned by `postgres`.

## Caller binding

Every data RPC independently requires:

- a non-null `auth.uid()`;
- a non-empty OAuth `client_id` from `auth.jwt()`;
- an active grant for that exact user and OAuth client;
- the RPC-specific permission;
- an unexpired grant.

A normal CornerMex session without OAuth `client_id` therefore receives no MCP permission.

## Public RPC surface

The migration creates exactly the RPC contract already consumed by the CM-MCP-3 Edge Function:

- `mcp_current_permissions()`
- `mcp_catalog_search(q, lang, limit)`
- `mcp_catalog_get_product(identifier, lang)`
- `mcp_inventory_get_availability(identifier)`
- `mcp_orders_list(status, limit)`
- `mcp_orders_get(identifier)`
- `mcp_b2b_list_leads(status, limit)`
- `mcp_b2b_get_lead(id)`
- `mcp_ops_summary()`

All nine functions are `SECURITY DEFINER` with a locked empty `search_path`. Default function execution is revoked from `PUBLIC`, `anon`, `authenticated`, and `service_role`, then restored only to `authenticated`. This is intentional: the Edge Function creates a Supabase client using the caller's OAuth access token, so PostgREST executes the RPC under the `authenticated` database role while each function enforces the caller-specific grant again.

The expected Supabase database advisor warning for authenticated-callable `SECURITY DEFINER` functions is therefore a reviewed design exception, not an accidental broad grant. The actual authorization decision remains inside each function and direct table access remains unchanged.

## Data minimization

Order RPCs never return `buyer_id`, `shipping_address`, or `legal_acceptance`.

B2B RPCs never return `contact_name`, `email`, `phone`, free-form `message`, `admin_note`, or `website` in the first remote release.

Catalog RPCs expose active products and active variants only. Inventory availability is derived from canonical `quantity_on_hand - quantity_reserved` and has no mutation path.

`mcp_ops_summary()` returns aggregate catalogue, inventory, order, and B2B metrics only.

## Explicitly not activated

This PR does not:

- enable the Supabase OAuth 2.1 server;
- enable dynamic client registration;
- register an OAuth client;
- create any live MCP grant row;
- apply the DB2 migration to production;
- deploy `cornermex-mcp`;
- configure live MCP host/origin environment values;
- add any MCP write tool;
- change Railway production.

Production application of this migration requires a separate Founder gate after CI and independent review. OAuth configuration, client registration, grant provisioning, Edge deployment, and remote activation remain separate post-merge gates.
