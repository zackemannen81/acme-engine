# ADR 0012 — Milestone 1 execution identity and replay

Status: Accepted

Date: 2026-07-31

Decision owners: ACME maintainers

## Context

The contract, pure state/memory engines, aggregate repository, deterministic
model mock and NarrativeModule exist, but no component coordinates them.
Milestone 1 needs one bounded `ExecutionEngine` path with request-key
idempotency and offline replay verification.

The pre-existing contracts leave five execution decisions incomplete:

1. policy defaults and which policy values the first path can honor;
2. request and operation identity;
3. deterministic memory retrieval;
4. exact portable replay evidence and retention behavior; and
5. the honest public surface before durable resume and diagnostic replay modes
   exist.

These decisions must be fixed before orchestration depends on them. The
existing `acme-model-request-hash-1`, `acme-transition-id-1` and
`acme-operation-digest-1` algorithms remain immutable.

## Decision

### Bounded effective policy

The immutable Milestone 1 defaults are:

```ts
{
  timeoutMs: 30_000,
  maxModelCalls: 1,
  maxRepairCalls: 0,
  maxRevisionCalls: 0,
  retention: "hash-only",
}
```

Optional input/output token and estimated-cost limits are absent unless the
caller supplies them. All supplied numeric policy fields are positive safe
integers except repair/revision counts, which may be zero. The bounded engine
rejects every effective policy except exactly one model call and zero repair
and revision calls. Rejection is `INVALID_REQUEST` before repository or
gateway effects.

Policy is resolved once for a proposed acceptance and stored as evidence. An
existing compatible request always uses its stored policy. Replay never
re-resolves current defaults.

### Deterministic acceptance and operation identity

`acme-execution-id-1` derives the proposed execution ID from the repository's
idempotency scope:

```text
execution_ +
sha256(acme-cjson-1({
  algorithm: "acme-execution-id-1",
  namespace,
  requestKey
}))
```

The aggregate repository requires an execution ID before it can resolve a
request key. Derivation therefore lets same-key reuse allocate no ID and lets a
changed fingerprint deliberately conflict against the same logical
acceptance. `IdGenerator.next("execution")` is not used by this algorithm.

`acme-operation-key-1` derives the one state operation identity:

```text
operation_ +
sha256(acme-cjson-1({
  algorithm: "acme-operation-key-1",
  executionId,
  namespace,
  task,
  entityId
}))
```

Expected revision and prepared content remain operation content, not operation
identity. `acme-transition-id-1` continues to bind this operation key to the
state transition.

### Request fingerprint

`acme-request-fingerprint-1` hashes only outcome-determining request content:

```text
sha256(acme-cjson-1({
  algorithm: "acme-request-fingerprint-1",
  namespace,
  task,
  entityId,
  expectedRevision,
  input: <validated canonical task input>,
  contractFingerprint,
  stateSchemaVersion,
  model: <exact validated ModelSelection>,
  retrieval: {
    algorithm: "acme-memory-retrieval-1",
    limit: 50
  }
}))
```

Timeout, call/token/cost budgets and retention are operational evidence and do
not enter the fingerprint. A model-selection change is outcome-determining and
therefore conflicts under an existing request key. A budget-only change does
not retroactively conflict a previously accepted execution.

The input hash is SHA-256 over the canonical validated task input. Contract
fingerprint behavior remains owned by the immutable contract registry.

### Deterministic retrieval

The only Milestone 1 retrieval algorithm is
`acme-memory-retrieval-1`. Core constructs:

```ts
{
  namespace,
  entityId,
  task,
  limit: 50,
}
```

It supplies neither `kinds` nor `text`. The repository loads the complete
active/contested scope. `MemoryEngine.retrieve()` applies the module policy,
stable ordering and the limit. Only ranked result records enter
`ExecutionReadContext.memories`; module policy continues to own relevance and
scoring.

The recorded read set retains the state snapshot, complete loaded memory set,
every ranked memory with score, reasons and one-based rank, and loaded
documents. Replays use this recorded set rather than current canonical
records.

### Replay evidence and retention

`PreparedCommit` gains a replay-evidence sidecar containing the validated task
input and exact recorded read set. The sidecar is stored atomically with the
commit but is explicitly excluded from the immutable
`acme-operation-digest-1` preimage.

The repository retains the exact prepared commit and exposes one new
read-only aggregate operation:

```ts
loadReplayEvidence(executionId): Promise<ExecutionReplayEvidence | null>
```

The returned aggregate contains the recorded request, effective policy, task
input, read set, model calls and prepared commit. It opens no transaction and
returns detached immutable values. Adapter-specific inspection remains outside
core.

Normalized response identity uses
`acme-model-response-hash-1`, SHA-256 over:

```text
acme-cjson-1({
  algorithm: "acme-model-response-hash-1",
  response: <complete validated NormalizedModelResponse>
})
```

`none` and `hash-only` retention preserve this hash and model-call metadata but
omit the normalized response payload. `encrypted-payload` preserves the
payload in the deterministic in-memory adapter; durable adapters must protect
it according to their separately approved storage design.

### Replay verification

Replay verification:

1. loads only recorded aggregate evidence;
2. reuses recorded `executionId` and `committedAt` as the execution clock;
3. rebuilds projection and model request from recorded task input/read context;
4. processes the recorded normalized response without calling a gateway;
5. re-runs interpretation, memory policy, state projection and StateEngine;
6. replays recorded memory-create IDs from prepared evidence without invoking
   the engine's external `IdGenerator`;
7. rebuilds the prepared commit at the recorded commit time; and
8. compares only the recorded and recomputed `acme-operation-digest-1`.

Contract/model request/response, retrieval, candidate, memory and state
divergence is reported as `DiagnosticFact` entries. Those facts explain a
different digest; they do not form a second replay digest.

The result is:

- `match` when the single operation digest is equal;
- `different` when replay can run but the digest or supporting evidence
  differs; or
- `unavailable` when required recorded evidence, especially a retained
  normalized response payload, is absent.

Replay never writes canonical data and never invokes `ModelGateway`.

### Bounded public surface

Milestone 1 publishes only:

```ts
interface ExecutionEngine {
  execute<TInput>(request: ExecutionRequest<TInput>):
    Promise<ExecutionResult>;
  replayVerify(executionId: ExecutionId): Promise<ReplayReport>;
}
```

`execute()` has no `AbortSignal` until cancellation can be honored across live
I/O and durable resume. `resume`, `rebuild-candidates` and `fork` are not
members that throw; later implementation adds them with their real contracts.
The existing `cancelled` status remains reserved for that later boundary.

## Alternatives Considered

### Include policy in request identity

- Benefits: one fingerprint covers every request field.
- Costs: a changed default or retention setting retroactively conflicts the
  same outcome request.
- Reason not selected: budgets constrain execution effort, not intended
  canonical outcome.

### Allocate an execution ID before repository acceptance

- Benefits: uses the existing generic generator.
- Costs: every idempotent repeat consumes a new ID before the repository can
  identify the existing request.
- Reason not selected: it violates the required no-allocation repeat behavior.

### Replay from current canonical tables

- Benefits: less retained evidence.
- Costs: changed memory records or documents silently alter the replay input.
- Reason not selected: verification must describe the recorded execution.

### Add separate replay-evidence write methods

- Benefits: smaller commit input.
- Costs: evidence can become visible separately from the canonical commit and
  expands transaction ownership.
- Reason not selected: the existing aggregate commit is the atomic boundary.

### Define a second replay digest

- Benefits: could exclude recorded identity and time.
- Costs: two algorithms acquire overlapping meanings and compatibility rules.
- Reason not selected: recorded identity/time make
  `acme-operation-digest-1` directly comparable.

### Publish future methods that throw

- Benefits: the interface resembles the eventual design.
- Costs: callers see a capability that does not exist.
- Reason not selected: a smaller additive surface is honest and compatible.

## Consequences

### Positive

- Request-key reuse is deterministic without speculative ID allocation.
- Current policy defaults cannot reinterpret existing request identity.
- Prompt context and replay input are stable across later memory drift.
- Replay uses one committed-effect digest with explicit supporting diagnostics.
- Core remains domain-neutral and depends only on ports and pure engines.
- Later resume and replay modes can be added without breaking this surface.

### Negative

- Full replay requires explicit response-payload retention.
- Replay evidence duplicates selected read values and the prepared commit.
- The in-memory adapter stores full retained payloads without claiming durable
  encryption.
- A future retrieval algorithm, fingerprint preimage or identity rule requires
  new versioned identifiers and compatibility handling.

## Compatibility and Migration

No ExecutionEngine or durable execution data exists. These contracts are added
before persisted Milestone 1 engine executions exist.

All six new identifiers are immutable:

- `acme-execution-id-1`
- `acme-operation-key-1`
- `acme-request-fingerprint-1`
- `acme-memory-retrieval-1`
- `acme-model-response-hash-1`
- the existing, unchanged `acme-operation-digest-1`

Changing any preimage, canonicalization, prefix, retrieval limit or retention
meaning requires a new algorithm identifier, ADR and explicit compatibility
path. Durable resume, SQLite recovery and additional replay modes remain
separate decisions.

## Follow-ups

- ACME-0018 implements the bounded engine, repository evidence and Narrative
  Phase 5 scenario.
- SQLite must later persist the same portable replay projection and pass the
  repository conformance suite.
- Live providers require cancellation, timeout and reconciliation decisions
  before `AbortSignal` or resume enters the public surface.

## References

- [ACME specification, execution protocol](../design/acme-design-and-development-spec.md#14-execution-protocol)
- [ACME specification, persistence model](../design/acme-design-and-development-spec.md#15-persistence-model)
- [ADR 0006 — Aggregate in-memory Unit of Work](0006-aggregate-in-memory-unit-of-work.md)
- [ADR 0007 — Deterministic model mock](0007-deterministic-model-mock-and-gateway-conformance.md)
- [ADR 0008 — Post-memory state projection](0008-post-memory-domain-state-projection.md)
- [ACME-0018 task charter](../CURRENT_TASK.md)
