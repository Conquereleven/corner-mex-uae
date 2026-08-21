# CM-MCP-1 — Threat model

## Security objective

The CornerMex MCP lets approved agents and partner systems perform narrowly authorized commerce operations while preserving the same business invariants as the existing CornerMex application.

The MCP is not a privileged shortcut around application authorization, lifecycle rules, RLS or reviewed RPCs.

## Trust boundaries

1. **MCP client** — external and untrusted by default.
2. **OAuth identity provider** — establishes user identity and OAuth client identity.
3. **CornerMex MCP gateway** — validates identity, resolves CornerMex grants and dispatches tools.
4. **Canonical operation layer** — existing read models and reviewed RPC/lifecycle operations.
5. **Database** — authoritative state; never exposed as a generic query surface.

## Primary threats and mitigations

### Stolen or replayed access token

Mitigations:
- short-lived OAuth access tokens and refresh rotation;
- audience/client validation when OAuth activation is implemented;
- no privileged server credential accepted as a client token;
- revoke or deactivate CornerMex grants independently of OAuth sessions.

### Over-privileged partner client

Mitigations:
- grants are keyed to both user and OAuth client identity;
- each MCP tool maps to one explicit CornerMex permission;
- permissions are allow-listed, never inferred from tool arguments;
- partner access does not imply the application-wide admin role.

### Prompt injection causing dangerous tool use

Mitigations:
- the MCP tool registry contains no arbitrary SQL, deployment, payment, payout or bulk inventory mutation tools;
- write tools accept narrow structured schemas;
- lifecycle transitions require expected-current-state checks;
- high-impact capabilities remain outside v1 regardless of model instructions.

### Parameter tampering

Mitigations:
- every tool validates input schema server-side;
- entity IDs and transition values are canonical and bounded;
- writes execute through existing reviewed operations/RPCs rather than ad-hoc table updates.

### Data exfiltration through broad reads

Mitigations:
- read tools return minimized projections;
- order-list results exclude unnecessary contact/address information;
- future PII-revealing tools require separate explicit contract entries and review;
- errors do not echo database internals.

### Confused-deputy / wrong OAuth client

Mitigations:
- authorization is evaluated against authenticated user plus OAuth client ID;
- grants can be deactivated or expired per client;
- an otherwise valid CornerMex user token does not automatically authorize MCP operations.

### Tool-name spoofing or hidden capability expansion

Mitigations:
- a canonical compile-time tool registry defines every v1 tool;
- CI asserts the approved registry and forbidden capability set;
- production activation uses exact-head review and governance gates.

### Duplicate write requests

Mitigations:
- write tools should accept or derive idempotency/correlation identifiers where the canonical operation supports them;
- order lifecycle transitions use expected-current-state semantics;
- B2B operations preserve existing lifecycle/audit mechanisms.

### Audit-log leakage

Mitigations:
- log stable IDs and fingerprints rather than raw sensitive tool arguments;
- do not log access tokens, secrets or full customer payloads;
- mutation audit entries contain entity IDs and outcomes, not unnecessary PII.

## Activation posture

The first remotely reachable MCP deployment must start with read-only tools enabled. Mutating tools are enabled only after:

1. the fine-grained grant model exists;
2. audit evidence is available;
3. canonical mutation wrappers are tested;
4. independent review approves the exact head;
5. the Founder separately authorizes the activation/configuration gate.

## Non-goals for v1

- generic database administration;
- autonomous price or stock management;
- payment capture or refund initiation;
- payout initiation;
- deployment/infrastructure administration;
- permission/role administration through MCP.
