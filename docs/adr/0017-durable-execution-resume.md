# ADR 0017 — Durable execution resume

Status: Accepted

Date: 2026-08-01

Decision owners: ACME maintainers

## Context

Milestone 2 requires that a crash after a successful model call but before the
state commit is recoverable without calling the provider again. That property
is not implemented. `ExecutionEngine.execute()` accepts a request, finds a
compatible execution that is not terminal, and refuses:

```text
PERSISTENCE_TRANSIENT
Compatible execution exists but is not terminal; durable resume is not implemented.
```

The evidence needed to resume is already written on every execution.
`reserveModelCall` records the reservation before the gateway is invoked, and
`completeModelCall` records the normalized response, its hash and — under
`encrypted-payload` retention (ADR-0016) — the sealed envelope. Nothing reads
that evidence back for a non-terminal execution: `loadReplayEvidence` returns
`null` until a prepared commit exists.

The crash window this leaves open is the expensive one. Between the provider
response and the commit sit response validation, interpretation, memory
resolution, state projection and preparation. An interruption anywhere in that
span currently forces a second billed provider call to redo work that was
already paid for and already recorded.

Constraints already fixed by architecture:

- ADR-0012 fixes execution identity, the single primary call per execution and
  the recorded-evidence replay model.
- ADR-0014 fixes that an `ambiguous` model call is terminal for its execution
  and is never automatically retried.
- ADR-0016 fixes that a payload is readable only through the encryptor, and
  that its absence is reported honestly rather than reconstructed.
- The Milestone 1 budget of one primary model call per execution is unchanged
  by this decision.

## Decision

### 1. Resume never calls the provider

A resumed execution either completes from recorded evidence or terminates. It
never issues a model call for a reservation that already exists.

This is stronger than "avoid a duplicate call when we can prove one happened",
and deliberately so. The point of resume is that the crash window costs
nothing extra; a resume path that may call the provider under some conditions
would reintroduce exactly the cost it exists to remove, in the situations
hardest to reason about. Where evidence is insufficient, the execution
terminates and a human decides, rather than the engine spending money on a
guess.

The single exception is the case where the engine can prove no call was ever
made, covered in the table below.

### 2. What each recorded model-call state means for resume

The primary call is `callKey: 'model:0'`, `attempt: 1`, `purpose: 'primary'`.

| Recorded state | Resume behavior | Provider called |
| --- | --- | --- |
| no reservation at all | run the execution from the beginning under a fresh attempt number | yes, once |
| `reserved` / `in-flight` | terminal `MODEL_UNAVAILABLE`, not retryable | no |
| `succeeded`, response recoverable | continue from response validation using the recorded response | no |
| `succeeded`, response unrecoverable | terminal `RESUME_EVIDENCE_UNAVAILABLE`, not retryable | no |
| `failed` | terminal, re-raising the recorded error | no |
| `ambiguous` | terminal, re-raising the recorded error (ADR-0014) | no |

The first row is safe because the reservation is written **before** the
gateway is invoked. No reservation therefore proves no request left the
process, and a full run is both safe and preferable to stranding the
execution.

`reserved` and `in-flight` are the opposite case: the process died with a
request possibly in flight, and nothing recorded its outcome. That is the same
risk class as `ambiguous`, and it takes the same answer. ADR-0014's reasoning
applies unchanged — guessing that the call never happened is the unsafe
direction, because it silently duplicates work that may have run and been
billed. `MODEL_UNAVAILABLE` at stage `calling-model` matches the ADR-0014
classification table for an outcome that cannot be observed.

A response is **recoverable** when the recorded call carries a plaintext
`NormalizedModelResponse` after the repository's reveal step. Under `none` or
`hash-only` retention, or under `encrypted-payload` when the key is absent,
wrong or unknown, it is not, and the execution terminates with the new
`RESUME_EVIDENCE_UNAVAILABLE` code. This mirrors the `unavailable` replay
verdict: the engine does not reconstruct what was not retained.

### 3. Resume re-reads the context

A resumed run re-reads state, memory and documents through `loadContext`
rather than restoring the read set recorded by the interrupted run.

The recorded read set exists for replay verification, which asks what *did*
happen. Resume asks what *should be committed now*, and the answer must be
computed against the state that actually exists. If the entity's revision has
moved since the execution was accepted, `loadContext` rejects the stale
expected revision and the execution terminates as `conflicted` — the correct
outcome, because another writer committed while this execution was
interrupted. Committing against a read set the world has moved past would make
the interruption invisible in the ledger.

The consequence is that resume recomputes documents, memory decisions and the
state delta from the recorded response. This is intended: those steps are pure
and cost nothing, and only the provider call is irreplaceable.

### 4. A resumed run appends its own attempt

The resumed run uses `lastAttemptNumber + 1` for every stage it records.

Attempts are keyed by `(executionId, attemptNumber, stage)` and both adapters
reject a divergent reuse of that key as `PERSISTENCE_CORRUPTION`. Reusing
attempt 1 would therefore either silently collapse into the interrupted run's
attempt when timestamps happened to match, or fail as corruption when they did
not. Neither is acceptable, and the ledger should show that the execution was
interrupted and resumed rather than claiming one uninterrupted pass.

### 5. Resume evidence is a new repository capability

`ExecutionRepository` gains one method:

```ts
interface ExecutionResumeState {
  readonly executionId: ExecutionId;
  readonly lastAttemptNumber: number;
  readonly modelCalls: readonly ModelCallRecord[];
}

loadResumeState(executionId: ExecutionId): Promise<ExecutionResumeState | null>;
```

It returns `null` only for an unknown execution, applies the same reveal step
as `loadReplayEvidence`, and orders model calls by `callKey` then `attempt`.

`loadReplayEvidence` is not extended to cover this. Its return type is built
around a completed `PreparedCommit`, and widening it to non-terminal
executions would make that field optional for every existing caller in order
to serve one new one. A separate method keeps both contracts honest about what
they can promise.

### 6. No request-hash precondition on resume

The resumed run does **not** require the recomputed model-request hash to
equal the reserved `requestHash`.

A contract may legitimately embed the current time in the request it builds —
the reference fixture already does — so a recomputed hash is not stable across
a restart and would fail every resume for a reason unrelated to correctness.
Integrity is preserved elsewhere and earlier: a changed contract fingerprint
changes the request fingerprint, so `accept` reports
`CONFLICT_IDEMPOTENCY_KEY` before resume is ever reached, and the recorded
response is re-validated by the full response pipeline against the current
contract during the resumed run.

## Alternatives Considered

### Retry the model call when the reservation has no outcome

- Benefits: more interrupted executions finish without human involvement.
- Costs: duplicate billed calls and possible duplicate provider-side effects,
  with no provider history to reconcile against.
- Reason not selected: identical to the ambiguity argument in ADR-0014, which
  this decision must not quietly weaken.

### Restore the recorded read set instead of re-reading

- Benefits: the resumed run reproduces the interrupted run exactly, and the
  operation digest is trivially identical.
- Costs: commits against a world that may have moved; a concurrent writer's
  commit would be overwritten or silently lost.
- Reason not selected: expected-revision enforcement exists precisely to
  prevent this, and resume must not be the one path that bypasses it.

### Extend `loadReplayEvidence` to non-terminal executions

- Benefits: no new port method.
- Costs: `preparedCommit` becomes optional for all callers; the type stops
  describing what replay needs.
- Reason not selected: one honest method per question.

### Reuse an existing error code for unrecoverable evidence

- Benefits: no change to the public taxonomy.
- Costs: `PERSISTENCE_TRANSIENT` invites a retry that cannot succeed;
  `PERSISTENCE_CORRUPTION` blames storage for a retention policy working as
  configured.
- Reason not selected: the condition is neither transient nor corruption, and
  operators must be able to tell it apart from both.

## Consequences

### Positive

- The expensive crash window closes: an interruption after the provider
  response costs no additional call.
- Milestone 2's post-call crash acceptance becomes provable on both repository
  adapters through the shared conformance suite.
- Retention choice acquires a visible operational consequence: `hash-only`
  executions cannot be resumed, which is the same trade already accepted for
  replay.
- The ledger distinguishes an interrupted-and-resumed execution from an
  uninterrupted one.

### Negative

- `AcmeErrorCode` grows one member, which is a public-contract change.
- Every repository adapter must implement `loadResumeState`, including future
  ones.
- Executions interrupted between reservation and outcome are terminal and need
  a human decision; under a live provider this is the deliberate cost of not
  guessing.
- A resumed run's operation digest matches an uninterrupted run only when the
  inputs to the digest match, which includes the clock and the ID generator.
  Determinism claims about the digest remain scoped to deterministic
  composition, as they already are for replay.

### Follow-ups

- Reconciling `reserved`, `in-flight` and `ambiguous` calls against
  provider-side history remains deferred, and would turn several terminal rows
  in the table above into recoverable ones.
- Fault injection at arbitrary transaction boundaries and the concurrent
  two-writer proof remain open Milestone 2 residuals; this decision does not
  address them.
- An operator-facing command to inspect and discharge stranded executions is
  not part of this decision.

## Compatibility and Migration

No storage schema change and no migration. `loadResumeState` reads tables that
both adapters already write. Existing recorded executions gain resume support
retroactively to the extent their retention preserved a response.

The added `RESUME_EVIDENCE_UNAVAILABLE` code is additive; no existing code path
changes its classification, and `terminalStatus` maps it to `failed`.

## References

- [ADR-0012 Milestone 1 execution identity and replay](0012-milestone-1-execution-identity-and-replay.md)
- [ADR-0013 durable SQLite schema and driver](0013-durable-sqlite-schema-and-driver.md)
- [ADR-0014 live provider boundary and transport port](0014-live-provider-boundary-and-transport-port.md)
- [ADR-0016 encrypted payload retention](0016-encrypted-payload-retention.md)
- [ACME-0033 charter](../finished/ACME-0033_durable-execution-resume.md)
