# Current Task

Task ID: ACME-0019
Parent Task: ACME-0018
Status: Ready
Owner: Claude
Created: 2026-07-31
Last updated: 2026-07-31
Charter frozen at: 2026-07-31

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/paused/ACME-0018_single-task-execution-engine.md`
- `docs/design/acme-design-and-development-spec.md`, sections 12, 14 and
  Milestone 1
- `docs/design/narrative-module-build-and-test-plan.md`, Phase 5
- `docs/adr/0004-deterministic-transition-identity.md`
- `docs/adr/0005-pure-memory-decision-application.md`
- `docs/adr/0006-aggregate-in-memory-unit-of-work.md`
- `packages/core/src/repository.ts`
- `packages/core/src/repository-digest.ts`
- `packages/core/src/memory-engine.ts`
- `packages/adapter-memory/src/repository.ts`

## Task Summary

A maintainer-requested review of the ACME-0018 Draft charter on 2026-07-31
found that its four pre-freeze decisions — request/policy identity,
deterministic memory retrieval, replay evidence/digest and the staged public
engine surface — are named but not resolved inside the charter. Freezing
ACME-0018 in that state would either freeze a charter whose Primary Deliverable
is still unknown, or force a later supersede when the planned ADR discovers the
answers.

This bounded child task resolves those decisions inside the parent's `Draft`
charter so the parent can be frozen honestly. It changes documentation only and
implements no ExecutionEngine behavior.

The task exists as its own Task ID rather than as an in-place Draft edit so the
repository history records why the parent charter changed, not only that it
changed.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make the ACME-0018 Draft charter freezable by resolving its four named
pre-freeze decisions into explicit, reviewable charter text.

### Primary Deliverable

A hardened ACME-0018 `Draft` charter in which request/policy identity,
deterministic memory retrieval, replay evidence/digest and the bounded
Milestone 1 engine surface are stated as decisions rather than open questions.

### In Scope

- Resolve the reviewed pre-freeze findings inside
  `docs/paused/ACME-0018_single-task-execution-engine.md`:
  1. state that the planned ADR records decisions already approved in the
     `Draft` instead of discovering them after the freeze;
  2. fix `ModelSelection` participation in the request fingerprint and separate
     identity-determining content from operational budget;
  3. require effective-policy validation to reject non-zero repair and revision
     budgets for the Milestone 1 path;
  4. fix the exact recorded retrieval evidence needed to replay a projection
     independently of later memory drift;
  5. fix a constant, versioned memory-retrieval limit and its participation in
     the request fingerprint;
  6. fix one compared replay digest and require replay under recorded execution
     identity, recorded clock and a forbidden `IdGenerator`;
  7. require a retention case that makes the `unavailable` replay branch
     reachable and tested;
  8. fix the shape of the replay-evidence repository read and the condition
     under which it must be split into a separate task;
  9. fix the `ExecutionResult.replayed` semantics for an idempotent repeat;
  10. correct the unsatisfiable pre-implementation golden-digest verification
      item;
  11. decide whether `execute()` exposes `AbortSignal` in the Milestone 1
      surface, and require matching coverage if it does.
- Record every resolved decision in the parent's `Decisions and Notes` with
  enough reasoning that a new contributor can review it without chat history.
- Keep every proposed value that is a maintainer judgment call, rather than a
  correctness requirement, explicitly marked for confirmation before freeze.
- Restore the hardened parent to `docs/CURRENT_TASK.md` as `Draft` and record
  the completed child, per `docs/TASK_WORKFLOW.md`.
- Add a dated, signed journal entry and update `docs/CURRENT_STATUS.md`.

### Out of Scope

- Freezing ACME-0018 or setting it to `Ready`. That remains a maintainer act.
- Writing or accepting the execution identity/replay ADR. It stays inside the
  parent's scope.
- Any change to the parent's Goal, Primary Deliverable or Definition of Done
  that alters what the parent delivers. The parent is `Draft`, so its charter is
  editable, but this task sharpens it and must not redirect it.
- Any ExecutionEngine, repository, adapter, module or test source change.
- Any change to `acme-operation-digest-1`, `acme-model-request-hash-1`,
  `acme-transition-id-1` or `acme-cjson-1`.
- The normative specification correction, which ACME-0018 performs together
  with its ADR.
- ResearchModule, durable persistence, Domain Test UI or any other backlog item.

### Definition of Done

- All eleven reviewed findings are resolved in the parent charter, each as
  explicit charter text rather than an open question.
- The parent's `Open Questions` no longer contains a question whose answer would
  change its Primary Deliverable or Definition of Done.
- Every maintainer judgment call introduced by this task is visibly marked as
  requiring confirmation before freeze.
- The parent's Goal, Primary Deliverable and Definition of Done still describe
  the same Milestone 1 ExecutionEngine outcome as before this task.
- No source file, package manifest, ADR or normative specification section is
  modified.
- `docs/CURRENT_TASK.md` holds the hardened ACME-0018 as `Draft`,
  `docs/paused/` holds no ACME-0018 file, and this task is archived under
  `docs/finished/`.
- `docs/JOURNAL.md` and `docs/CURRENT_STATUS.md` reflect the real state.

### Minimum Verification Gates

- [ ] `pnpm docs:check`
- [ ] `git diff --check`
- [ ] Balanced Markdown fences in every changed file
- [ ] Confirm no file outside `docs/` is modified
- [ ] Confirm the parent's Goal, Primary Deliverable and Definition of Done are
      unchanged in outcome

## References

- `docs/paused/ACME-0018_single-task-execution-engine.md`
- `docs/design/acme-design-and-development-spec.md`, sections 12 and 14.1–14.6
- `packages/core/src/repository.ts`, `AcceptedExecution.requestFingerprint`
- `packages/core/src/repository-digest.ts`, `acme-operation-digest-1`
- `packages/core/src/memory-engine.ts`, `retrieve()`
- `packages/adapter-memory/src/repository.ts`, `accept()` and `loadContext()`

## Checklist

- [x] Read `AGENTS.md` and the required repository documents in order.
- [x] Confirm ACME-0019 is the next monotonically increasing task ID.
- [x] Pause ACME-0018, record its blocker, child and resume condition, and move
      it unchanged in scope to `docs/paused/`.
- [x] Activate this bounded child charter in `docs/CURRENT_TASK.md`.
- [ ] Resolve findings 1–3: ADR role, fingerprint content, effective-policy
      validation.
- [ ] Resolve findings 4–5: retrieval evidence and the constant retrieval limit.
- [ ] Resolve findings 6–8: digest comparison, replay execution mode, the
      `unavailable` branch and the replay-evidence read shape.
- [ ] Resolve findings 9–11: `replayed` semantics, the golden-digest
      verification item and the `AbortSignal` decision.
- [ ] Record the reasoning in the parent's `Decisions and Notes` and mark
      maintainer judgment calls.
- [ ] Run every frozen verification gate and record exact evidence.
- [ ] Restore the hardened parent to `docs/CURRENT_TASK.md` as `Draft`.
- [ ] Update `docs/CURRENT_STATUS.md` and add a signed journal entry.
- [ ] Archive this task under `docs/finished/`.

## Decisions and Notes

- A checkpoint after each step or substep is required. The checklist is
  therefore updated along the work and `CURRENT_STATUS.md` is always updated
  when changes affect behavior.
- The maintainer reviewed the four pre-freeze decisions on 2026-07-31, accepted
  the reasoning and explicitly requested that the resulting charter changes be
  performed as their own task for traceability.
- `docs/TASK_WORKFLOW.md` describes pause/resume for a frozen `In Progress`
  parent. ACME-0018 is `Draft`, so it is paused as `Draft` and resumes as
  `Draft` rather than `In Progress`. This deviation is recorded rather than
  silently applied.
- The parent charter is editable because it is `Draft`. This task therefore
  sharpens it in place instead of using the `Charter Amendment Log`, which
  governs post-`Ready` corrections only.
- Findings that propose a specific value rather than a correctness requirement
  — the retrieval limit and the `AbortSignal` decision — are maintainer calls.
  This task writes a recommendation and marks it for confirmation; it does not
  claim approval the maintainer has not given.
- This task must not become a container for the ADR itself. If resolving a
  finding requires a durable architecture decision beyond recording it in the
  charter, that belongs to ACME-0018 and its ADR.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- None.

## Verification

- [ ] `pnpm docs:check` passes for all Markdown files.
- [ ] `git diff --check` passes.
- [ ] `git status` shows changes only under `docs/`.
- [ ] Each of the eleven findings is traceable to explicit parent charter text.
- [ ] The parent's Goal, Primary Deliverable and Definition of Done are
      compared before and after and describe the same outcome.
- [ ] Document skipped checks and reasons. No runtime gate applies because this
      task adds no source file.

## Documentation Updates

- [ ] `docs/CURRENT_TASK.md` (restored hardened ACME-0018 `Draft`)
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADRs when long-lived decisions change — not expected for this task

## Handoff and Follow-ups

- Current state: Charter frozen at `Ready`; hardening not yet applied.
- Next recommended step: Apply findings 1–11 to the paused parent charter.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions:
  - Does the maintainer accept the recommended constant memory-retrieval limit,
    or should ACME-0018 carry a different value into its ADR?
  - Should `execute()` expose `AbortSignal` in the Milestone 1 surface at all?

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0019_acme-0018-charter-hardening.md`.
- Restore the hardened ACME-0018 to `docs/CURRENT_TASK.md` as `Draft`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
