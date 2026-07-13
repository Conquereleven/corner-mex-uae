# Health and Readiness A2

`GET /api/health` is public, fast and side-effect free. It reports only service, runtime, commerce model, version and a shortened deployment commit. It does not query Supabase.

`GET /api/ready` validates server configuration and performs one bounded `categories?select=id&limit=1` read with the publishable key. It returns `200 ready` only when the target is reachable; missing or unavailable configuration returns a sanitized `503 degraded`. It never returns table contents, credentials or raw errors.
