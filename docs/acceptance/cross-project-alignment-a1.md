# Cross-Project Alignment A1 Acceptance

- Active source identified: `ywyiejqnbyzjfatojvkh`.
- Empty candidate target: `wlrfknmrhowldygmvtvn`.
- Shared contract checksum matches CornerOps: `b87acfbdeac1427e141677616a0d8fbda5ecabc10a4c84012a9bd5d8bc98249a`.
- Current model is single merchant; public seller activation, payouts and customer-data sharing are not authorized.
- CornerOps integration is masked/aggregated read-only; all reverse writes are blocked.
- Candidate security migration revokes client execution of `public.rls_auto_enable()` and performs no business mutation.
- Post-migration security and performance advisors: no findings.
- Historical stock 50 is an unsafe legacy fixture, not current inventory.
- No products, prices, inventory, customers, orders or payments changed.
- No Lovable, OpenClaw or external action was invoked.
- Validation: TypeScript, production build and A1 contract validator pass. The repository-wide ESLint gate has 5,953 pre-existing formatting/lint findings and remains a documented baseline debt; A1 introduced no broad formatting rewrite.

Target schema is still missing. A separate migration plan must map and validate the active schema before the candidate can become production.
