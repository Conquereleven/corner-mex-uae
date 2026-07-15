# Auth Activation Strategy A3

There are zero canonical Auth users and no surviving source project. Password hashes, sessions, MFA factors and identities will not be imported or invented.

## Strategy

1. Configure only approved providers on `wlrfknmrhowldygmvtvn`.
2. Verify Railway staging and future production redirect URLs.
3. Create founder/admin access through a separately approved enrollment procedure.
4. Customers enroll normally or use a controlled invitation/password-reset flow after launch approval.
5. Assign authorization through reviewed `user_roles` policy, never user-editable metadata.
6. Validate session revocation, password reset and OAuth callbacks in staging.

Provider selection, email delivery and founder/admin enrollment remain founder decisions. No Auth configuration changes occur in A3.1.
