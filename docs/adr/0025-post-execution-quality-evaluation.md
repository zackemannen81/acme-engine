# ADR 0025 — Post-execution quality evaluation

Status: Accepted

Date: 2026-08-05

Decision owners: ACME maintainers

## Context

ACME can execute and replay one task, sequence deterministic scenarios, assert
exact recorded facts and compute three transparent rates over run records. It
cannot yet attach a versioned quality assessment to an execution artifact.

Two existing concepts must not be overloaded:

1. Core's `EvaluationDecision` is a proposed pre-commit execution gate. Its
   `allow | block | revise` result belongs inside `PreparedCommit` and
   `acme-operation-digest-1`. Appending such evidence after commit would change
   the identity of the canonical operation.
2. S8 measurements are observations over run populations. A threshold can say
   whether a configured bound was met, but the measurement lens owns neither a
   quality model nor a composite score.

A post-execution assessment must instead consume immutable evidence, retain
its own provenance and remain removable without changing the execution it
describes. External assessments must be replayable offline without quietly
becoming a live model-judge path.

## Decision

### 1. Quality evaluation is a sibling layer, not an execution stage

`@acme/evaluation` depends only on public `@acme/core`. ExecutionEngine does
not depend on it and its existing evaluator contracts remain unchanged.

A quality evaluation occurs after an execution result exists. It cannot block,
revise, retry or mutate that execution, its state, memory, documents, fixtures
or baselines. Harness failure and quality verdict are separate values.

### 2. Every evaluation has a content-bound subject

The harness builds `acme-quality-subject/1` from:

- caller-supplied run id;
- exact `ExecutionResult` and its canonical digest;
- optional committed operation digest;
- artifact kind, id and SHA-256 digest;
- prompt-contract id, version and fingerprint.

The artifact content is evaluator input but is not copied into the stored
record. This prevents the evaluation store from silently widening execution
retention. The persisted subject contains identities and hashes only.

`acme-quality-subject-digest-1` hashes that complete subject through
`acme-cjson-1`. `acme-quality-evaluation-id-1` derives one evaluation identity
from the subject digest plus exact evaluator id, version and kind. Re-running
the same evaluator over the same subject therefore addresses the same record.
A changed artifact, contract or evaluator version creates a different id.

### 3. Evaluator output is explicit and bounded

A result contains:

- zero or more named scores, each with a finite value, explicit finite
  `[min, max]` scale and interpretation;
- zero or more structured findings with code, severity, message and optional
  JSON path; and
- exactly one quality verdict: `pass | fail | inconclusive`.

No harness-level weighting, aggregation or inferred verdict exists. Those are
quality-model decisions and belong to a named, versioned evaluator.
`acme-quality-result-digest-1` binds the exact validated result.

### 4. Evaluator kinds are deterministic or recorded-external

A deterministic evaluator is registered statically by `(id, version)`. It
receives a detached, deeply frozen subject, execution result and artifact.
Its returned value is untrusted until runtime validation passes.

A recorded-external evaluator is created only from an
`acme-recorded-quality-evaluation/1` fixture. It exposes no transport or model
gateway. Before replay it requires exact equality of subject, subject digest,
evaluator id/version/kind and result digest. A mismatch refuses replay rather
than grading different evidence with an old opinion.

Both kinds pass through the same output validation and append-only store.

### 5. Quality records have a separate append-only store

`QualityEvaluationStore` is a port owned by `@acme/evaluation`. An identical
write is idempotent. Reusing an evaluation id with different content is a
collision and is refused. Reads return detached values in deterministic order.

The first adapter is in memory. Durable SQLite storage requires a later ADR
and migration. Existing `evaluator_runs` rows are not reused: they are part of
the canonical execution Unit of Work and operation digest, while quality
records are post-execution evidence.

### 6. Assertions, metrics and quality verdicts remain distinct

`acme-scenario/2` adds two step kinds while version 1 remains accepted:

- `evaluate` resolves a prior execution, loads a digest-pinned artifact
  fixture and records one deterministic or recorded-external evaluation;
- `assertEvaluation` explicitly compares a prior evaluation's verdict.

An `evaluate` step passes when evaluation and storage succeed even if the
quality verdict is `fail`. Only `assertEvaluation` turns a verdict mismatch
into scenario failure. Existing execution assertions remain exact evidence
checks, and S8 metrics remain observational rates.

## Alternatives Considered

### Append to core `evaluatorRuns`

- Benefits: existing types and SQLite table already exist.
- Costs: those rows are committed atomically and included in the immutable
  operation digest. Post-commit append would contradict ADR-0006 and replay.
- Reason not selected: identical terminology does not make the lifecycle or
  authority equivalent.

### Put quality scoring in the Domain Test UI measurement view

- Benefits: S8 already displays rates and thresholds.
- Costs: a presentation lens would become the owner of a quality model, and
  deleting the leaf app could lose apparently canonical assessment evidence.
- Reason not selected: ADR-0019 and ADR-0022 explicitly forbid that role.

### Let every failing verdict fail its scenario step

- Benefits: concise scenario files.
- Costs: evaluator execution success, quality judgment and assertion semantics
  collapse into one status. An intentionally measured bad fixture could not be
  recorded without failing the run.
- Reason not selected: the distinction is a primary requirement.

### Call a model during recorded-external replay

- Benefits: the assessment could be refreshed automatically.
- Costs: replay would stop being deterministic, incur unbounded external
  effects and make an old evaluator version irreproducible.
- Reason not selected: a recorded evaluator is evidence playback, not a live
  judge.

## Consequences

### Positive

- Quality judgments are versioned, attributable and exactly bound to their
  evidence without changing canonical execution history.
- Deterministic and externally produced judgments share one stored contract
  while retaining distinct provenance.
- Scenario reports can record a bad quality verdict without lying that the
  evaluator itself failed.
- A future durable adapter can be judged by a reusable store conformance kit.

### Negative

- Quality evidence has a second repository lifecycle and cannot be queried
  through `ExecutionRepository`.
- Callers must assemble explicit run and artifact identity instead of passing
  only the thin `ExecutionResult`.
- A recorded external fixture is intentionally brittle: any bound identity
  change requires a new recording.
- SQLite durability and UI inspection remain unavailable in this first slice.

## Compatibility and Migration

`acme-scenario/1`, `acme-scenario-report/1`, ExecutionEngine,
`EvaluationDecision`, `PreparedEvaluatorRun`, `acme-operation-digest-1`, S8
measurements and existing databases are unchanged. ScenarioRunner accepts both
scenario document versions and emits the existing report version.

The following identifiers are immutable once published:

- `acme-quality-subject/1`
- `acme-quality-subject-digest-1`
- `acme-quality-artifact-digest-1`
- `acme-quality-execution-result-digest-1`
- `acme-quality-evaluation-id-1`
- `acme-quality-result-digest-1`
- `acme-quality-evaluation/1`
- `acme-recorded-quality-evaluation/1`
- `acme-scenario/2`

Changing a preimage or stored meaning requires a new identifier and migration
plan.

## Follow-ups

- Add durable quality-evaluation storage only when a consumer requires
  process-restart persistence.
- A read-only UI may later project stored quality records; it must not compute
  or edit them.
- Driver-error classification remains the independent adapter-hardening
  proposal in `docs/backlog/driver-error-classification.md`.

## References

- [ADR-0006 Aggregate in-memory Unit of Work](0006-aggregate-in-memory-unit-of-work.md)
- [ADR-0012 Execution identity and replay](0012-milestone-1-execution-identity-and-replay.md)
- [ADR-0019 Domain Test UI boundary](0019-domain-test-ui-boundary-and-view-contracts.md)
- [ADR-0022 Measurement semantics](0022-measurement-and-fixture-approval.md)
- [ACME-0054 task charter](../CURRENT_TASK.md)
