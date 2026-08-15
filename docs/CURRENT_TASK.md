# Current Task

Task ID: ACME-0101
Parent Task: None
Status: In Progress — implementation complete, canonical execution verification blocked
Owner: Felix (approval), ChatGPT (implementation)
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `tests/seam/aal-acme-adapter-2.ts`
- `tests/seam/seam-translation.ts`
- `tests/seam/seam-execution.test.ts`
- `tests/seam/aal-acme-adapter-3.ts`
- `tests/seam/seam-v3-translation.ts`
- `tests/seam/seam-v3-execution.test.ts`

## Task Summary

Prove the frozen ACME Arbetsyta `aal-acme-adapter/3` contract against the real current `ExecutionEngine` without changing `packages/core`, weakening Evidence gates or coupling the repositories. The product side is already contract-ready and pinned to engine commit `f21855417b75988e5bdcfcb481e4f4729a5f5fba`; this task supplies the missing engine-side executable conformance proof.

This task does **not** activate Evidence Stage 9. It is a domain-neutral seam/conformance task using the existing deterministic neutral execution harness only.

## Task Charter

The charter is frozen. Goal, primary deliverable, scope and Definition of Done must not be expanded or weakened inside ACME-0101.

### Goal

Demonstrate that the frozen `aal-acme-adapter/3` request can be translated into and executed by the current real ACME `ExecutionEngine` with no out-of-band model, revision or policy supplements and with no loss of current terminal engine result fields.

### Primary Deliverable

An executable engine-side v3 seam conformance suite that vendors the application-owned v3 fixture, deep-compares its translation to the frozen expected `ExecutionRequest`, executes committed/replay/conflict/provider-failure cases through the real deterministic engine harness, and proves the v3 result preserves every current terminal result field.

### In Scope

- vendor the frozen v3 wire types/fixture needed for conformance without importing the application repository;
- translate v3 request data to the current `ExecutionRequest` using only fields present in the wire request;
- prove exact request translation against the frozen expected-engine-request fixture;
- execute committed and replay cases through the real `ExecutionEngine` harness;
- execute revision-conflict and provider-failure terminal cases;
- preserve committed execution ID, replay state, revision, document keys and event IDs;
- preserve failure code, message, stage, retryability, optional details and optional cause reference;
- prove application-only workspace/correlation/version/source/task-pin metadata is not silently substituted into engine-native fields;
- document the result in CURRENT_STATUS, SYSTEMDOC, JOURNAL and FILESTRUCTURE if structure changes.

### Out of Scope

- changes to `packages/core`;
- changes to the Evidence Integrity Workbench product behavior or Stage 9 gate;
- non-synthetic data;
- live provider/network calls or credentials;
- importing ACME Arbetsyta source as a dependency;
- building a production adapter host or runtime deployment;
- changing engine public execution contracts to make the fixture pass;
- merging this branch to `main` without explicit authorization.

### Definition of Done

- Frozen v3 fixture translates to the frozen expected current `ExecutionRequest` with no supplement object.
- A real deterministic engine execution commits and the v3 translation returns execution ID, `replayed: false`, revision, document keys and event IDs without loss.
- Repeating the same request replays with `replayed: true` and no second model invocation.
- A stale expected engine revision produces a conflict whose v3 result retains the engine error stage and diagnostics.
- A scripted provider failure retains the engine failure code/message/stage/retryability and any supplied details/cause reference.
- Application-only metadata remains outside `ExecutionRequest` rather than being repurposed.
- Existing v2 gap tests remain green and no v2 semantics are rewritten.
- Canonical repository verification for the changed scope passes, with any unavailable external gate explicitly recorded.
- Documentation is synchronized and the task is archived only after all required gates pass.

### Minimum Verification Gates

- [ ] New v3 translation/fixture tests pass in the repository runtime.
- [ ] New real-engine committed/replay/conflict/provider-failure tests pass in the repository runtime.
- [ ] Existing seam v2 tests pass unchanged in the repository runtime.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm format:check` passes.
- [ ] `pnpm boundaries` passes.
- [ ] Relevant/full `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm docs:check` passes.
- [ ] `git diff --check` equivalent is clean where available.

## References

- Application contract: `felixnissen/ACME-Arbetsyta` draft PR #1, branch `aal-0012-engine-convergence`.
- Application v3 pin: engine `f21855417b75988e5bdcfcb481e4f4729a5f5fba`.
- Existing engine v2 seam proof: `tests/seam/seam-translation.ts`, `tests/seam/seam-execution.test.ts`.
- Existing deterministic neutral harness: `tests/fixtures/neutral-execution.ts` and seam helpers.
- Engine draft PR: `felixnissen/acme-engine` PR #2.

## Checklist

- [x] Confirm ACME-0101 is the next unused task identifier.
- [x] Create governed feature branch `agent/b8-aal-v3-conformance` from current `main`.
- [x] Freeze this charter before implementation.
- [x] Vendor the frozen v3 contract/fixtures.
- [x] Implement lossless v3 translation with no supplement argument.
- [x] Add executable real-engine conformance tests for exact translation, commit, replay, conflict and provider failure.
- [x] Keep `packages/core` and the existing v2 seam implementation unchanged.
- [x] Open engine draft PR #2; do not merge without explicit authorization.
- [x] Run an auxiliary strict ESM structural TypeScript check of the v3 contract/translator/test shapes against the current public ExecutionRequest/ExecutionResult forms; it passed, but is not canonical repository verification.
- [ ] Run focused repository tests and repair failures without changing core contracts.
- [ ] Run canonical verification gates.
- [ ] Synchronize canonical status/system/journal/filestructure documentation after executable results exist.
- [ ] Archive ACME-0101 and restore the no-active-task template only when complete.

## Decisions and Notes

- Product-side CI is green with 72/72 tests; this engine task does not treat that as engine compatibility evidence.
- The v3 fixture uses the existing neutral deterministic model/input values so no provider call or credential is needed.
- V3 compatibility is an executable property of this exact engine checkpoint, not a TypeScript-shape assertion.
- No engine core change is permitted as a workaround. If the frozen fixture exposes a real core incompatibility, record it and stop rather than changing the charter.
- The fork contains `.github/workflows/ci.yml` with pull-request verification, but the GitHub Actions API reports zero workflow runs for the repository, including after draft PR #2 was opened. The connected integration also cannot read repository Actions-permission settings (`403 Resource not accessible by integration`). Therefore no GitHub Actions result is claimed.
- A separate strict ESM TypeScript stub check using the current public execution shapes passed for the new contract, translator and test source. This is useful syntax/shape evidence only; it is explicitly not a substitute for `pnpm typecheck`, Vitest, boundaries, build or docs checks in this repository.

## Charter Amendment Log

-none

## Verification

- Product-side AAL-0012: 72/72 tests, build, artifact validation, TypeScript and lint are green in `felixnissen/ACME-Arbetsyta` PR #1.
- Engine-side source implementation: present on `agent/b8-aal-v3-conformance`, draft PR #2, based directly on `f21855417b75988e5bdcfcb481e4f4729a5f5fba`.
- Auxiliary structural TypeScript check: passed; non-canonical.
- Canonical engine repository execution: **not run / not claimed** because this fork currently exposes no GitHub Actions runs and the active session cannot clone/execute the private repository through another authenticated runtime.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md` — defer final claim until executable result exists.
- [ ] `docs/SYSTEMDOC.md` — defer final claim until executable result exists.
- [ ] `docs/JOURNAL.md` — final result entry pending executable result.
- [ ] `docs/FILESTRUCTURE.md` — new seam files require synchronization before completion.
- [ ] ADRs only if a new long-lived engine decision is actually required; none identified so far.

## Handoff and Follow-ups

- Current state: implementation complete in draft PR #2; canonical execution verification is the remaining blocker.
- Next recommended step: run the repository's normal PR CI or equivalent authenticated local `pnpm` gates against `agent/b8-aal-v3-conformance`.
- Blockers: GitHub Actions has no runs in this fork and the connected integration cannot inspect/change Actions permissions; no alternative authenticated engine runtime is available in this session.
- Child tasks: none.
- Resume condition: a runtime can execute this private branch with Node 24 / pnpm 10.34.5, or GitHub Actions becomes active for the fork.
- Open questions: none; test failures, when executable, are evidence to classify rather than reasons to broaden scope.

## Finalize When Complete

- Archive this file under `docs/finished/ACME-0101_aal-v3-conformance.md`.
- Restore the no-active-task template in `docs/CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of rewriting it.
