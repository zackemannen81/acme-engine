# ADR 0003 — SQLite revisioned Unit of Work

Status: Accepted

Date: 2026-07-29

Decision owners: ACME maintainers

## Context

ACME must prove durable, replayable execution locally before selecting
production infrastructure. Documents, memory, state, events and the terminal
execution result form one logical commit. A crash after a durable model result
but before that commit must recover without another model call. Concurrent
state writers must fail safely.

## Decision

The first durable adapter uses SQLite in WAL mode with:

- append-oriented execution, attempt, model-call and evaluator ledger
- revisioned complete state snapshots and explicit transitions
- a `state_heads` compare-and-swap row per namespace/entity
- canonical documents and memory records
- domain events plus an atomic outbox
- ordered checksum-verified migrations
- `BEGIN IMMEDIATE` for the canonical Unit of Work

Core receives one aggregate `ExecutionRepository`; adapter-internal stores do
not weaken transaction ownership. Model responses are recorded durably before
interpretation. The final Unit of Work atomically commits every canonical
effect and the terminal execution projection.

## Alternatives Considered

### PostgreSQL first

- Benefits: concurrency, operational maturity and production trajectory.
- Costs: external service dependency and more setup before local semantics are
  proven.
- Reason not selected: the first milestone requires portable offline tests.

### Separate repositories without aggregate transaction

- Benefits: smaller interfaces and easy mock objects.
- Costs: partial writes and unclear commit ownership.
- Reason not selected: atomic candidate-to-canonical promotion is a primary
  invariant.

### Event log as the only persisted state

- Benefits: natural replay and append-only history.
- Costs: projection/version complexity before event semantics stabilize.
- Reason not selected: snapshots plus explicit transitions provide the needed
  auditability with lower initial complexity.

## Consequences

### Positive

- Deterministic local durability with no service dependency.
- Atomic state, memory, document, event and execution commits.
- Explicit optimistic concurrency and crash-recovery tests.
- Schema can be inspected with ordinary SQLite tools.

### Negative

- SQLite has a single-writer constraint.
- Native driver distribution needs verification.
- A later production store will require the full repository conformance suite.
- A remote provider call cannot be made atomic with the local database.

### Follow-ups

- Milestone 2 implements fault injection at every transaction boundary.
- A live adapter ADR must define provider idempotency/reconciliation.
- A production database choice remains out of scope.

## Compatibility and Migration

Migrations are forward, ordered and checksum-verified. Persisted schema changes
require an ADR and migration tests against prior fixtures. A future repository
adapter must pass the same conformance suite; it does not inherit correctness
by matching method names.

## References

- [ACME specification, sections 14–15](../design/acme-design-and-development-spec.md#14-execution-protocol)
- [ACME project brief durability requirement](../PROJECT_BRIEF.md#durability-requirement)
