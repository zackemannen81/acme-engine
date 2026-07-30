# Current Task

Task ID: ACME-0013
Parent Task: ACME-0012
Status: Complete
Owner: Codex
Created: 2026-07-30
Last updated: 2026-07-30
Charter frozen at: 2026-07-30
Archived: 2026-07-30

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/paused/ACME-0012_reference-domain-identity-and-provenance.md`
- `docs/design/acme-design-and-development-spec.md`, sections 8–10, 13 and
  16–17
- `docs/adr/0002-static-task-typed-module-composition.md`
- `packages/core/src/contracts.ts`
- `packages/core/src/modules.ts`
- `packages/core/src/response-pipeline.ts`
- `packages/core/test/response-pipeline.test.ts`
- `packages/core/test-d/task-inference.test-d.ts`

## Task Summary

Unblock ACME-0012 by binding validated contract input to semantic response
validation and validated task input to domain interpretation. Reference
modules must be able to compare output evidence with the exact supplied
document and construct source-backed candidate artifacts without closures,
mutable task instances or hidden engine state.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make prompt semantic validation and task interpretation explicit pure
functions of their validated input so document-bound evidence is
deterministic, auditable and replayable.

### Primary Deliverable

Accepted public core contracts and tested implementations that pass immutable
validated contract input to `validateSemantics()` through `ResponsePipeline`
and immutable validated task input to `TaskDefinition.interpret()`, preserving
task inference and all existing trust-boundary behavior.

### In Scope

- Add an ADR fixing input ownership, validation order, immutability and replay
  semantics for response validation and task interpretation.
- Change `PromptContract.validateSemantics()` to receive its typed contract
  input together with validated output.
- Change `ResponsePipeline.process()` to require contract input, validate it
  through the contract input schema before response parsing and expose a
  distinct non-repairable `input` failure stage.
- Pass detached deeply frozen validated input to semantic validation so
  contract code cannot mutate caller-owned values.
- Change `TaskDefinition.interpret()` to receive typed validated task input in
  addition to output and read context.
- Preserve task-name/input/output/projection compile-time inference.
- Update all existing core fixtures, tests and normative documentation.
- Add runtime tests for input rejection before response work, input-aware
  semantics, immutability and unchanged output trust stages.

### Out of Scope

- NarrativeModule, ResearchModule or any domain-specific schema, policy,
  reducer, contract or fixture.
- ACME-0012's identity/provenance decisions and golden vectors.
- ExecutionEngine orchestration or implementing invocation of
  `TaskDefinition.interpret()`; no engine exists yet.
- Changes to `project()`, `projectState()`, MemoryEngine, StateEngine,
  repository, model gateway or persistence.
- Async semantic validation; contract validation remains synchronous and pure.
- SQLite, live providers, ScenarioRunner, CLI behavior or deployment.
- Package publication, push, release or other remote mutation.

### Definition of Done

- `ResponsePipeline.process(response, contract, input)` rejects invalid
  contract input at stage `input` before inspecting response content.
- Semantic validation receives schema-validated, detached, deeply frozen
  contract input and output.
- Existing empty/parse/schema/semantic stages and cleanup/hash behavior remain
  unchanged for valid inputs.
- `TaskDefinition.interpret(output, input, context)` binds the original typed
  task input and preserves all inference helpers.
- Public specification, status, system documentation, file structure and
  journal agree with implemented reality.
- ACME-0012 can resume and define document-bound evidence without hidden
  state.
- All minimum verification gates pass.

### Minimum Verification Gates

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm build`
- [x] `pnpm docs:check`
- [x] `git diff --check`

## References

- `docs/paused/ACME-0012_reference-domain-identity-and-provenance.md`
- `docs/design/acme-design-and-development-spec.md`
- `docs/adr/0002-static-task-typed-module-composition.md`
- `packages/core/src/contracts.ts`
- `packages/core/src/modules.ts`
- `packages/core/src/response-pipeline.ts`
- `packages/core/test/response-pipeline.test.ts`
- `packages/core/test-d/task-inference.test-d.ts`

## Checklist

- [x] Record the blocking discovery and pause ACME-0012.
- [x] Activate and freeze the bounded ACME-0013 child charter.
- [x] Add the input-bound validation/interpretation ADR.
- [x] Implement input validation, immutable semantic arguments and the new
      public signatures.
- [x] Update compile-time fixtures and runtime tests.
- [x] Update normative and long-lived documentation.
- [x] Run every minimum verification gate and record exact evidence.
- [x] Add a signed completion journal and archive the child.
- [x] Restore ACME-0012, record the completed child and resume its original
      charter.

## Decisions and Notes

- The blocking condition was discovered while ACME-0012 attempted to make
  exact document-quote verification normative.
- Contract input is validated in ResponsePipeline even if a future engine
  validated it earlier. The pipeline is a public trust boundary and must not
  call domain semantics with an unchecked value.
- Task input validation remains an ExecutionEngine responsibility because no
  interpretation orchestrator exists in this child. The public signature
  carries the typed value; future engine conformance must prove it passes the
  schema-validated detached input.
- The charter moved through `Draft` to `Ready` on 2026-07-30 without semantic
  changes.
- Implementation began after the frozen charter entered `Ready`; status is
  now `In Progress`.
- Checkpoint: targeted typecheck and all ten response-pipeline tests passed
  after the public signatures, input stage and immutable semantic arguments
  were implemented.
- Checkpoint: every minimum verification gate passed; no required check was
  skipped.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [x] Verify invalid contract input fails before empty/parse/schema handling
      and before semantic validation.
- [x] Verify semantic validation can compare output with supplied input.
- [x] Verify semantic validation cannot mutate input/output or caller-owned
      nested values.
- [x] Verify valid-input output stages, cleanup warnings and parsed hash remain
      stable.
- [x] Verify compile-time task input/output/projection inference remains
      intact with the new interpretation signature.
- [x] Verify all repository/gateway conformance remains green.
- [x] Document skipped checks and exact reasons.

Exact evidence on 2026-07-30:

- Frozen install passed with pnpm `10.34.5`; the lockfile was already current.
- Format, lint, strict typecheck, dependency boundaries and forced build
  passed.
- Unit execution passed 13 files and 95 tests, including ten response-pipeline
  tests covering four new input-bound cases.
- Dedicated repository/gateway conformance passed 2 files and 10 tests.
- Integration and scenario gates passed with no files because orchestration
  and reference scenarios remain outside this child.
- Documentation checks covered 43 Markdown files; `git diff --check` passed.
- No required check was skipped. Remote CI was not run because no push was
  authorized.

## Documentation Updates

- [x] `docs/adr/0010-input-bound-validation-and-interpretation.md`
- [x] `docs/design/acme-design-and-development-spec.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Complete and ready to archive.
- Next recommended step: Restore ACME-0012 and finish its original frozen
  identity/provenance charter.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0013_input-bound-validation-and-interpretation.md`.
- Restore ACME-0012 from `docs/paused/`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
