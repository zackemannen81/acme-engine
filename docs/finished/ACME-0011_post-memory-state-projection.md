# Current Task

Task ID: ACME-0011
Parent Task: None
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
- `docs/design/acme-design-and-development-spec.md`, sections 10, 12–14 and
  16
- `docs/design/narrative-module-build-and-test-plan.md`, state model and
  decision gates
- `docs/design/research-module-build-and-test-plan.md`, state model and
  decision gates
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `docs/adr/0006-aggregate-in-memory-unit-of-work.md`
- `packages/core/src/modules.ts`
- `packages/core/src/memory.ts`
- `packages/core/src/memory-engine.ts`
- `packages/core/src/state-engine.ts`

## Task Summary

Resolve the first reference-module implementation gate by defining and
implementing one domain-neutral, deterministic boundary between interpreted
module output, prepared memory decisions and the final typed state delta. The
boundary must keep domain projection policy in the task definition, exclude
ignored and rejected candidates from memory-derived state input and leave
validation/canonical persistence to the existing StateEngine and aggregate
Unit of Work.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make state projection occur after memory preparation through a typed,
domain-owned and replayable core boundary without moving domain semantics into
core.

### Primary Deliverable

An accepted architecture decision plus tested `@acme/core` contracts and a
pure projection-input builder that let every task convert its interpreted
state intent and applied prepared memory decisions into the final typed
`StateDelta`.

### In Scope

- Add an ADR fixing projection ownership, sequence, filtering, typing,
  immutability and replay semantics.
- Replace the ambiguous pre-memory `ModuleResult.stateDelta` contract with an
  explicitly non-canonical typed state intent.
- Add a required pure `TaskDefinition.projectState()` hook that receives the
  interpreted state intent plus only memory decisions that produced accepted
  effects.
- Define a typed projection decision shape that retains the correlated memory
  candidate, identity, accepted resolution and affected memory IDs.
- Add a pure core builder that verifies exact candidate/decision
  correspondence, rejects duplicate or foreign keys, filters `ignore` and
  `reject-candidate`, preserves deterministic prepared order and returns
  detached deeply frozen projection input.
- Keep direct state intent available for state changes independent of memory
  acceptance while documenting that memory-derived state may use only the
  filtered projection decisions.
- Preserve task-name, input and contract-output inference and add compile-time
  proof for the projection hook.
- Add unit tests for accepted actions, ignore/reject filtering, exact
  correspondence, stable ordering, immutability, deterministic replay input
  and a domain-neutral projection fixture.
- Correct the normative design sequence and both reference-module build guides
  to use the post-memory projection boundary.
- Remove the completed backlog proposal and update long-lived documentation.

### Out of Scope

- `ExecutionEngine`, evaluator orchestration, retries, repair, revision,
  cancellation, replay/resume behavior or budget enforcement.
- NarrativeModule or ResearchModule schemas, policies, reducers, contracts or
  scenario fixtures.
- The separate identity/provenance and reusable DomainModule-conformance
  backlog proposals.
- Changes to MemoryEngine resolution semantics, StateEngine reduction
  semantics, repository commit/digest semantics or persisted schemas.
- SQLite, live model providers, ScenarioRunner, CLI behavior or deployment.
- Package publication, push, release or other remote mutation.

### Definition of Done

- The normative sequence is interpretation, evaluation, memory preparation,
  domain state projection, StateEngine preparation and one atomic commit.
- `ModuleResult` no longer presents a pre-memory value as the final state
  delta.
- Every task exposes one typed pure projection hook, and existing task
  inference remains intact.
- Projection input contains the interpreted state intent and only accepted
  prepared memory decisions correlated to their original candidates.
- `ignore` and `reject-candidate` decisions are absent from memory-derived
  projection input; create, reinforce, merge, contest and supersede remain
  available.
- Missing, duplicate or foreign candidate/decision keys fail before domain
  projection.
- Equivalent inputs produce byte-equivalent canonical projection input; all
  returned values are detached and deeply frozen.
- The final hook result remains non-canonical until StateEngine schema,
  reducer and invariant validation succeeds and the repository commits it.
- ADR, specification, build guides, status, system documentation, file
  structure and journal agree with implemented reality.
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
- [x] Internal documentation links and balanced Markdown fences
- [x] `git diff --check`

## References

- `docs/design/acme-design-and-development-spec.md`
- `docs/design/narrative-module-build-and-test-plan.md`
- `docs/design/research-module-build-and-test-plan.md`
- `docs/adr/0002-static-task-typed-module-composition.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `docs/adr/0006-aggregate-in-memory-unit-of-work.md`
- `packages/core/src/modules.ts`
- `packages/core/src/memory.ts`
- `packages/core/src/memory-engine.ts`
- `packages/core/src/state-engine.ts`
- `packages/core/test-d/task-inference.test-d.ts`

## Checklist

- [x] Read the repository workflow and required project context.
- [x] Classify the first backlog decision gate and activate ACME-0011.
- [x] Freeze the explicitly approved charter before implementation.
- [x] Add the projection ADR and correct the normative architecture sequence.
- [x] Implement typed projection contracts and the pure input builder.
- [x] Add compile-time and runtime projection verification.
- [x] Update both reference-module guides and long-lived documentation.
- [x] Run every minimum verification gate and record exact evidence.
- [x] Add a signed completion journal, archive the task and restore the task
  template.

## Decisions and Notes

- The maintainer explicitly requested that Codex set up and execute the next
  repository task on 2026-07-30.
- ACME-0011 activates the first listed reference-module decision gate because
  it blocks reducer implementation and the reusable module-conformance
  proposal depends on its resolution.
- The charter moved through `Draft` and `Ready` to `In Progress` on
  2026-07-30 without semantic changes.
- State intent is a typed interpreted input to projection, not canonical
  state and not the final delta.
- Domain projection is task-owned. Core owns only candidate/decision
  correlation, rejection filtering, deterministic ordering and immutable
  transport.
- Checkpoint: strict typecheck and the complete 91-test unit suite passed after
  the projection contracts, builder and StateEngine handoff tests were added.
- Checkpoint: ADR-0008, the normative execution sequence and both
  reference-module guides now agree on the post-memory projection boundary.
- Checkpoint: every minimum verification gate passed before completion; no
  required check was skipped.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [x] Verify every accepted memory resolution reaches projection input.
- [x] Verify ignore and reject-candidate resolutions never reach projection
  input.
- [x] Verify duplicate, missing and foreign candidate/decision keys fail.
- [x] Verify deterministic prepared order, detached inputs and deep freezing.
- [x] Verify a pure fixture produces the same delta and hash-relevant input on
  replay.
- [x] Verify task-name/input/output and projection typing at compile time.
- [x] Verify the final delta still passes through StateEngine validation.
- [x] Verify all existing repository and gateway conformance gates remain
  green.
- [x] Document skipped checks and exact reasons.

Exact evidence on 2026-07-30:

- `pnpm install --frozen-lockfile` passed with pnpm `10.34.5`; the lockfile was
  already current.
- Format, lint, strict typecheck, dependency boundaries and forced build
  passed.
- Unit execution passed 13 files and 91 tests, including six new state
  projection cases.
- Dedicated conformance passed 2 files and 10 tests: five repository and five
  gateway cases.
- Integration and scenario gates passed with no files, as expected because
  ExecutionEngine and reference-domain scenarios remain outside this charter.
- Documentation checks covered 41 Markdown files after archival;
  `git diff --check` passed.
- No required check was skipped. Remote CI was not run because no push was
  authorized.

## Documentation Updates

- [x] `docs/design/acme-design-and-development-spec.md`
- [x] `docs/design/narrative-module-build-and-test-plan.md`
- [x] `docs/design/research-module-build-and-test-plan.md`
- [x] projection ADR
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Complete and archived.
- Next recommended step: Explicitly charter the reference-module
  identity/provenance decision, then separately activate reusable
  DomainModule conformance.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0011_post-memory-state-projection.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
