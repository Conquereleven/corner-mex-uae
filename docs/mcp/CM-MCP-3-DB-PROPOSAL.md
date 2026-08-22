# CM-MCP-3 database boundary proposal

## Status

**Promoted by CM-MCP-DB2 into canonical migration `20260822050535_cm_mcp_db2_read_boundary.sql`; not applied to production.**

CM-MCP-3 intentionally shipped this as a design proposal only. CM-MCP-DB2 now
promotes the proposal through the repository's canonical migration-ownership
process. Production execution still requires a separate Founder authorization
after CI and independent review.

## Grant store

Private relation: `commerce_private.mcp_grants`.

Key: `user_id + client_id + permission`.

Required attributes:

- `user_id uuid`, referencing `auth.users`;
- `client_id text`, non-empty and bounded;
- `permission text`, limited to the CM-MCP-1 permission vocabulary;
- `active boolean`, default false;
- optional `expires_at timestamptz`;
- optional `granted_by uuid`;
- audit timestamps.

Direct access by `public`, `anon`, `authenticated` and `service_role` is revoked.
The table has RLS enabled even though callers reach it only through reviewed
security-definer RPCs.

## Caller binding

Every permission decision requires both:

```text
auth.uid() = mcp_grants.user_id
auth.jwt()->>'client_id' = mcp_grants.client_id
```

The grant must also be active and unexpired. A token without `client_id` has no
MCP permissions.

## RPC contract

The Edge Function in CM-MCP-3 calls only these read RPCs:

| RPC | Required permission | Output boundary |
| --- | --- | --- |
| `mcp_current_permissions()` | authenticated OAuth caller | active unexpired permission names only |
| `mcp_catalog_search(q, lang, limit)` | `catalog:read` | active sellable product summary |
| `mcp_catalog_get_product(identifier, lang)` | `catalog:read` | active product + sellable variants |
| `mcp_inventory_get_availability(identifier)` | `inventory:read` | sellable variant availability |
| `mcp_orders_list(status, limit)` | `orders:read` | minimized order operational summary |
| `mcp_orders_get(identifier)` | `orders:read` | minimized order + line items |
| `mcp_b2b_list_leads(status, limit)` | `b2b:read` | minimized B2B pipeline summary |
| `mcp_b2b_get_lead(id)` | `b2b:read` | minimized B2B pipeline detail |
| `mcp_ops_summary()` | `ops:read` | aggregate operating metrics |

Each data RPC independently validates the grant using `auth.uid()` and the JWT
`client_id`. The Edge Function's tool filtering is not sufficient on its own.

## Permission vocabulary

The grant constraint allows exactly:

- `catalog:read`
- `inventory:read`
- `orders:read`
- `orders:note`
- `orders:transition`
- `b2b:read`
- `b2b:write`
- `ops:read`

CM-MCP-3 consumes only the read permissions. Write permissions remain dormant.

## Data minimization requirements

Order RPCs exclude `buyer_id`, `shipping_address` and `legal_acceptance`. They
may expose order number, lifecycle/payment status, monetary totals, timestamps
and line-item product/quantity/fulfillment summaries.

B2B RPCs exclude `contact_name`, `email`, `phone`, free-form `message`,
`admin_note` and `website` in the first remote release. They may expose company
name, business type, geography, product interest, estimated volume, pipeline
status, priority, qualification score, owner, next action, blocker and
timestamps.

Catalog and inventory RPCs expose only active/sellable products and variants.
Availability is derived from canonical inventory while never allowing an MCP
caller to adjust stock.

`mcp_ops_summary()` returns aggregate counts/totals only and no customer or lead
PII.

## Required production gate before activation

CM-MCP-DB2 includes executable SQL, canonical migration ownership metadata,
replay/static tests and privilege checks. It still requires independent review,
exact-head merge authorization and a later explicit Founder production apply
gate. Until the production migration is applied, CM-MCP-3's Edge Function is
expected to fail closed because the RPC contract does not exist in production.
