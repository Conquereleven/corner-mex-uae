# Lint debt baseline A3.2a

On one 2026-07-15 environment, `npm run lint` reported 4,773 inherited findings. Reproduction counts vary with runtime and dependency resolution, so this number is evidence from that run rather than a universal baseline. The authoritative inventory and risk triage belong to the separate L0 lint-debt work; changed-file lint is the sprint regression gate.

A3.2a does not repair or reformat unrelated legacy code. Its release gate is:

- `npm run lint:changed`: zero findings and zero baseline delta for tracked changed source files
- direct ESLint over new A3.2a scripts and tests: zero findings
- Prettier applied only to sprint-owned files

This baseline is not a waiver for new debt. Any new or modified file must pass its scoped lint gate. Global cleanup belongs in a separate owned sprint so it cannot obscure security and activation-readiness changes.
