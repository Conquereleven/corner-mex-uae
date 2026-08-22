# CM-MCP-4 non-activation evidence

This branch intentionally contains no executable production activation operation.

- No Supabase migration is added by CM-MCP-4.
- No OAuth server setting is changed.
- No dynamic client registration setting is changed.
- No OAuth client is registered.
- No `mcp_grants` row is created.
- No Edge Function is deployed.
- No Railway variable or deployment is mutated.
- No service-role credential is introduced into the MCP path.
- No write MCP tool is added.

The consent route and environment placeholders remain inert until their separately gated platform configuration exists.
