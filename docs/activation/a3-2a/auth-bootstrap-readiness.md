# Auth bootstrap readiness A3.2a

Planning only. A3.2a creates no user.

## Proposed controlled sequence

1. Founder authorizes timing, exact production URL, redirects, account email, recovery owner, and observation window.
2. Verify the reviewed production commit, fresh preflight, RLS, and exact Auth URL allowlist.
3. Create one founder account through the supported Auth path; require email confirmation according to the chosen policy.
4. Assign the admin role only through a server-controlled, audited path. Client metadata and self-registration must never grant admin.
5. Verify the profile row is created exactly once by the approved trigger or server flow and contains no role escalation input from the browser.
6. Exercise sign-in, refresh, sign-out, expired session, password reset, and recovery in a controlled founder-only smoke test.
7. Confirm unauthorized users cannot access admin routes or private rows.

## Rollback

Disable sign-in/bootstrap entry points, revoke affected sessions, remove newly created test/founder state only through an authorized reconciled procedure, restore redirects, preserve audit evidence, and keep Lovable as the rollback anchor.

## A3.2b acceptance

- fresh read-only preflight and exact redirect inventory
- founder authorization and named operator
- no self-assigned admin path
- one expected Auth user and one matching profile after bootstrap
- recovery and session tests pass without leaking tokens
- RLS and public-read boundaries remain unchanged

Unanswered decisions: Auth timing, domain/DNS, rollback owner, customer communication, and observation window.
