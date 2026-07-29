# Current Task

Task ID: ACME-0008
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-07-29
Last updated: 2026-07-29
Charter frozen at: 2026-07-29
Archived: 2026-07-29

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/acme-design-and-development-spec.md`, sections 14–15 and 19
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `docs/adr/0004-deterministic-transition-identity.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `docs/finished/ACME-0007_pure-memory-engine.md`

## Task Summary

Continue Milestone 1 with the aggregate repository boundary and deterministic
in-memory Unit of Work. Complete the prepared-commit/idempotency contracts,
then prove atomic state, memory, document, event and execution behavior through
the same port intended for SQLite.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Implement one aggregate ExecutionRepository port and a deterministic in-memory
adapter that atomically promotes a validated prepared execution into canonical
state without partial effects.

### Primary Deliverable

A tested `@acme/adapter-memory` implementation of the complete aggregate
repository port, backed by an immutable copy-on-commit Unit of Work and a
reusable repository conformance suite.

### In Scope

- Add the core execution request, effective policy, terminal result and
  evaluation-evidence contracts required by the repository boundary.
- Define accepted/existing execution, attempt, model-call reservation/result,
  context read-set, prepared commit, committed projection and non-commit
  terminal contracts.
- Keep one aggregate `ExecutionRepository`; do not expose separately
  committable state, memory, document or event stores.
- Add explicit read-only in-memory inspection types for deterministic adapter
  tests without weakening the core port.
- Define immutable `acme-operation-digest-1` over the logical prepared commit,
  excluding its digest field and sorting logically unordered document,
  candidate, evaluator and event collections by stable identity.
- Verify a supplied operation digest before canonical commit.
- Add `CONFLICT_MEMORY_VERSION` for expected memory compare-and-swap conflicts;
  keep stale state at `CONFLICT_STATE_REVISION`.
- Implement idempotent execution acceptance by `(namespace, requestKey)` and
  request fingerprint.
- Implement immutable execution lookup, attempt append, model-call reserve,
  completion/failure, consistent context load and non-commit terminal marking.
- Implement atomic in-memory commit by validating and applying against a
  private staged copy, publishing it only after every check succeeds.
- Compare the state head to `expectedRevision` even when no state delta exists.
- Validate complete StateEngine snapshot/transition correlation, state hashes,
  revision increments, transition ID/operation-key uniqueness and execution
  scope.
- Apply MemoryEngine create/update mutations sequentially with memory ID,
  identity and `expectedRecordVersion` checks.
- Retain every memory candidate with its correlated prepared decision,
  including ignored and rejected candidates.
- Validate document content hashes; allocate document/event IDs only after the
  prepared commit and all compare-and-swap checks validate.
- Persist evaluator evidence, domain events and matching pending outbox rows in
  the same staged commit.
- Mark the execution committed with the terminal projection only when every
  canonical effect succeeds.
- Return the existing committed projection for an identical repeated prepared
  commit without new writes or ID allocation.
- Reject divergent repeated digests, transition identities/operation keys or
  other persisted identity collisions as `PERSISTENCE_CORRUPTION`.
- Provide deterministic state/memory/document reads and an immutable adapter
  snapshot for evidence inspection.
- Add `@acme/adapter-memory` workspace/project references and enforce adapter
  dependency direction.
- Add a reusable ExecutionRepository conformance kit under `@acme/testing` and
  activate the non-empty conformance gate for the in-memory adapter.
- Add ADR-0006 for aggregate in-memory Unit of Work and operation digest
  semantics; update the normative persistence contract.
- Update documentation to implemented reality.

### Out of Scope

- ExecutionEngine orchestration, retry scheduling, replay orchestration or
  ScenarioRunner behavior.
- Model gateway/mock behavior or live provider calls.
- SQLite package, schema migration implementation, WAL behavior or native
  dependencies.
- Durable crash recovery across processes or filesystem persistence.
- Outbox claiming, delivery, retries or consumer deduplication.
- Narrative or Research modules and acceptance scenarios.
- Evaluator execution; this task stores only already prepared evidence.
- Dynamic repository discovery, production database choice or deployment.
- Package publication, push, release or other remote mutation.

### Definition of Done

- Core exposes one usable aggregate repository contract with no concrete
  adapter dependency.
- `acme-operation-digest-1` has golden/stability/sensitivity tests and rejects
  a prepared commit whose supplied digest does not match its logical content.
- Same request key/fingerprint resolves to one execution; a changed fingerprint
  returns an explicit conflict without mutation.
- Attempts and model-call records are idempotent by their documented keys and
  divergent reuse cannot overwrite evidence.
- Context loading is deterministic and rejects a stale expected state
  revision before work proceeds.
- A successful commit atomically retains candidate/evaluator evidence and
  promotes documents, memory mutations, optional state, events/outbox and the
  terminal execution projection.
- Any validation, state CAS, memory CAS or identity failure leaves all
  canonical effects and the execution terminal projection unchanged.
- Identical commit retry returns the original committed projection with no new
  IDs/effects; divergent retry fails as persistence corruption.
- Two state-changing commits from the same state revision yield exactly one
  success; memory version conflicts use `CONFLICT_MEMORY_VERSION`.
- The adapter returns detached immutable records and cannot be mutated through
  caller-owned inputs or read results.
- Repository conformance tests cover acceptance, ledger/model-call
  idempotency, context reads, terminal marking, atomic commit, stale state,
  memory CAS, retry and divergence.
- Adapter-specific tests inspect complete candidate/evaluator/event/outbox
  evidence and copy-on-commit rollback.
- Frozen install, format, lint, typecheck, boundaries, unit, non-empty
  conformance, integration/scenario gates and build pass.
- The specification, ADR set, `CURRENT_STATUS`, `SYSTEMDOC`, `FILESTRUCTURE`
  and journal reflect implemented reality.

### Minimum Verification Gates

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance` with a non-empty repository suite
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm build`
- [x] Internal documentation links and balanced Markdown fences
- [x] `git diff --check`

## References

- `docs/design/acme-design-and-development-spec.md`, sections 14–15 and 19
- `docs/adr/0003-sqlite-revisioned-unit-of-work.md`
- `docs/adr/0004-deterministic-transition-identity.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `packages/core/src/execution-types.ts`
- `packages/core/src/state.ts`
- `packages/core/src/memory.ts`
- `packages/core/src/modules.ts`

## Checklist

- [x] Review and freeze the aggregate repository charter.
- [x] Add ADR-0006 and correct the normative repository/digest contracts.
- [x] Add core execution, evidence, repository and digest contracts.
- [x] Add `@acme/adapter-memory` and dependency/project boundaries.
- [x] Implement acceptance, ledger, model-call, read and terminal behavior.
- [x] Implement atomic prepared commit with state/memory CAS and idempotency.
- [x] Add immutable adapter evidence inspection.
- [x] Add reusable repository conformance and adapter-specific tests.
- [x] Run all minimum verification gates and record evidence.
- [x] Update long-lived documentation and add a signed journal entry.
- [x] Archive the completed task and restore the task template.

## Decisions and Notes

- The maintainer explicitly approved ACME-0008 after reviewing and merging
  ACME-0007 on 2026-07-29.
- The reviewed charter was frozen on 2026-07-29 before implementation began.
- The operation digest describes logical prepared content, not adapter-created
  document/event IDs.
- Document and event IDs are allocated only inside a fully validated staged
  commit. Identical committed retries resolve before allocation.
- Memory candidates and evaluator decisions are audit evidence even when they
  do not produce canonical memory records.
- The in-memory adapter proves transaction semantics but makes no durability
  claim across processes.
- ADR-0006 records the aggregate port, versioned operation digest,
  copy-on-commit atomicity and explicit memory-version conflict.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [x] Verify operation-digest golden vector, ordering stability and content
  sensitivity.
- [x] Verify request acceptance idempotency and fingerprint conflict.
- [x] Verify attempt/model-call idempotency and divergent-key protection.
- [x] Verify deterministic context load and stale-read rejection.
- [x] Verify successful all-effects commit and immutable inspection.
- [x] Verify memory candidate decisions and evaluator evidence are retained.
- [x] Verify state and memory compare-and-swap conflicts.
- [x] Verify transition and operation identity collision protection.
- [x] Verify identical commit retry and divergent retry behavior.
- [x] Verify copy-on-commit rollback leaves zero partial effects.
- [x] Verify caller inputs and returned records are detached and immutable.
- [x] Verify non-empty conformance suite and all repository gates.
- [x] Document skipped checks and exact reasons.

## Documentation Updates

- [x] `docs/design/acme-design-and-development-spec.md`
- [x] `docs/adr/0006-aggregate-in-memory-unit-of-work.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Complete and ready for archival.
- Next recommended step: Explicitly charter the deterministic model mock and
  its provider-neutral gateway conformance as the next bounded Milestone 1
  task.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0008_aggregate-in-memory-unit-of-work.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
