# ADR 0026 — Durable quality evaluation store

Status: Accepted

Date: 2026-08-06

Decision owners: ACME maintainers

## Context

ADR-0025 defines post-execution quality evaluation as a sibling layer with an
append-only `QualityEvaluationStore` port. Only an in-memory adapter existed.
Gap G19 / plan Q1 requires durable persistence without mutating execution
evidence.

## Decision

### 1. SQLite migration v2 adds `quality_evaluations`

The durable schema is a single append-only table:

- primary key `evaluation_id` (content-derived, ADR-0025)
- query columns: `run_id`, `execution_id`, digests, evaluator identity, verdict
- `record_json` holds the complete `acme-quality-evaluation/1` record

Indexes support list-by-run and list-by-execution with stable
`evaluation_id` order.

### 2. No foreign key to `executions`

Quality evidence must not be rewritten when ledger rows change and must not
force co-retention with executions. `execution_id` is a subject identity
string, not a relational dependency.

### 3. Same port as memory; adapter owns SQLite

`@acme/adapter-sqlite` implements `QualityEvaluationStore` with the same
idempotent put / detached get / filtered list semantics as the in-memory
adapter. Collision remains `QUALITY_STORE_COLLISION`. Driver errors stay
mapped by the existing SQLite driver classification path (ACME-0057).

### 4. Composition chooses the store

Callers (CLI, ScenarioRunner, Test UI) inject memory or SQLite. Default
offline paths may remain memory; durable selection is opt-in until Q2 wiring.

## Alternatives Considered

### Store quality rows inside ExecutionRepository

- Benefits: one repository object.
- Costs: couples evaluation to the ledger aggregate and revisioned UoW.
- Reason not selected: ADR-0025 keeps evaluation a sibling layer.

### Foreign key from quality to executions

- Benefits: referential integrity.
- Costs: cannot retain evaluations independently; cascade rules rewrite
  product retention policy.
- Reason not selected: independent lifecycle is required.

## Consequences

### Positive

- Quality results survive process restart on the same SQLite file.
- Conformance kit proves parity with the in-memory adapter.

### Negative

- Orphan `execution_id` values are possible if ledger rows are deleted.
- Callers must open the quality store explicitly until composition roots
  wire it by default (Q2).

### Follow-ups

- Q2: CLI list/inspect over durable store
- Q3: Test UI surface
- Q4: live AI judge (separate charter)
