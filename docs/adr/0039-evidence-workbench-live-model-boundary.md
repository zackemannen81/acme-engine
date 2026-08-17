# ADR 0039 — Evidence Workbench live model boundary

Status: Accepted

Date: 2026-08-14

Decision owners: ACME maintainers

## Context

The Evidence Integrity Workbench composes `createScriptedModelGateway` and
nothing else. Its responses are pinned to exact request hashes of the seven
fixed synthetic artifacts, so the extraction path answers only for material the
fixtures already anticipated. Stage 5 ingestion (`POST /api/text-imports`) is
pure storage: it produces an encrypted, viewable, redactable source and runs no
model at all.

The consequence is structural. Any document outside the sealed corpus —
synthetic or not — yields zero observations, and therefore no relations, no
timeline, no contradictions and no assessment. Everything the product exists to
do is unreachable for new material.

The engine side is already proven. `@acme/adapter-model-openai` maps the
Responses API with strict structured-output lowering, has a `fetch` transport,
and has reached live success for both reference contracts and for multi-step
ScenarioRunner runs. ADR-0023 decided a live gate for the Domain Test UI:
process opt-in plus a validated confirmation document, credentials from the
environment only, and a declared call and cost ceiling. The technical
specification lists "Live model and budget" as deferred to a gated slice.

What is missing is the product-side decision. The workbench is not the Domain
Test UI: it has authenticated server-derived principals (ADR-0035), an
immutable case boundary (ADR-0036), a job worker with progress and cooperative
cancel (ADR-0027), durable product audit (ADR-0037) and multiple users.

This ADR decides that boundary. It does not open the Slice 9 data gate.

## Decision

### 1. What this decides, and what it explicitly does not

Live model access and non-synthetic data are **independent gates**. This ADR
authorizes a live provider path over `synthetic-only` material. It grants no
data authority whatsoever. Slice 9 remains closed and, per ADR-0038, cannot
activate by implication. Every `dataPolicy: 'synthetic-only'` literal and the
`syntheticAuthorityAttested` requirement stay exactly as they are.

The Primary Product Rule, source-binding invariants and the L5 prohibition are
unchanged. Model output remains an untrusted candidate whichever gateway
produced it.

### 2. The gate: `evidence-live-confirmation/1`

A new versioned confirmation document, distinct from ADR-0023's
`acme-live-confirmation/1`:

| Field | Rule |
| --- | --- |
| `version` | exactly `evidence-live-confirmation/1` |
| `optIn` | the boolean `true`; absent or false is refused |
| `provider` | `openai` |
| `model` | non-blank, non-secret model id |
| `caseId` | non-blank; the exact evidence case this authorizes |
| `maxModelCalls` | positive integer |
| `costCeilingMinor` | non-negative integer, or `null` |
| `currency` | required when `costCeilingMinor` is not `null` |
| `rationale` | non-blank |

Two differences from ADR-0023 are load-bearing rather than cosmetic.

**No actor field.** ADR-0023 carries a free-text `confirmer`. ADR-0035 exists
precisely so that a browser payload cannot choose the acting identity, and
reusing that field would reintroduce what ADR-0035 removed. The effective
principal is derived from the BFF session and never read from the document.

**`caseId` replaces `caseCount`.** ADR-0023's `caseCount` counts test-plan
cases, which collides with the product's evidence `caseId`. Binding the exact
case keeps a live authorization inside the ADR-0036 boundary: a confirmation
for one case authorizes nothing in another.

The pure primitives are **shared, not duplicated**: the forbidden-credential-key
scan, the budget assertion and the typed refusal reasons move to a common
module that both surfaces use.

A live execution requires four independent keys. Missing any one refuses before
the provider is contacted:

1. deployment opt-in in the environment;
2. a valid confirmation whose `caseId` equals the requested case;
3. a provider credential present in the environment;
4. an authorized principal (section 3).

### 3. Authorization is separate from confirmation

The confirmation is a **cost and intent** gate. It is never an access gate.
Access is decided by the ADR-0035 policy and the ADR-0036 case membership, as
for every other product action.

A new product action `live-model.run` is added, deny-by-default and granted to
`case-admin` only in this increment. Cost-bearing calls to an external provider
are an administrative act, not a reviewer default. A principal without it is
refused exactly as any other unauthorized case access is refused — `404 Not
found.` — so live capability cannot be used to probe case existence.

### 4. Credentials

Credentials come from the environment and nowhere else. They must never appear
in a browser payload, a command body, the confirmation document, a job record,
an audit record, an error message or any stored product record. A confirmation
containing any forbidden credential key is refused whole, before parsing
continues, and the refusal names the field class rather than echoing the value.

### 5. Budget: two ceilings

**Run ceiling.** The confirmation declares `maxModelCalls` and optionally
`costCeilingMinor` for one run.

**Deployment ceiling.** Configuration supplies an absolute maximum. A
confirmation exceeding it is refused before the first call. No route, command
or browser action may raise the deployment ceiling; it is operator
configuration.

Two ceilings because one is not enough. The run ceiling makes intent explicit
and auditable per execution. The deployment ceiling means a careless or
mistaken confirmation cannot drain the account.

Enforcement is at two points: before the first call, and before each subsequent
call. The engine's bounded retry, repair and revision calls all count against
the ceiling — a repair is a provider call and is budgeted as one.

Exhaustion mid-run terminates the run. Because execution events are candidates
until the state transaction commits, a terminated run leaves **no partial
canonical state**: no observation, relation, question or assessment, and no
evidence-revision increment. The job reports failure with a typed reason and the
exhaustion is audited.

Cumulative per-principal accounting across runs is deliberately not decided
here. It requires durable accumulation, a reset window and contention handling,
which is a persistence design rather than a gateway decision. Case binding and
audit give attribution in the meantime.

### 6. Retention: `encrypted-payload`

Product live executions use ADR-0016 `encrypted-payload` retention.

`hash-only` was rejected because it degrades `replayVerify` to `unavailable`
and forfeits ADR-0017 resume. An interrupted execution would have to call the
provider a second time — paying twice and losing a proof the product already
asserts in its own blackbox test. Both matter more with a live provider than
with a deterministic mock.

Two consequences follow and must be honoured by the implementation:

- **Hosted deployments require a durable payload key.** The local composition
  builds its `PayloadEncryptor` with an ephemeral key
  (`keyId: 'ephemeral-local-session'`, regenerated per process), so payloads
  written before a restart cannot be decrypted after it and replay is silently
  lost. A hosted composition must supply a durable key or refuse to enable live.
- **The choice is revisited per data class at Slice 9.** Retained payloads are
  durable records of document content. That is acceptable while every class is
  `synthetic-only`; it is a separate decision for any later class, and is
  recorded as such in the Slice 9 prerequisite checklist.

### 7. Permitted tasks

All three evidence tasks may run live in the first increment:
`observe-artifact`, `relate-observations` and `propose-assessment`.

Restricting to `observe-artifact` was considered and rejected because it buys
no safety. The trust pipeline is gateway-independent: prompt output is an
untrusted candidate regardless of origin, and the same runtime and semantic
validation, the same prohibited-authority refusals, the same actor-resolution
and temporal-precision gates and the same source-binding requirements run before
anything becomes canonical. A narrow task set would only cost the point of the
boundary — observations without relations, timeline or assessment demonstrate
nothing beyond extraction.

The risk that genuinely changes with a live provider is cost, and section 5
handles cost.

### 8. Audit

The existing content-free security-audit vocabulary is extended with
`live.refused`, `live.started`, `live.completed` and `live.failed`, and the
resource kinds with `live-execution`.

Each record carries: effective principal, organization, case, workspace, task
name, model id, declared run ceilings, actual model-call count, outcome and
reason code, and the time. Each records **nothing** of prompt text, document
content, provider response bodies, or credentials.

Every refusal in section 9 is audited, including refusals that never reach the
provider. A refusal that released no bytes and made no call is still an
attempt, and an attempt is what an audit trail is for.

### 9. Failure semantics

- Provider errors map through the existing driver-error classification:
  retryable transient failures may be retried within the engine's bounds and
  within budget; non-retryable failures terminate the run.
- Timeouts are bounded and terminate the run when the bound is reached.
- Cooperative cancel uses the existing job path (ADR-0027). A cancelled run
  stops before the next provider call; calls already made are not unmade, and
  are audited and budgeted as spent.
- A terminated, failed or cancelled run commits no canonical state, per
  section 5.
- ADR-0017 resume applies to an interrupted live execution, which section 6's
  retention choice is what makes possible.

### 10. Required implementation proofs

The implementation task must prove each row, and the default composition must
remain mock-only.

| Condition | Required behaviour |
| --- | --- |
| No deployment opt-in | refuse; no provider contact; audited |
| Confirmation absent or wrong `version` | refuse; audited |
| `optIn` not literally `true` | refuse; audited |
| Confirmation `caseId` ≠ requested case | refuse; audited |
| Any forbidden credential key in the document | refuse whole; value never echoed |
| Credential absent from the environment | refuse; audited |
| Principal lacks `live-model.run` on the case | `404 Not found.` |
| Same-organization foreign case | `404 Not found.` |
| Run ceiling exceeds deployment ceiling | refuse before the first call |
| Ceiling reached mid-run | terminate; no canonical commit; audited |
| Default composition, and CI | zero live calls; provider unreachable |

Required gates:

- an offline injected-transport proof of the whole live path, following the
  existing `tests/integration/scenario-live-offline.test.ts` pattern;
- the refusal matrix above as executable tests;
- a budget test proving both ceilings and mid-run termination;
- an audit test proving content-free records for a success and a refusal;
- one opt-in live test under `tests/live/`, excluded from default vitest and
  therefore from CI;
- the canonical typecheck, lint, boundaries, tests, build, format, docs and
  diff gates.

## Alternatives Considered

### Reuse `acme-live-confirmation/1` unchanged

Rejected. Its free-text `confirmer` would reintroduce the caller-supplied actor
that ADR-0035 removed, and its `caseCount` collides with the product's evidence
`caseId` in a case-first product. Sharing the pure primitives while versioning
a new document keeps both properties.

### `hash-only` retention

Rejected. It forfeits ADR-0017 resume and degrades `replayVerify` to
`unavailable`, which costs a second paid call on interruption and removes a
proof the product asserts today.

### Permit only `observe-artifact` live

Rejected. The trust pipeline is gateway-independent, so the restriction adds no
safety while removing everything past extraction.

### Cumulative per-principal budget in this increment

Deferred. It is a persistence design — accumulation, reset window, contention —
not a gateway decision, and case binding plus audit give attribution now.

### Treat the confirmation as authorization

Rejected. Confirmation is intent and cost; authorization is ADR-0035 policy and
ADR-0036 membership. Conflating them would let a well-formed document stand in
for access control.

### Browser-only enablement without deployment opt-in

Rejected. A single interface mistake would be able to spend money. Deployment
opt-in is a key the browser cannot supply.

## Consequences

### Positive

- The extraction path becomes reachable for material outside the sealed corpus,
  which is the prerequisite for any demonstration on new documents.
- Cost is bounded twice, and the outer bound is not reachable from the product
  surface.
- The acting principal remains server-derived; live capability cannot be used
  to choose an identity or to probe case existence.
- Replay verification and interrupted-execution resume survive going live.
- Slice 9 is untouched, and the two gates stay independently auditable.

### Negative

- Retained payloads are durable records of document content. Acceptable under
  `synthetic-only`; a real class must revisit it.
- A hosted deployment must manage a durable payload key or forgo live, which
  adds a second key concern beside ADR-0037's KEK.
- The policy action set and the audit vocabulary both grow, and both must stay
  deny-by-default and content-free.
- CI never exercises the real provider path, so live remains proven by an
  opt-in test and an offline transport proof rather than continuously.

## Compatibility and Migration

- The mock gateway remains the default. Existing compositions, tests and CI are
  unchanged and continue to perform zero live calls.
- `evidence-security-audit-event/1` gains new `action` and `resourceKind`
  members. Adding members does not invalidate stored records; readers pinned to
  the previous member list would need updating, and there are none outside this
  repository.
- The product action policy gains `live-model.run`. Deny-by-default means no
  existing role acquires it implicitly.
- No existing schema changes meaning, and no stored record requires migration.

## Follow-ups

- Implement this ADR as a separately frozen task with the section 10 gates.
- Decide cumulative per-principal budget accounting when a real need appears.
- Revisit section 6 retention as part of the Slice 9 data-class review.
- Fold the durable payload-key requirement into ADR-0037's open question about
  whether the mounted-secret provider suffices or an external KMS/HSM is needed.

## References

- [ADR-0016 — Encrypted payload retention](0016-encrypted-payload-retention.md)
- [ADR-0017 — Durable execution resume](0017-durable-execution-resume.md)
- [ADR-0023 — Live evaluation gate](0023-live-evaluation-gate.md)
- [ADR-0027 — Async launch, job progress and cancellation](0027-async-launch-job-progress-cancellation.md)
- [ADR-0028 — First POC is the Evidence Integrity Workbench](0028-first-poc-evidence-integrity-workbench.md)
- [ADR-0035 — Authenticated principal and authorization](0035-evidence-authenticated-principal-and-authorization.md)
- [ADR-0036 — Case management and isolation](0036-evidence-case-management-and-isolation.md)
- [ADR-0037 — Secure artifact foundation](0037-evidence-secure-artifact-foundation.md)
- [ADR-0038 — Bounded text ingestion and immutable redaction](0038-bounded-text-ingestion-and-immutable-redaction.md)
- [Slice 9 prerequisite checklist](../backlog/slice-9-prerequisite-checklist.md)
