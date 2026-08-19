# Current Task

Task ID: ACME-0149
Parent Task: None
Status: Complete
Owner: Felix fork integration
Created: 2026-08-17
Last updated: 2026-08-18
Charter frozen at: 2026-08-17

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant ADRs under `docs/adr/`

## Task Summary

Expose the current domain-neutral `ExecutionEngine` through a small authenticated,
Fetch-compatible AAL v3 runtime boundary without changing core semantics or choosing
a deployment/listener technology. The boundary exists so external application
layers can pin an engine revision, translate one frozen wire shape into the public
engine request, and preserve terminal engine results losslessly.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Provide a transport-neutral runtime host boundary for the current engine revision
that external AAL clients can compatibility-check and execute against without
importing ACME internals.

### Primary Deliverable

A Fetch-compatible runtime-host module under the existing `apps/cli` composition
root, plus focused tests for authentication, protocol/engine pinning, exact request
translation, bounded input handling and terminal-result preservation.

### In Scope

- Add a frozen AAL runtime/adapter v3 wire contract local to the host boundary.
- Add `GET /v1/compatibility` and `POST /v1/execute` handling as `Request -> Response`.
- Require injected authorization before compatibility metadata or execution.
- Require exact runtime-protocol, adapter-contract and engine-revision pins.
- Translate only the frozen v3 request fields into public `ExecutionRequest`.
- Forward `Request.signal` to `ExecutionEngine.execute`.
- Bound execute request bodies to 1 MiB and reject malformed/media/pin/policy drift before engine execution.
- Preserve committed/blocked/conflicted/cancelled/failed engine terminal results without reclassifying them as transport failures.
- Add focused automated tests using an injected recording/fake engine and public core types.

### Out of Scope

- Network listener/server framework selection.
- Deployment, TLS, service discovery or OAuth implementation.
- Provider/model adapter selection or persistence composition.
- Application-domain metadata or review-item materialization.
- Changes to `packages/core` or its engine semantics.
- Re-introducing the pre-sync `tests/seam` harness from `archive/pre-rickard-sync-20260817`.

### Definition of Done

- Runtime host is contained in the existing CLI composition-root package and introduces no new workspace package or lockfile dependency.
- Compatibility metadata is auth-gated and advertises the exact current reviewed engine revision with explicit compatibility state.
- Execute refuses wrong protocol/adapter/engine pins, invalid media/JSON/body size and unsupported policy semantics before engine invocation.
- Valid requests map deterministically to the public `ExecutionRequest` shape and forward cancellation.
- Engine terminal results are returned losslessly as v3 results; unexpected thrown host/engine exceptions remain HTTP host failures.
- Focused tests cover positive execution/replay-shaped results and adversarial pre-engine refusals.
- No `packages/core` source files change.
- Required documentation is current.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] focused runtime-host tests
- [x] repository build/test gate where the available execution environment permits it
- [x] if any gate cannot execute, record the exact external limitation without marking that gate passed

## References

- `packages/core/src/execution-engine.ts`
- `packages/core/src/execution-types.ts`
- `apps/cli/src/composition.ts`
- `docs/TASK_WORKFLOW.md`
- pre-sync reference only: `archive/pre-rickard-sync-20260817`

## Checklist

- [x] Sync Felix fork history with Rickard's 2026-08-16 `main` baseline without changing the upstream repository.
- [x] Confirm current public engine request/result and cancellation contracts.
- [x] Add runtime wire types/constants under `apps/cli/src`.
- [x] Add authenticated Fetch-compatible host handler.
- [x] Add adversarial focused tests.
- [x] Attempt all minimum verification gates and record the unavailable execution path honestly.
- [x] Update the large canonical status/system/journal documents when a safe writer or canonical runner is available.
- [x] Archive task only if Definition of Done and required gates are honestly satisfied.

## Decisions and Notes

- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.
- The pre-sync standalone `@acme/runtime-host` package design is not carried forward. This charter intentionally uses the existing CLI composition root to avoid a new workspace/lockfile surface while keeping the host module itself dependent only on public core contracts.
- The old fork-specific ACME-0101/0102 identifiers collided with Rickard's canonical task history after sync and are historical only.
- PR #3 was squash-merged to Felix fork `main` as `19ff83c94fad1611c1f7fa95ec4231a2c2a62e8a`. The runtime host remained explicitly unverified until the canonical fork gates became executable; canonical run `32074066197` now supports `compatibility: verified` without changing the frozen engine review point.
- ACME Arbetsyta AAL-0016 is complete on application `main`; its product CI passed production build/Sites artifact validation, 96/96 tests, TypeScript and lint against the same frozen engine review point `7326d24d1a2baff71a63d249fed698343a5a7d3b`. This is cross-repo wire/handshake evidence, not engine gate evidence.
- GitHub Actions was enabled on the Felix fork on 2026-08-17/18, resolving the external execution blocker without modifying Rickard/upstream.
- The first canonical runs exposed real formatting, type-fixture and PostgreSQL fixture drift. The repairs stayed outside `packages/core`, and the final verified descriptor state passed the complete canonical workflow in run `32074066197`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] Canonical CI run `32074066197` on the verified descriptor state: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`, repository docs check and build all passed.
- [x] Unit suite 877/877, conformance 78/78, integration 81/81 and scenario 26/26.
- [x] Runtime-host focused integration tests 11/11.
- [x] PostgreSQL gate 43/43, including restart after provider success with no second provider call.
- [x] Final implementation diff contains no `packages/core` source changes.
- [x] The previously documented Actions limitation is resolved; no required gate remains skipped.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` not required; no directory/topology boundary changed
- [x] Long-lived boundary recorded in `docs/SYSTEMDOC.md`; no ADR numbering collision introduced

## Handoff and Follow-ups

- Current state: ACME-0149 is complete. The authenticated Fetch-compatible AAL v3 runtime host is compatibility-verified against the frozen engine review point after the complete canonical fork gate.
- Next recommended step: create a new independently approved task for a deployable listener/runtime-host composition; do not reopen ACME-0149.
- Blockers: none for this task.
- Child tasks: none.
- Resume condition: n/a — complete.
- Open questions: deployment/listener technology remains intentionally deferred to a new task.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of rewriting it.
