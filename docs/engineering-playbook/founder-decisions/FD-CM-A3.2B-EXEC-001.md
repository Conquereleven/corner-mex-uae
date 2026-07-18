# Founder Execution Authorization
## Conditional Merge, Production and Supabase Authority

**Decision ID:** FD-CM-A3.2B-EXEC-001
**Status:** APPROVED
**Owner:** Joel / Founder
**Effective immediately:** Yes
**Authorization type:** Conditional execution authority
**Related decision:** FD-CM-LOVABLE-GOV-001

## Founder authorization

The Founder authorizes the engineering team to perform the following actions without requesting a new founder confirmation at each individual step, provided every mandatory gate in this document is satisfied against the exact commit being executed.

## Authorized actions

### 1. Merge authority

Authorized:

1. Merge the focused current-main Lovable remediation PR after:
   - Fable 5 architecture review is complete;
   - Sonnet pre-review is complete;
   - Opus 4.8 returns `MAIN REMEDIATION VERDICT: approve` or `approve_with_low_findings`;
   - CI is green on the exact reviewed head;
   - no Critical, High or blocking Medium findings remain.

2. Update or rebase PR #8 onto the remediated `main`.

3. Merge PR #8 after:
   - all conflicts are resolved;
   - `package.json` and `package-lock.json` are consistent;
   - all A2, A3, A3.2a, A3.2b and CM-2A gates pass;
   - the new exact PR #8 head and resulting merge tree receive independent Opus review;
   - Opus returns an approval verdict;
   - no Critical, High or blocking Medium findings remain.

This authorization is bound to the exact reviewed heads. A new material commit invalidates the prior approval and requires a fresh review.

## 2. Production authority

Authorized after the merge gates above are complete:

- deploy the reviewed CornerMex build to Railway production;
- verify health and readiness;
- run a fresh read-only production preflight;
- begin the approved 48-hour technical observation window;
- perform rollback when defined stop conditions are triggered;
- collect logs, deployment evidence and reconciliation results.

Production deployment must use the exact reviewed commit.

No agent may deploy an unreviewed head.

## 3. Supabase modification authority

Authorized against canonical CornerMex Supabase:

```text
wlrfknmrhowldygmvtvn
```

Authorized modifications are limited to the exact independently reviewed A3.2b / CM-2A execution plan:

- apply approved database migrations;
- create approved catalog infrastructure tables;
- create approved Storage buckets and policies;
- create the Founder/admin Auth bootstrap;
- create required RLS policies;
- create or update reviewed database functions;
- apply reviewed grants and revokes;
- import the approved internal draft catalog batch;
- copy only media with approved validation state;
- create execution and rollback evidence;
- perform verified rollback when required.

## Mandatory Supabase constraints

The following must remain true during and after execution:

- public product visibility remains disabled unless separately authorized;
- imported products remain draft/inactive;
- commercial inventory remains zero until physically verified;
- no planning inventory becomes sellable inventory;
- no checkout or payment processing becomes active;
- no customer email, WhatsApp, SMS or other communication is sent;
- no PII is copied into CornerOps;
- no service-role secret is exposed in browser code;
- RLS remains enabled on all applicable public tables;
- all writes are tied to an execution ID;
- rollback remains scoped, idempotent and independently verifiable.

## 4. Automatic execution gate

The engineering team may proceed without another founder confirmation only when all of the following are true:

- exact repository, environment and commit are recorded;
- Fable architecture decision is complete where required;
- Sonnet pre-review is complete;
- Opus final review approves the exact head;
- CI passes on the exact head;
- fresh live preflight passes;
- rollback owner is Joel / Founder;
- rollback procedure is tested;
- stop conditions are documented;
- the 48-hour observation plan is ready;
- no Critical, High or blocking Medium findings remain.

If any condition is false, execution must stop automatically.

## 5. Stop conditions

Immediate stop and rollback are required for:

- wrong project or environment;
- wrong commit;
- failed migration;
- schema mismatch;
- RLS disabled unexpectedly;
- unauthorized public product exposure;
- nonzero commercial inventory from planning data;
- unauthorized Auth privilege;
- Storage policy exposure;
- catalog reconciliation mismatch;
- checkout or payments becoming active;
- secret or PII exposure;
- health/readiness failure;
- inability to verify rollback scope.

## 6. Actions not authorized by this decision

The following still require a separate founder decision:

- DNS or custom-domain cutover;
- public commercial launch;
- public catalog publication;
- activation of commercial inventory;
- checkout activation;
- payment activation;
- customer communications;
- supplier communications;
- pricing changes;
- destructive data deletion outside the reviewed rollback plan;
- migration or production work unrelated to A3.2b / CM-2A;
- future merges unrelated to this execution sequence.

## 7. Required evidence after execution

The executing agent must produce:

- exact merged SHAs;
- exact deployed SHA;
- Railway deployment ID and status;
- Supabase migration evidence;
- table/function/RLS inventory;
- Auth and Storage state;
- catalog import counts;
- media counts and validation state;
- inventory counts;
- rollback evidence;
- health/readiness evidence;
- observation start and end timestamps;
- incidents or anomalies;
- final Opus post-execution audit.

## 8. Repository placement

Store this decision at:

```text
docs/engineering-playbook/founder-decisions/FD-CM-A3.2B-EXEC-001.md
```

Add a registry entry to:

```text
docs/engineering-playbook/04_Founder_Decision_Registry.md
```

Recommended registry record:

```text
Decision ID: FD-CM-A3.2B-EXEC-001
Title: Conditional Merge, Production and Supabase Authority
Status: approved
Owner: Joel / Founder
Scope: Lovable remediation, PR #8, A3.2b and CM-2A controlled execution
Execution state: approved_pending_gates
Observation window: 48 hours
Canonical Supabase: wlrfknmrhowldygmvtvn
```

## Final founder statement

```text
APPROVED

Merge, Railway production deployment and reviewed Supabase modifications are authorized once all exact-head, independent-review, CI, preflight and rollback gates in this decision are satisfied.

No additional founder confirmation is required for the authorized sequence.

Any scope expansion requires a new founder decision.
```
