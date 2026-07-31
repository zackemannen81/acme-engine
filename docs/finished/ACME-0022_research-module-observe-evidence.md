# Current Task

Task ID: ACME-0022
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
- `docs/adr/0008-post-memory-domain-state-projection.md`
- `docs/adr/0009-reference-domain-identity-and-provenance.md`
- `docs/design/research-module-build-and-test-plan.md`
- `docs/finished/ACME-0017_narrative-module-observe-document.md`
- `packages/module-narrative/src/` as the implemented reference module
- `packages/testing/src/domain-module-conformance.ts`

## Task Summary

Core claims to be domain-neutral, but only one domain module proves it.
`docs/PROJECT_BRIEF.md` makes "two different domains use the same execution,
memory and state mechanisms" an explicit success test, and its First Proof
Milestone names `research.observe-evidence`. Every decision gate in
`docs/design/research-module-build-and-test-plan.md` is resolved, and the
shared `domainModuleConformance()` suite already exists. This task implements
the second reference domain through build-plan phases 1–4.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Implement `@acme/module-research` as a second reference domain that satisfies
the same public module contract as `@acme/module-narrative` using only public
core contracts.

### Primary Deliverable

A `packages/module-research` package implementing
`research.observe-evidence@1.0.0` with strict schemas, ADR-0009 identity and
independence policy, deterministic projection and interpretation, a pure
post-memory state projection, a pure reducer with invariants, and a
domain-owned memory policy that passes the unchanged shared DomainModule
conformance suite.

### In Scope

Build-plan phases 1 through 4 only.

- Phase 1: workspace package, project references, module-to-core-only boundary
  coverage, and strict evidence-input, contract-input, contract-output, source,
  claim, question, state and delta schemas.
- Phase 2: `research-source-key-1`, `research-source-independence-key-1` and
  `research-proposition-key-1` with their ADR-0009 golden vectors; deferred,
  corroborated and contested resolution; initial state, pure reducer and
  invariants; retrieval and explicit lifecycle behavior.
- Phase 3: the immutable `research.observe-evidence@1.0.0` prompt contract with
  a golden request hash, input-bound semantic validation, deterministic
  evidence/context projection, interpretation into one source document plus
  claim/question candidates and state intent, and pure `projectState()` over
  applied memory decisions only.
- Phase 4: module assembly with `defineTask()`/`defineModule()`, compile-time
  task-inference checks, execution of the unchanged shared conformance suite
  with Research-owned fixtures, and detached immutable results.
- Explicit source A/B/C fixtures plus invalid cases, written by hand with no
  network access and no automatic capture.
- Documentation updates to `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`,
  `docs/FILESTRUCTURE.md` and `docs/JOURNAL.md`.

### Out of Scope

- Build-plan phase 5, the offline Research acceptance scenario through the
  ExecutionEngine, and its ledger/replay fixtures.
- Any change to `packages/core`, the shared conformance suite, ADR-0008 or
  ADR-0009 to accommodate Research.
- Any change to `@acme/module-narrative` behavior.
- Network access, URI dereferencing and source retrieval of any kind.
- ScenarioRunner, CLI wiring, outbox delivery and a live provider adapter.
- A reviewed Research event schema; the baseline fixes no events.

### Definition of Done

- `@acme/module-research` passes the unchanged `domainModuleConformance()`
  suite with Research-owned fixtures.
- The three ADR-0009 Research identity algorithms reproduce their published
  golden vectors exactly.
- Resolution proves all six documented behaviors: first-source defer,
  same-independence-key duplicate, independent reinforce, threshold verify,
  contradiction contest and ignore.
- The reducer and invariants reject dual status, duplicate identities,
  verified claims below threshold or without memory evidence, non-positive
  source counts, contested claims with fewer than two variants and empty
  fields.
- Interpretation never dereferences a URI, never infers independence and never
  reads wall-clock time or randomness.
- Boundary checks prove the module imports no app, concrete adapter, provider
  SDK, database library or `@acme/testing` from its source.
- The core forbidden-vocabulary guard stays green.
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
- `docs/adr/0008-post-memory-domain-state-projection.md`
- `docs/adr/0009-reference-domain-identity-and-provenance.md`
- `packages/module-narrative/src/`
- `packages/testing/src/domain-module-conformance.ts`
- `tests/conformance/module-narrative.test.ts`

## Checklist

- [x] Read the required repository documents and the build plan in order.
- [x] Phase 1: scaffold `packages/module-research` with workspace, project
      reference, build and lint wiring.
- [x] Phase 1: implement strict schemas and the invalid-case matrix.
- [x] Phase 1: add hand-written source A/B/C fixtures.
- [x] Phase 2: implement the three identity algorithms against ADR-0009 golden
      vectors.
- [x] Phase 2: implement the memory policy resolution matrix.
- [x] Phase 2: implement initial state, pure reducer and invariants.
- [x] Phase 2: implement retrieval ranking and explicit lifecycle behavior.
- [x] Phase 3: implement the prompt contract and golden request hash.
- [x] Phase 3: implement input-bound semantic validation.
- [x] Phase 3: implement deterministic projection and interpretation.
- [x] Phase 3: implement pure `projectState()` over applied decisions only.
- [x] Phase 4: assemble the module and add compile-time inference checks.
- [x] Phase 4: run the unchanged shared conformance suite.
- [x] Extend boundary coverage for the new module package.
- [x] Run every frozen verification gate and record evidence.
- [x] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `FILESTRUCTURE.md` and add
      the signed journal entry.
- [x] Archive ACME-0022 and restore or repopulate `docs/CURRENT_TASK.md`.

## Decisions and Notes

- A checkpoint after each phase is required. The checklist is updated along
  the work and `CURRENT_STATUS.md` is updated when changes affect behavior.
- ADR-0008 and ADR-0009 are already accepted and are implemented here, not
  reopened. A discovery that contradicts either one pauses this task rather
  than amending the ADR inside it.
- `@acme/module-narrative` is the structural reference. Where Research and
  Narrative could diverge in module-contract behavior, the unchanged shared
  conformance suite is authoritative.
- Phase 5 is deliberately excluded so this task keeps one primary outcome and
  one coherent verification story, matching how ACME-0017 scoped Narrative.
- The verification threshold and identity-policy version are explicit
  immutable configuration facts, never model-supplied.
- Design decision, 2026-07-31: supporting and contradicting evidence share one
  proposition memory identity, so a contradiction contests the existing claim
  rather than creating a rival record. The displaced wording survives as a
  state variant. Where two opposed positions share one wording, the position
  qualifies the variant so the contest stays legible.
- Design decision, 2026-07-31: claim verification is derived post-memory in
  `projectState()` from applied decisions plus prior records. Interpretation
  emits no claim decision at all, so model output cannot promote a claim.
- Discovery, 2026-07-31: the existing module boundary rule forbade
  module-to-adapter and module-to-app dependencies but not module-to-module.
  Phase 1's frozen "module-to-core-only boundary coverage" required closing it,
  so the rule and its negative fixture were added under the existing charter
  rather than as a new deliverable.
- Deviation, 2026-07-31: fixtures live in `packages/module-research/test/`
  rather than the build plan's proposed `fixtures/` directory. The plan calls
  that structure "proposed"; ACME-0017 already set the `test/fixtures.ts`
  precedent, which the vitest and tsconfig wiring expects.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- None.

## Verification

- [x] Prove the shared conformance suite file is unchanged.
- [x] Prove the three ADR-0009 golden vectors byte-for-byte.
- [x] Prove the resolution matrix and reducer invariants with explicit tests.
- [x] Prove the module performs no network, clock or randomness access.
- [x] Record exact test counts for every gate.
- [x] Document skipped checks and reasons.

Verification completed on 2026-07-31:

- `pnpm docs:check` passed for 56 Markdown files.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
- `pnpm boundaries` passed dependency, core-vocabulary and the
  core/module/cross-module/SQLite-driver forbidden fixtures.
- `pnpm test:unit` passed 239 tests in 32 files.
- `pnpm test:conformance` passed 41 tests in 6 files, including the six
  unchanged `domainModuleConformance()` cases run against Research fixtures.
- `pnpm test:integration` passed 13 tests in 2 files.
- `pnpm test:scenario` passed the one Narrative Phase 5 scenario.
- `git diff --check` passed.
- `packages/testing/src/domain-module-conformance.ts` is untouched by this
  change; both modules run the identical file.
- Purity is proven structurally: the module imports only `@acme/core` and
  `zod`, the boundary fixtures fail on any module-to-adapter or
  module-to-module edge, and every test supplies its own `now` rather than
  reading a clock.
- Skipped checks: none.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADRs only if a long-lived decision changes; none is expected.

## Handoff and Follow-ups

- Current state: ACME-0022 is complete. `@acme/module-research` implements
  build-plan phases 1–4 and passes the unchanged shared conformance suite, so
  two independent domains now share the same core mechanics. Every frozen gate
  passed.
- Next recommended step: Activate only the next explicitly approved task. The
  Research offline acceptance scenario (build-plan phase 5) is the natural
  successor; ScenarioRunner, a live provider adapter and a CLI composition
  root remain the other Milestone 1 candidates.
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
