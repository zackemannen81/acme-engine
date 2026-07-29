# ADR 0006 — Aggregate in-memory Unit of Work

Status: Accepted

Date: 2026-07-29

Decision owners: ACME maintainers

## Context

StateEngine and MemoryEngine produce validated candidates, but no canonical
store exists. ACME requires documents, memory decisions/records, optional
state, evaluator evidence, domain events/outbox and the terminal execution
projection to become visible atomically.

The approved SQLite direction already requires one aggregate
`ExecutionRepository`. Milestone 1 needs an in-memory implementation that
proves the same port semantics without claiming process durability.

Three contract gaps must be resolved before that adapter can be correct:

1. `PreparedCommit.operationDigest` had no immutable algorithm.
2. Memory compare-and-swap had no expected-conflict error distinct from state
   revision conflicts or corruption.
3. Document/event candidates do not yet carry canonical IDs, so allocation and
   retry behavior need one owner.

## Decision

### One aggregate repository

Core exposes one `ExecutionRepository` for:

- execution acceptance and inspection
- attempt ledger append
- model-call reservation/completion/failure
- consistent context reads
- canonical prepared commit
- non-commit terminal marking

Adapters may use internal maps/tables, but no independently committable
state/memory/document/event ports are exposed to core.

### Versioned operation digest

The immutable algorithm identifier is `acme-operation-digest-1`.

The digest is:

```text
sha256(acme-cjson-1({
  algorithm: "acme-operation-digest-1",
  executionId,
  expectedRevision,
  documents,
  memoryCandidates,
  memory,
  state,
  evaluatorRuns,
  events,
  committedAt
}))
```

The `operationDigest` field itself is excluded. Documents, candidates and
events are sorted by key; evaluator runs are sorted by evaluator identity and
attempt. Memory mutations remain in prepared order because sequential expected
record versions are semantically significant.

The repository recomputes and verifies the supplied digest before commit. An
identical retry of an already committed execution returns its original
projection. A different digest for that execution is
`PERSISTENCE_CORRUPTION`.

### Expected conflicts

- State-head mismatch is `CONFLICT_STATE_REVISION`.
- Memory update `expectedRecordVersion` mismatch is
  `CONFLICT_MEMORY_VERSION`.
- Request-key reuse with a changed fingerprint returns `AcceptResult.conflict`.
- Divergent reuse of persisted IDs, transition IDs, operation keys or ledger
  keys is `PERSISTENCE_CORRUPTION`.

Expected conflicts never publish partial canonical effects.

### In-memory atomicity

`@acme/adapter-memory` applies a prepared commit to a private staged copy of
its complete store. The staged copy replaces the live store only after all
validation, state/memory compare-and-swap, identity checks and effect creation
succeed.

This copy-on-commit rule is the in-memory equivalent of one database
transaction. It proves visibility and rollback semantics, not durability
across processes.

### Candidate IDs and evidence

Memory record IDs are already part of prepared memory mutations. Document and
event IDs are adapter-created through the injected `IdGenerator` only after
the prepared commit and all compare-and-swap checks validate. Identical
committed retries return before allocation.

Every memory candidate is stored with its correlated decision, including
ignore and reject decisions. Evaluator evidence, events and matching pending
outbox rows are staged with the same commit.

### Conformance

`@acme/testing` owns a reusable repository conformance kit. The memory adapter
must pass it. A future SQLite adapter must pass the same kit plus
SQLite-specific durability, migration and fault-injection tests.

## Alternatives Considered

### Separate in-memory stores committed in sequence

- Benefits: small adapter classes and direct unit tests.
- Costs: failures can expose partial state and transaction ownership becomes
  orchestration policy.
- Reason not selected: atomic candidate promotion is a fixed guardrail.

### Trust the caller-supplied operation digest

- Benefits: less repository work.
- Costs: malformed or accidentally stale prepared content can be accepted
  under the wrong idempotency identity.
- Reason not selected: the repository is the canonical promotion boundary and
  must verify its idempotency key.

### Treat memory CAS mismatch as transient persistence failure

- Benefits: no new public error code.
- Costs: retries may repeat a semantically stale memory decision and the
  conflict is misclassified as infrastructure instability.
- Reason not selected: expected record-version mismatch requires a new read
  and execution decision.

### Allocate document/event IDs before the Unit of Work

- Benefits: every prepared effect is fully identified before repository entry.
- Costs: failed validation/CAS consumes IDs and expands ExecutionEngine
  responsibilities before orchestration exists.
- Reason not selected: the adapter can allocate after validation and return
  the persisted IDs in the committed projection.

## Consequences

### Positive

- Atomicity is visible in one port and one conformance story.
- Expected state and memory conflicts are distinguishable.
- Commit retry behavior is deterministic and content-verified.
- Candidate/evaluator evidence cannot be separated from canonical effects.
- The future SQLite implementation has an executable behavioral target.

### Negative

- The in-memory adapter copies maps for each commit and is not optimized for
  large datasets.
- Document/event IDs remain adapter-created rather than part of prepared
  candidates.
- ID generator state is not transactional; a generator failure or ID collision
  can consume attempted IDs even though no canonical effects publish.
- Process restart durability and true multi-process concurrency remain
  unproven.

## Compatibility and Migration

No repository implementation or persisted database exists. ACME-0008 adds the
first executable port contract. `acme-operation-digest-1` is immutable; future
digest input changes require a new algorithm identifier and compatibility
handling.

SQLite schema or migration changes remain governed by ADR-0003 and are outside
this task.

## Follow-ups

- The deterministic model mock and ExecutionEngine must use the aggregate port.
- SQLite must pass the repository conformance kit unchanged.
- Outbox delivery and crash recovery require later tasks.

## References

- [ACME specification, persistence model](../design/acme-design-and-development-spec.md#15-persistence-model)
- [ADR 0003 — SQLite revisioned Unit of Work](0003-sqlite-revisioned-unit-of-work.md)
- [ADR 0004 — Deterministic transition identity](0004-deterministic-transition-identity.md)
- [ADR 0005 — Pure memory decision application](0005-pure-memory-decision-application.md)
- [ACME-0008 task charter](../finished/ACME-0008_aggregate-in-memory-unit-of-work.md)
