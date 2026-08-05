# Current Task

Task ID: ACME-0054
Parent Task: None
Status: In Progress
Owner: Codex
Created: 2026-08-05
Last updated: 2026-08-05
Charter frozen at: 2026-08-05

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- [`docs/backlog/driver-error-classification.md`](backlog/driver-error-classification.md)
- [`docs/design/acme-design-and-development-spec.md`](design/acme-design-and-development-spec.md)
- [`docs/adr/0006-aggregate-in-memory-unit-of-work.md`](adr/0006-aggregate-in-memory-unit-of-work.md)
- [`docs/adr/0012-milestone-1-execution-identity-and-replay.md`](adr/0012-milestone-1-execution-identity-and-replay.md)
- [`docs/adr/0013-durable-sqlite-schema-and-driver.md`](adr/0013-durable-sqlite-schema-and-driver.md)
- [`docs/adr/0022-measurement-and-fixture-approval.md`](adr/0022-measurement-and-fixture-approval.md)

## Task Summary

ACME records replayable execution evidence and can assert exact outcomes or
measure recorded run rates, but it has no general post-execution quality
assessment layer. Core also has a distinct, currently dormant pre-commit
`EvaluationDecision` contract whose `allow | block | revise` evidence belongs
to the canonical execution digest; post-execution quality must not overload or
append to that boundary.

This task establishes a domain-neutral quality-evaluation package, an
append-only in-memory store and explicit ScenarioRunner v2 steps. Named,
versioned deterministic evaluators consume immutable execution-bound evidence.
Recorded external assessments replay only when every subject and evaluator
identity matches, and never perform a live call.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Create and prove a domain-neutral, post-execution quality-evaluation harness
that evaluates immutable recorded evidence through named, versioned
evaluators without changing canonical execution evidence or conflating
assertions, metrics and quality verdicts.

### Primary Deliverable

A public `@acme/evaluation` contract and pure harness, backed by an append-only
in-memory `QualityEvaluationStore`, with ScenarioRunner v2 support for running
deterministic evaluators, replaying exact recorded-external assessments and
separately asserting their verdicts.

### In Scope

- An ADR fixing the post-execution boundary, terminology, identity, retention,
  replay, storage and ScenarioRunner compatibility semantics.
- `@acme/evaluation` contracts for immutable evaluation subjects, artifact and
  contract bindings, evaluator identity/kind, bounded scores, structured
  findings, quality verdicts and append-only evaluation records.
- Deterministic content-derived subject, evaluation and result identities over
  canonical JSON and SHA-256.
- A static evaluator registry and a harness that validates, detaches and
  freezes input/output, runs one or more exact evaluator id/version pairs and
  records results through an injected store.
- Two evaluator kinds: pure deterministic evaluation and replay of a recorded
  external assessment that must match the complete subject and evaluator
  identity before yielding its recorded result.
- An append-only in-memory quality-evaluation adapter and reusable store
  conformance coverage, including idempotent identical writes and refusal of
  divergent identity reuse.
- `acme-scenario/2` as an additive runner document version with distinct
  `evaluate` and `assertEvaluation` steps. Evaluation execution success is not
  the same as a passing quality verdict; only an explicit assertion may fail a
  scenario because of that verdict.
- Offline fixtures proving both evaluator kinds over real recorded execution
  evidence with no network, clock or random identity source.
- Catalog discovery compatibility for scenario-v2 evaluation fixture
  references and governing status, system, structure, design and journal docs.

### Out of Scope

- Changing or implementing core's pre-commit `EvaluationDecision`,
  `PreparedEvaluatorRun` or `allow | block | revise` execution-gate semantics.
- Letting a quality evaluator block, revise, retry or mutate an execution,
  artifact, state, memory, fixture or baseline.
- A general AI judge, prompt/model evaluator, live evaluator call, provider
  adapter, credentials, network access or paid verification.
- Universal score aggregation, implicit weighting, automatic composite grades
  or UI-authored quality meaning.
- Changing S8 rate metrics or treating a metric threshold as an evaluator.
- Durable SQLite quality-evaluation storage, database migrations, UI surfaces,
  remote hosting, deployment or package publication.
- Driver-error classification; its existing backlog proposal remains
  independent adapter work and does not block this task.
- Multi-step live ScenarioRunner execution.

### Definition of Done

- Public contracts distinguish deterministic and recorded-external evaluators
  from core pre-commit gates and distinguish harness failure from
  `pass | fail | inconclusive` quality verdicts.
- Every stored record binds an exact run, execution result, optional committed
  operation digest, artifact id/kind/digest, contract id/version/fingerprint,
  evaluator id/version/kind and result digest.
- Scores are finite, explicitly scaled and range-valid; findings are
  structured; no harness-level composite or inferred verdict exists.
- Evaluators receive detached deeply frozen evidence. Mutation attempts cannot
  change caller evidence or persisted execution evidence.
- Recorded-external replay refuses any subject, contract, artifact, evaluator,
  version or result-digest mismatch and has no callable live transport.
- Store writes are append-only and idempotent for identical records; divergent
  reuse of an evaluation identity is refused and returned records are detached.
- Scenario v1 remains compatible. Scenario v2 can evaluate an execution-bound,
  digest-pinned evidence fixture and can separately assert a verdict; a
  successfully recorded `fail` verdict does not itself fail the scenario.
- Deterministic offline tests run the same subject twice to byte-identical
  records and replay a recorded-external fixture without network, clock or
  random IDs.
- Package boundaries, existing execution/replay behavior, both reference
  domains and every repository verification gate remain green.
- Long-lived docs describe the established quality foundation and keep
  driver-error classification as a separate, non-blocking adapter backlog item.

### Minimum Verification Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm boundaries`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:scenario`
- [ ] `pnpm docs:check`
- [ ] `pnpm build`
- [ ] `git diff --check`

## References

- `packages/core/src/evaluation.ts`
- `packages/core/src/repository.ts`
- `packages/core/src/repository-digest.ts`
- `packages/testing/src/scenario.ts`
- `apps/test-ui/src/read-model/measurement.ts`
- [`docs/backlog/driver-error-classification.md`](backlog/driver-error-classification.md)

## Checklist

- [x] Read governing docs, relevant ADRs and the driver-error backlog.
- [x] Classify driver-error work as independent and freeze ACME-0054.
- [x] Record the post-execution quality-evaluation ADR.
- [x] Implement public contracts, validation, identities, registry and harness.
- [x] Implement the append-only in-memory store and conformance kit.
- [x] Add ScenarioRunner v2 evaluation and explicit verdict assertion steps.
- [x] Add deterministic and recorded-external offline fixtures and tests.
- [x] Update scenario catalog discovery for v2 fixture references.
- [ ] Run every verification gate and record exact results.
- [ ] Update long-lived documentation.
- [ ] Add a signed journal entry, archive the task and restore the template.

## Decisions and Notes

- The user explicitly approved ACME-0054 on 2026-08-05 after reviewing the
  proposed separation from pre-commit evaluation gates.
- The driver-error backlog is correctly provider/driver-neutral at the core
  boundary: concrete SQLite codes are translated inside the adapter into the
  existing generic ACME taxonomy. It is useful but independent operational
  hardening, not part of the quality foundation.
- `@acme/evaluation` is a sibling domain-neutral package depending only on
  public `@acme/core`; it is not folded into ExecutionEngine or the test UI.
- Durable evaluation storage is deliberately deferred. The port, conformance
  contract and in-memory adapter establish semantics without coupling this
  task to a database migration.
- Implementation checkpoint: the new package, static registry, pure harness,
  immutable identity validation, recorded-external replay, in-memory adapter,
  conformance kit and ScenarioRunner v2 steps are implemented. Six focused
  files pass 53 tests and the new package boundary fixture passes.
- Baseline note: a pre-existing stage:ad user edit in
  `tests/live/openai-responses.test.ts` assigns to `const OPT_IN`; full
  typecheck/lint cannot pass while that unrelated edit remains. ACME-0054 does
  not alter or unstage it.
- A checkpoint after each step or substep is required. Checklist is updated as
  work progresses and `CURRENT_STATUS.md` changes with implemented behavior.

## Charter Amendment Log

- none

## Verification

- [ ] Unit tests cover schemas, identity goldens, immutability, registry,
      deterministic evaluation and every recorded-external mismatch.
- [ ] Store conformance covers append-only idempotency, collision refusal,
      filtering/order and detached reads.
- [ ] Scenario tests cover v1 compatibility, v2 parse/refusal, failed quality
      as a successful evaluate step and explicit verdict assertion failure.
- [ ] A real offline execution feeds both evaluator kinds with byte-identical
      stored results and no external effect.
- [ ] Full baseline gates pass; any skipped check is recorded with reason.

## Documentation Updates

- [ ] `AGENTS.md`
- [ ] `README.md`
- [ ] `docs/PROJECT_BRIEF.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] `docs/design/acme-design-and-development-spec.md`
- [ ] `docs/adr/README.md`
- [ ] New ADR
- [ ] `docs/backlog/driver-error-classification.md` only if clarification is
      required — no semantic change expected

## Handoff and Follow-ups

- Current state: implementation and focused verification complete; full gates
  and documentation remain.
- Next recommended step: run all gates that are not blocked by the unrelated
  staged live-test edit, then update long-lived documentation.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none that block the bounded charter.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0054_quality-evaluation-harness.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
