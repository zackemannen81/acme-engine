# Current Task

Task ID: ACME-0023
Parent Task: None
Status: Complete
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
- `docs/adr/0009-reference-domain-identity-and-provenance.md`
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/design/research-module-build-and-test-plan.md` phase 5
- `docs/finished/ACME-0022_research-module-observe-evidence.md`
- `tests/scenario/narrative-phase-5.test.ts` as the implemented precedent

## Task Summary

`@acme/module-research` implements build-plan phases 1–4 and passes the shared
DomainModule conformance suite, but it has never run through the real
ExecutionEngine. Narrative has an offline acceptance scenario; Research does
not. Until one exists, "two different domains use the same execution, memory
and state mechanisms" is proven at the module boundary only, not end to end.
This task builds the approved Research phase 5 acceptance scenario.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Prove the Research domain reaches deferred, verified and contested standing
through the same ExecutionEngine, repository and replay path as Narrative,
entirely offline.

### Primary Deliverable

One deterministic scenario test that executes the approved source A, B and C
sequence against the bounded ExecutionEngine and asserts committed effects,
stale-revision safety and offline replay for every execution.

### In Scope

Build-plan phase 5 only.

- Observe source A and prove the claim is retained as deferred, not verified.
- Observe independent source B and prove the claim is promoted to verified
  with an independent-source count of two.
- Observe source C with contradictory evidence and prove the claim becomes
  contested with every variant preserved.
- Inject a stale expected revision and prove no model call, no ID allocation
  and no repository write occur.
- Replay-verify every committed execution offline with matching operation
  digests, no gateway call, no clock read and no ID allocation.
- Pin the deterministic execution identity, request fingerprint, model request
  and response hashes, operation digest and state hash for the sequence.
- Documentation updates to `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`,
  `docs/FILESTRUCTURE.md` and `docs/JOURNAL.md`.

### Out of Scope

- Any change to `packages/core`, `@acme/module-research` runtime behavior, the
  shared conformance suite, ADR-0009 or ADR-0012 to make the scenario pass. A
  genuine defect found here pauses this task instead.
- Any change to the Narrative scenario.
- Network access, a live provider and URI dereferencing of any kind.
- ScenarioRunner, a general evaluation harness and CLI wiring. The scenario
  stays test-owned, exactly as Narrative's does.
- Running the scenario against the durable SQLite adapter; the Narrative
  precedent uses the in-memory adapter and durability is proven separately.

### Definition of Done

- One scenario test drives source A, B and C through `ExecutionEngine.execute`
  and reaches deferred, verified and contested standing in that order.
- The stale-revision execution resolves as `conflicted` with no gateway
  invocation, no ID allocation and unchanged repository evidence.
- Every committed execution replay-verifies as `match` with an unchanged
  operation digest and no external effect.
- Repeating a committed request returns the recorded result without a second
  model call.
- Identity, hash and digest goldens are pinned for the sequence.
- No `packages/core` or `@acme/module-research` source file changes.
- All frozen verification gates pass, or every skipped check is recorded with
  its reason.
- The task is archived under `docs/finished/` and `docs/CURRENT_TASK.md` is
  restored or repopulated.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm build`
- [x] `git diff --check`

## References

- `docs/design/research-module-build-and-test-plan.md`
- `tests/scenario/narrative-phase-5.test.ts`
- `packages/module-research/test/fixtures.ts`
- `packages/core/src/execution-engine.ts`
- `packages/adapter-model-mock/src/scripted-model-gateway.ts`

## Checklist

- [x] Read the required documents and the phase 5 plan in order.
- [x] Build the scenario harness that reproduces the engine read path so each
      scripted call can pin an exact request hash.
- [x] Step 1: source A commits a deferred claim.
- [x] Step 2: independent source B verifies the claim.
- [x] Step 3: contradictory source C contests the claim.
- [x] Step 4: a stale expected revision performs no model call or write.
- [x] Step 5: replay-verify every execution offline and pin the goldens.
- [x] Run every frozen verification gate and record evidence.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md` and add
      the signed journal entry.
- [x] Archive ACME-0023 and restore or repopulate `docs/CURRENT_TASK.md`.

## Decisions and Notes

- A checkpoint after each step is required. The checklist is updated along the
  work and `CURRENT_STATUS.md` is updated when changes affect behavior.
- The scenario is acceptance evidence, not a place to accommodate the
  implementation. If a step cannot pass without changing module or core
  behavior, that is a defect: pause this task and raise a bounded child task.
- Fixtures are hand-written and offline. No URI is dereferenced and no
  expected value is captured automatically.
- Harness decision, 2026-07-31: each step's contract input, and therefore its
  model request hash, depends on everything the earlier steps committed. The
  scenario reproduces the engine read path — `loadContext` then
  `MemoryEngine.retrieve` against the domain policy — to compute the exact
  hash before scripting the call. Keeping the model mock's exact-request-hash
  matching is the point; weakening it would remove the evidence.
- Observation, 2026-07-31: no core or module behavior needed changing, and no
  defect surfaced. The two expectation corrections during the work were both
  mine: memory IDs are allocated in sorted candidate-key order, and repository
  evidence is ordered by execution ID, which is a hash rather than the
  observation order.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- None.

## Verification

- [x] Prove the claim standing changes deferred → verified → contested.
- [x] Prove the stale-revision execution leaves no evidence behind.
- [x] Prove replay uses only recorded evidence.
- [x] Record exact test counts for every gate.
- [x] Confirm no core or module source file changed.
- [x] Document skipped checks and reasons.

Verification completed on 2026-07-31:

- `pnpm docs:check` passed for 57 Markdown files.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
- `pnpm boundaries` passed dependency, core-vocabulary and the
  core/module/cross-module/SQLite-driver forbidden fixtures.
- `pnpm test:unit` passed 243 tests in 33 files.
- `pnpm test:conformance` passed 41 tests in 6 files.
- `pnpm test:integration` passed 13 tests in 2 files.
- `pnpm test:scenario` passed 5 tests in 2 files: the Narrative scenario and
  the four new Research cases.
- `git diff --check` passed.
- `git status` confirms the only non-documentation change is the new
  `tests/scenario/research-phase-5.test.ts`; no `packages/` source file
  changed.
- Skipped checks: none.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADRs only if a long-lived decision changes; none is expected.

## Handoff and Follow-ups

- Current state: ACME-0023 is complete. Both reference domains now have
  executable end-to-end acceptance evidence through the same engine, so the
  First Proof Milestone's domain-neutrality claim is demonstrated rather than
  argued. Every frozen gate passed.
- Next recommended step: Activate only the next explicitly approved task.
  ScenarioRunner, a live provider adapter and a CLI composition root that
  selects the durable adapter are the remaining Milestone 1 candidates.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
