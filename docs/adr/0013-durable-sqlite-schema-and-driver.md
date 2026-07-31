# ADR 0013 — Durable SQLite schema and driver

Status: Accepted

Date: 2026-07-31

Decision owners: ACME maintainers

## Context

[ADR-0003](0003-sqlite-revisioned-unit-of-work.md) decided that the first
durable adapter uses SQLite in WAL mode with a revisioned Unit of Work, ordered
checksum-verified migrations and `BEGIN IMMEDIATE`. It did not fix the driver
package or the exact first migration.

Two facts forced concrete decisions while implementing that adapter under
ACME-0021:

1. The pinned Node `24` runtime now ships a built-in `node:sqlite`, which the
   approved specification predates.
2. The specified schema in
   [specification section 15.2](../design/acme-design-and-development-spec.md#152-sqlite-schema)
   is lossy for three record types. It was written before ADR-0012 introduced
   portable replay evidence, and its `model_calls` shape assumes a
   provider/model pair that a provider-neutral reservation does not have.

The in-memory adapter and the shared `executionRepositoryConformance()` suite
already define the observable contract. A durable adapter that silently drops
contract fields would pass method-name inspection and fail meaning.

## Decision

### Driver

`@acme/adapter-sqlite` depends on `better-sqlite3`, as named in the approved
specification. Its synchronous API lets the whole Unit of Work run inside one
`BEGIN IMMEDIATE` transaction function without interleaving.

`node:sqlite` is not adopted while it is marked experimental.

### First migration

Migration `1` (`initial-revisioned-unit-of-work`) creates every table specified
in section 15.2, its four required indexes, and `schema_migrations`. Its
checksum is `sha256(acme-cjson-1({version, name, statements}))`, so any edit to
the migration source is rejected against an existing database.

The specified columns are kept as the queryable, indexable and constraint-
bearing projection. Where the core contract carries more than those columns can
express, the exact contract value is additionally stored as canonical
`acme-cjson-1` text:

- `executions.request_json` — the complete `ExecutionRequest`, including its
  provider-neutral `model` selection and optional policy override.
- `model_calls.selection_json` and `model_calls.record_json` — the
  provider-neutral `ModelSelection` and the exact `ModelCallRecord`.
  `provider` and `model` become nullable, because a reservation has neither
  until a response is recorded.
- `memory_candidates.candidate_json` — the exact `MemoryCandidate`, whose
  `confidence` and `source` provenance have no specified columns.

One table is added beyond the specified minimum. `execution_commits` stores the
operation digest, the committed projection and the exact `PreparedCommit`,
including the ADR-0012 replay-evidence sidecar. Without it, identical-commit
replay and `loadReplayEvidence()` cannot be served from durable storage.

`state_transitions.operation_key` is unique per `(namespace, entity_id)` rather
than globally, matching the scoped collision check the in-memory adapter
performs. A globally unique index would reject writes the reference adapter
accepts, and the two adapters must not diverge.

## Alternatives Considered

### Built-in `node:sqlite`

- Benefits: no native dependency, no prebuild resolution in CI.
- Costs: still marked experimental, emits an `ExperimentalWarning`, and
  deviates from the approved specification.
- Reason not selected: durable persistence is the correctness foundation of the
  milestone; it should not rest on an experimental API.

### Fully normalized columns with no canonical JSON

- Benefits: every field is directly queryable.
- Costs: each contract change becomes a migration, and the lossy fields above
  would have to be reconstructed by convention.
- Reason not selected: exact round-trip fidelity is what the conformance suite
  actually asserts, and reconstruction by convention is where adapters diverge.

### Canonical JSON only, no specified columns

- Benefits: smallest migration and no duplication.
- Costs: no indexes, no uniqueness constraints, and no schema inspectable with
  ordinary SQLite tools.
- Reason not selected: the compare-and-swap and idempotency constraints in
  ADR-0003 depend on real column constraints.

## Consequences

### Positive

- The durable adapter passes the unchanged shared conformance suite and
  produces evidence byte-equal to the in-memory adapter for the same execution.
- A tampered migration checksum or an unknown recorded version stops startup
  with `PERSISTENCE_CORRUPTION`.
- Replay evidence survives a process restart with no new model call and no new
  ID allocation.

### Negative

- Duplication exists between the projection columns and the canonical JSON
  columns; both must be written in the same statement.
- `better-sqlite3` is a native dependency whose prebuilds must resolve on every
  supported platform, and it must appear in pnpm's `onlyBuiltDependencies`.
- SQLite retains its single-writer constraint.

### Follow-ups

- Milestone 2 fault injection at every transaction boundary.
- Outbox delivery, retention encryption and privacy deletion remain unbuilt and
  require their own ADRs.
- A future production adapter must pass the same conformance suite; matching
  method names grants it nothing.

## Compatibility and Migration

Migration `1` is the baseline; no database predates it. Any later change to
persisted structure requires a new numbered migration and an ADR. Editing
migration `1` in place is a breaking change that existing databases will
reject by checksum, which is the intended behavior.

## References

- [ADR-0003 SQLite revisioned Unit of Work](0003-sqlite-revisioned-unit-of-work.md)
- [ADR-0006 aggregate in-memory Unit of Work](0006-aggregate-in-memory-unit-of-work.md)
- [ADR-0012 Milestone 1 execution identity and replay](0012-milestone-1-execution-identity-and-replay.md)
- [ACME specification, sections 15.1–15.3](../design/acme-design-and-development-spec.md#151-ports)
