# ADR 0004 — Deterministic transition identity

Status: Accepted

Date: 2026-07-29

Decision owners: ACME maintainers

## Context

`StateTransition` is durable replay evidence and requires a globally stable
`transitionId`. The original state contract did not define how that ID was
created. `IdGenerator` has no transition kind, and extending it would permit a
retry or replay to allocate a different identity for the same logical state
operation.

The original `StateEngine.prepare()` context also omitted `entityId`. When no
current snapshot exists, the engine therefore lacked the entity identity
needed by `module.initialState()` and the first snapshot.

## Decision

ACME derives transition identity with the versioned algorithm
`acme-transition-id-1`.

The canonical identity input is:

```ts
{
  algorithm: "acme-transition-id-1",
  executionId,
  operationKey,
  namespace,
  entityId,
}
```

The serialized ID is:

```text
transition_<sha256(acme-cjson-1(identity-input))>
```

The StateEngine obtains `namespace` from the domain module. Its prepare context
explicitly contains `entityId`, `executionId`, `operationKey` and `now`.

`IdGenerator` is not extended with a transition kind. Revision, delta content,
timestamps, previous/next hashes and retry order do not participate in
transition identity. Divergent content under one transition identity is a
repository conflict, not a new transition.

## Alternatives Considered

### Extend `IdGenerator`

- Benefits: symmetric allocation with executions, calls, documents, memories
  and events.
- Costs: stable retries and replay would depend on reproducing generator state.
- Reason not selected: transition identity represents a logical operation and
  must survive retry timing and process boundaries.

### Hash complete transition content

- Benefits: content-addressed transition records.
- Costs: changed content under one operation would silently receive a new ID
  instead of exposing an idempotency conflict.
- Reason not selected: operation identity and content integrity are different
  concerns. State hashes already address content.

### Random UUID

- Benefits: simple globally unique allocation.
- Costs: the same operation receives different identities across preparation,
  retry and replay.
- Reason not selected: it weakens deterministic replay.

## Consequences

### Positive

- State preparation is deterministic without generator state.
- Retries and replay reproduce the same transition identity.
- The identity is available before persistence.
- Mutable transition content cannot change the operation identity.
- Revision-zero state has the entity context required for initialization.

### Negative

- The derivation algorithm becomes a compatibility contract.
- SHA-256 collision resistance is part of the identity assumption.
- Reusing an execution/operation identity for different content must be
  rejected later by repository idempotency checks.

## Compatibility and Migration

`acme-transition-id-1` is immutable. A future algorithm requires a new
identifier, an ADR and explicit persisted-format compatibility handling.
Existing transition IDs are never rewritten in place.

## Follow-ups

- ACME-0006 implements the pure derivation and StateEngine preparation.
- The in-memory and SQLite repositories must reject divergent content under
  one `transitionId`.
- Replay verification must reproduce the recorded transition identity.

## References

- [ACME specification, state model](../design/acme-design-and-development-spec.md#11-state-model)
- [ADR 0003 — SQLite revisioned Unit of Work](0003-sqlite-revisioned-unit-of-work.md)
- [ACME-0006 task charter](../finished/ACME-0006_pure-state-engine.md)
