# Current-Main Remediation Acceptance Evidence

## DB1 custody

- Status: `live_legacy_production`
- Custodian: Joel / Founder
- Verified aggregate state: 150 products, 4 orders, 7 Auth users, 1 seller
- Final disposition: deferred
- No destructive action is authorized.
- No PII, user identifiers, emails or order contents are included.
- Governing decision: `FD-CM-LOVABLE-DB1-CUSTODY-001`

## Automation

The `merged-tree-verification` check evaluates the GitHub proposed merge commit
for every pull request targeting `main`. It verifies the exact merge, base and
head SHAs before running clean install, package/lock, build, regression, schema
authority, PostgreSQL replay and formatting gates without production secrets.

## Safety

No merge, production deployment, Supabase write, Lovable Cloud write, Railway
write, DB1 data movement, deletion, Auth/Storage change or PR #8 change is
authorized or performed by this remediation.
