# CM-MCP-4 landing and activation gates

Landing this readiness change changes code and documentation only. It does not authorize or perform any production activation.

## Landing gates

- exact-head CI green;
- independent review on the final head;
- explicit Founder exact-head merge authorization.

## Production gates after landing

Each production action requires its own explicit Founder authorization:

1. SEC-RLS-1 production migration apply and postflight.
2. CM-MCP-DB2 production migration apply and postflight.
3. Supabase OAuth server configuration.
4. Static OAuth client registration.
5. Least-privilege MCP grant provisioning.
6. `cornermex-mcp` Edge Function deployment and environment configuration.
7. First remote read-only activation rehearsal.

Dynamic client registration remains disabled for the first activation. No write MCP capability is authorized by this document.
