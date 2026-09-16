# Current Task

Task ID: ACME-0181
Parent Task: None
Status: In Progress
Owner: OpenAI assistant
Created: 2026-09-16
Last updated: 2026-09-16
Charter frozen at: 2026-09-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0052-apache-2.0-open-source-distribution.md`
- `docs/adr/0053-model-only-execution-runtime.md`
- `docs/adr/0054-model-runtime-v2-multi-provider-routing.md`

## Task Summary

Prepare ACME's model-only runtime for deliberate public npm distribution and
in-process embedding by consumers such as A008, without changing the accepted
model execution semantics or publishing anything from this task.

## Task Charter

### Goal

Create a stable npm library boundary that lets a Node consumer execute the
accepted ACME model-only runtime in-process, with the same provider routing,
streaming, cancellation, idempotency and failure semantics used by the existing
service composition.

### Primary Deliverable

A publish-ready `@acme-engine/model-runtime` package and the smallest required
publishable dependency set under the `@acme-engine/*` scope, proven by packed
artifact installation and an offline consumer test.

### In Scope

- Add and accept the publication/library-boundary ADR required by this public
  cross-package contract.
- Add an in-process model-runtime composition package that returns a
  `ModelExecutionEngine`-compatible runtime and never starts a listener.
- Reuse the existing OpenAI Responses, Chat Completions, routed gateway and
  model-execution repository implementations rather than duplicating them.
- Move only the packages required by the public model-runtime dependency graph
  to the `@acme-engine/*` npm scope and update repository imports/dependencies.
- Add initial public-package metadata and version `0.1.0`; keep the workspace
  root `private: true`.
- Refactor the private CLI service composition to consume the new library so
  service and embedded callers share one implementation.
- Add deterministic tests for the embedded composition and packed package
  consumption.
- Update present-state documentation and package/file maps.

### Out of Scope

- Publishing to npm, creating a release/tag, deploying a service or pushing the
  task branch.
- Modifying A008 or its Tauri client.
- Changing `acme-model-runtime/1` or `/2` wire contracts.
- Changing `ModelExecutionEngine`, provider execution semantics, replay,
  retention or error classification except where required to preserve existing
  behavior through the new composition boundary.
- Changing ACME domain modules, `MemoryEngine`, `StateEngine` or full
  `ExecutionEngine` behavior.
- Renaming unrelated private `@acme/*` packages.

### Definition of Done

- `@acme-engine/model-runtime@0.1.0` can be packed and installed with every
  runtime dependency resolvable from the task's public package set.
- An external temporary consumer can import the packed runtime, configure a
  deterministic injected provider transport, execute one model request and
  observe the expected terminal result/events without starting HTTP.
- The existing `acme-model-runtime` service still passes its focused tests and
  uses the same shared in-process composition instead of duplicating provider
  routing.
- Root publication remains fail-closed via `private: true`; no package is
  actually published by ACME-0181.
- Required documentation describes the new package boundary accurately.

### Minimum Verification Gates

- [ ] `pnpm docs:check`
- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm boundaries`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] pack/dry-run every public package and inspect package contents
- [ ] install packed artifacts in a temporary consumer and execute offline

## References

- `docs/adr/0052-apache-2.0-open-source-distribution.md`
- `docs/adr/0053-model-only-execution-runtime.md`
- `docs/adr/0054-model-runtime-v2-multi-provider-routing.md`
- `docs/design/acme-model-runtime-2.md`
- `apps/cli/src/acme-model-runtime-service.ts`

## Checklist

- [ ] Decide and record the public npm/library boundary in an ADR.
- [ ] Add the embedded model-runtime package and public dependency metadata.
- [ ] Refactor CLI model-runtime service composition onto the shared package.
- [ ] Add deterministic embedded-consumer/package-artifact verification.
- [ ] Run canonical offline gates and package dry-runs.
- [ ] Update `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/JOURNAL.md`
  and `docs/FILESTRUCTURE.md`.
- [ ] Archive ACME-0181 and restore the current-task template when complete.

## Decisions and Notes

- A checkpoint after each implementation step is required.
- Actual npm publication is intentionally excluded; packed artifacts are the
  release-candidate evidence for this task.
- Existing local changes in the original `C:\code\acme` worktree are not part
  of this task and must remain untouched.

## Charter Amendment Log

-none

## Verification

- [ ] Canonical offline gates pass.
- [ ] Public package tarballs contain only intended distributable files.
- [ ] Temporary consumer installs only packed artifacts and executes offline.
- [ ] No npm registry publication occurs.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] ADR for the public package/library boundary

## Handoff and Follow-ups

- Current state: implementation not started.
- Next recommended step: accept ADR and create package boundary.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
