# ADR 0008 — Post-memory domain state projection

Status: Accepted

Date: 2026-07-30

Decision owners: ACME maintainers

## Context

`TaskDefinition.interpret()` previously returned
`ModuleResult.stateDelta` before `MemoryEngine.prepare()` resolved memory
candidates. That ordering cannot implement the approved reference behavior:
Narrative state depends on accepted create, merge, contest and supersession
decisions, while Research promotion and contest state depends on corroboration
resolved by the domain memory policy.

Letting core infer those state changes would move domain meaning into the
engine. Letting memory policy mutate state or persist effects would violate
the pure preparation and one-Unit-of-Work boundaries. A task must also be
unable to treat ignored or rejected candidates as accepted memory-derived
state evidence.

## Decision

### Execution sequence

The normative sequence is:

```text
interpret contract output
  → evaluate interpreted result
  → prepare memory decisions and mutations
  → build filtered immutable state-projection input
  → task-owned projectState()
  → StateEngine validation/reduction/invariants
  → one aggregate repository commit
```

Evaluation remains before memory preparation so blocked or revised results do
not produce canonical effects. State projection remains before StateEngine;
its output is a candidate delta, never canonical state.

### Interpreted state intent

`ModuleResult.stateDelta` is renamed to `stateIntent`. It carries an optional
typed `StateDelta<TDelta>` describing direct state intent known during
interpretation. The name makes its status explicit: it has not incorporated
memory policy decisions and is not the final delta.

Direct state intent is for effects independent of memory acceptance. A domain
must not encode a memory candidate as accepted state in `stateIntent` and then
bypass the post-memory decision filter.

### Task-owned projection

Every `TaskDefinition` supplies a synchronous, pure
`projectState(input, context)` hook. It returns the final optional typed
`StateDelta<TDelta>`.

The hook owns all domain-specific composition between direct state intent and
accepted memory-derived effects. Core has no Narrative, Research or generic
promotion rules. The hook must not read a store, provider, clock, environment
or random source; it uses only its immutable arguments.

### Filtered projection input

Core builds `StateProjectionInput<TDelta>` from the interpreted result and
`PreparedMemory`:

- candidate keys and prepared-decision keys must be unique
- the two key sets must correspond exactly
- prepared decision order is preserved
- each included decision retains its correlated candidate, identity key,
  accepted resolution and affected memory IDs
- `create`, `reinforce`, `merge`, `contest` and `supersede-existing` are
  included
- `ignore` and `reject-candidate` are excluded
- the complete returned input is canonical-JSON cloned, detached and deeply
  frozen

The filtered input does not expose rejected or ignored candidates to
memory-derived projection. Conformance and module tests must additionally
prove that changing only rejected/ignored candidates cannot alter the final
delta.

### Validation and commit

`projectState()` output remains untrusted domain output. The future
ExecutionEngine passes it to StateEngine, which validates the delta schema,
applies the reducer, validates the next state and runs invariants. Only the
aggregate repository transaction may promote the prepared memory, state and
other effects together.

Replay rebuilds the same projection input from recorded interpretation and
prepared memory evidence, invokes the same versioned task/module code and
compares the resulting delta/state hashes. This ADR adds no independent
projection digest or persistence schema.

## Alternatives Considered

### Keep the pre-memory state delta and patch it in core

- Benefits: minimal public contract change.
- Costs: core would need domain-specific merge and promotion semantics.
- Reason not selected: state meaning and delta composition are domain-owned.

### Let `DomainMemoryPolicy` return or persist state changes

- Benefits: the policy already knows the resolution.
- Costs: couples memory identity/resolution to state ownership, makes policy
  effectful and permits partial writes.
- Reason not selected: memory preparation and state preparation must remain
  pure inputs to one atomic Unit of Work.

### Pass every memory decision to projection

- Benefits: complete audit evidence is available to the hook.
- Costs: ignored and rejected candidates could become canonical state through
  the normal projection path.
- Reason not selected: audit retains every decision separately; state
  projection receives only applied decisions.

### Return a closure from `interpret()`

- Benefits: arbitrary task-specific composition without a new public hook.
- Costs: closures are not serializable, fingerprintable or replay evidence and
  can capture mutable or nondeterministic state.
- Reason not selected: projection must be an explicit versioned task
  operation over recorded values.

## Consequences

### Positive

- Reference-domain reducers can depend on actual memory resolutions without
  domain branches in core.
- Rejected and ignored candidates are excluded at the core transport boundary.
- Task typing remains tied to the same module delta type.
- Projection input is deterministic, immutable and suitable for offline
  replay.
- StateEngine and repository responsibilities remain unchanged.

### Negative

- Every task must implement a projection hook, including tasks that simply
  return their direct intent.
- Domain tests must distinguish direct state intent from memory-derived state.
- A future ExecutionEngine must add an explicit post-memory orchestration
  step and map projection failures to domain-invalid execution results.
- Determinism and purity of domain code still require conformance and
  module-specific tests; TypeScript cannot prove them.

## Compatibility and Migration

No reference module, ExecutionEngine or published package uses the previous
`stateDelta` result field. ACME-0011 changes the contract before those
consumers exist. Future changes to projection ordering, included decision
classes or persisted replay evidence require a new ADR and compatibility
review.

## Follow-ups

- The reusable DomainModule conformance kit must verify projection purity,
  filtering invariance and state-schema handoff.
- Narrative and Research must implement the same hook without importing
  adapters or adding core domain branches.
- The future ExecutionEngine must record the interpreted result and prepared
  evidence needed to reproduce projection.

## References

- [ACME specification, task-typed modules](../design/acme-design-and-development-spec.md#10-task-typed-domain-modules)
- [ADR 0002 — Static task-typed module composition](0002-static-task-typed-module-composition.md)
- [ADR 0005 — Pure memory decision application](0005-pure-memory-decision-application.md)
- [ADR 0006 — Aggregate in-memory Unit of Work](0006-aggregate-in-memory-unit-of-work.md)
- [ACME-0011 task charter](../finished/ACME-0011_post-memory-state-projection.md)
