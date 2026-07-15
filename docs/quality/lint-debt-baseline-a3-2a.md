# Lint debt baseline A3.2a

On 2026-07-15, `npm run lint` reported 4,773 inherited repository findings: 4,755 errors and 18 warnings; 4,224 errors and 4 warnings were potentially auto-fixable. The full lint command therefore exits nonzero.

A3.2a does not repair or reformat unrelated legacy code. Its release gate is:

- `npm run lint:changed`: zero findings and zero baseline delta for tracked changed source files
- direct ESLint over new A3.2a scripts and tests: zero findings
- Prettier applied only to sprint-owned files

This baseline is not a waiver for new debt. Any new or modified file must pass its scoped lint gate. Global cleanup belongs in a separate owned sprint so it cannot obscure security and activation-readiness changes.
