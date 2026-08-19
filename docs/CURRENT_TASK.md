# Current Task

Task ID: ACME-0167
Parent Task: None
Status: In Progress
Owner: Felix Nissen / Rickard Zakrisson review
Created: 2026-08-19
Last updated: 2026-08-19
Charter frozen at: 2026-08-19T10:20+02:00

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

Port the reusable external runtime boundary from the Felix integration candidate onto the current frozen POC #1 baseline as a canonical, application-neutral ACME runtime contract. The task exists because the previous Felix runtime proved useful but its wire contract carried AAL/application metadata and a Felix-fork commit pin that do not belong in the engine's generic external boundary.

This task is deliberately a shell around the existing `ExecutionEngine`. It must not modify core or the frozen Evidence/POC #1 implementation.

## Task Charter

The charter is immutable from this point.

### Goal

Expose the existing `ExecutionEngine` through a small, strict, versioned and transport-neutral external runtime boundary without changing ACME core or POC #1 behavior.

### Primary Deliverable

A canonical `acme-runtime/1` wire contract, Fetch-compatible runtime host and thin Node HTTP listener with compatibility/execute endpoints and focused conformance/integration tests.

### In Scope

- Canonical ACME-generic runtime wire contract representing the existing `ExecutionRequest` fields needed for one execution.
- `GET /v1/compatibility` with an injected runtime descriptor/build identity rather than a hard-coded repository/commit.
- `POST /v1/execute` with fail-closed shape/version validation and deterministic mapping to `ExecutionRequest`.
- Injected authorization port; no production authentication scheme is defined by the contract.
- 1 MiB request body bound.
- Request disconnect/cancellation propagation to `AbortSignal` and therefore the engine call.
- Terminal result forwarding/mapping without transport-layer reclassification of ACME semantics.
- Thin Node built-in HTTP listener bridging Node requests/responses to Fetch `Request`/`Response`.
- Focused runtime-host and loopback listener tests.
- A freeze guard proving the protected core/POC paths are byte-for-byte unchanged by this feature branch.
- Documentation for the new external boundary and its explicit non-goals.

### Out of Scope

- Any modification under `packages/core/**`.
- Any modification under `apps/evidence-workbench-v2-api/**`.
- Any modification under `apps/evidence-workbench-v2-web/**`.
- Any modification under `packages/module-evidence-v2/**`.
- Any modification under `packages/evidence-v2-contracts/**`.
- Any modification under `packages/adapter-evidence-v2-postgres/**`.
- Any modification under `packages/adapter-evidence-v2-pdf/**`.
- Any modification under `docs/poc-1/**`.
- AAL/Felix application metadata such as `workspaceId`, application subject/version, source artifact IDs, AAL task IDs/contracts/schema hashes or a `felixnissen/acme-engine` pin in the canonical runtime request.
- Runnable Postgres/OpenAI service composition, provider choice, database choice, deployment, TLS/DNS or process supervisor.
- A general production authentication model. Bearer authentication may be implemented later as an optional composition helper, not as the runtime contract.
- Changes to the semantics, persistence or state transitions of `ExecutionEngine`.

### Definition of Done

- `acme-runtime/1` exposes only engine-generic request/response/compatibility data.
- Compatibility identity is injected at composition time and contains no fossilized Felix repository pin.
- Host authenticates before execution, validates fail-closed, enforces 1 MiB body limit and forwards cancellation.
- Host maps one valid request deterministically to the existing `ExecutionRequest` and forwards terminal engine semantics without invented transport outcomes.
- Node listener passes real loopback HTTP tests for compatibility, execute, auth refusal, body bound and disconnect cancellation.
- Protected POC/core paths have zero diff from the task base.
- Full canonical repository CI passes: documentation, formatting, lint, typecheck, boundaries, unit, conformance, integration, deterministic scenarios, build and PostgreSQL.
- Relevant long-lived docs are current and truthful.

### Minimum Verification Gates

- [ ] Static freeze check: zero diff from task base for every protected path listed above.
- [ ] Runtime host focused tests.
- [ ] Node listener loopback tests.
- [ ] `pnpm docs:check`.
- [ ] `pnpm format:check`.
- [ ] `pnpm lint`.
- [ ] `pnpm typecheck`.
- [ ] Package-boundary check.
- [ ] Unit suite.
- [ ] Conformance suite.
- [ ] Integration suite.
- [ ] Deterministic scenarios.
- [ ] Package build.
- [ ] PostgreSQL adapter suite.

## References

- POC #1 frozen commit: `6a866f126007fcf99309d8ee2eb4db86a34bb905`.
- Current task branch begins from repository `main` whose tree is byte-identical to that POC #1 freeze.
- Review reference only: accidental PR #30 / `integration/felix-runtime-candidate`.
- Rickard integration-runtime review, 2026-08-19: retain host/listener/compatibility/execute/cancellation/body-bound/tests; canonicalize wire and defer runnable Postgres/OpenAI composition.

## Checklist

- [x] Verify current `main` is byte-identical to POC #1 freeze `6a866f...`.
- [x] Create fresh branch from current `main`.
- [x] Freeze this docs-first charter.
- [x] Define canonical generic `acme-runtime/1` wire and injected descriptor.
- [x] Port Fetch runtime host against generic wire.
- [x] Port thin Node HTTP listener.
- [x] Port/adapt focused runtime and loopback tests.
- [x] Verify the PR file set contains no protected POC/core paths.
- [x] Apply repository-canonical Prettier formatting to the runtime host after the first `format:check` refusal.
- [ ] Run full canonical CI and repair only task-scoped failures.
- [ ] Update `CURRENT_STATUS.md`, `SYSTEMDOC.md`, `JOURNAL.md` and `FILESTRUCTURE.md` as required.
- [ ] Archive ACME-0167 and restore `CURRENT_TASK.md` template only after all gates pass.

## Decisions and Notes

- The runtime boundary is an application/transport shell around the existing engine, not an engine redesign.
- `acme-runtime/1` must remain domain-neutral and application-neutral.
- Runtime compatibility is retained, but build identity is injected at composition instead of hard-coded to a repository review point.
- Authentication is an injected authorization port. This task intentionally does not standardize bearer/OAuth/mTLS/etc.
- No Postgres/OpenAI runnable composition belongs in this PR; that is a separate future task.
- The protected-path zero-diff rule is a hard merge gate, not merely a review preference.
- PR #32 was merged only into the separate review baseline, not into `main`; it remains reference history rather than the source for this clean PR.
- PR #33 is the canonical clean implementation against current `main`. Its first CI refusal was formatting-only in `apps/cli/src/acme-runtime-host.ts`; repository Prettier 3.9.6 has now rewritten that file and the temporary formatter workflow self-removed.

## Charter Amendment Log

-none

## Verification

- [ ] Focused runtime host tests pass.
- [ ] Loopback listener tests pass.
- [x] Protected-path PR file-list check is empty for all frozen paths.
- [ ] Full canonical CI passes.
- [x] No live model call or external deployment is required or authorized by this task.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADR only if implementation discovers a long-lived architectural decision not already captured by this frozen charter.

## Handoff and Follow-ups

- Current state: Clean canonical runtime implementation is present on PR #33; Prettier repair has landed and a new full CI run is being requested on the formatted head.
- Next recommended step: Let canonical CI expose any remaining type/runtime/test issue, then repair only task-scoped failures.
- Blockers: None currently known beyond pending CI.
- Child tasks: None.
- Resume condition: N/A.
- Open questions: None inside the frozen task; runnable composition is explicitly deferred.

## Finalize When Complete

- Archive this file under `docs/finished/ACME-0167_canonical-runtime-boundary.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
