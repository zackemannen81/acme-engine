# Current Task

Task ID: ACME-0005
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-07-29
Last updated: 2026-07-29
Charter frozen at: 2026-07-29

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/acme-design-and-development-spec.md`
- `docs/adr/0001-typescript-pnpm-workspace.md`
- `docs/adr/0002-static-task-typed-module-composition.md`

## Task Summary

Begin Milestone 1 with its first bounded work package. Establish the pure,
domain-neutral contract and composition layer that later engine, state,
memory, adapter and reference-domain tasks can depend on.

## Task Charter

The charter is frozen. Goal, Primary Deliverable, scope, Definition of Done
and Minimum Verification Gates must not be expanded, weakened or redefined.

### Goal

Create a deterministic model trust boundary and statically task-typed
composition surface without implementing execution, state or memory behavior.

### Primary Deliverable

An `@acme/core` contract layer containing deterministic primitives, the ACME
error and model contract types, a validating response pipeline, immutable
contract/module registries and compile-time task input/output inference.

### In Scope

- Implement common JSON, identity, time, document and diagnostic types.
- Implement canonical JSON `acme-cjson-1` and SHA-256 hashing.
- Implement the ACME error taxonomy and safe structured error.
- Implement provider-neutral model, prompt-contract and gateway port types.
- Implement strict response-pipeline stages, deterministic cleanup warnings
  and parsed hashes.
- Implement immutable contract registration, lookup, ordering and
  deterministic fingerprints.
- Implement task-typed module authoring types and immutable runtime module
  registration.
- Add state and memory envelope/policy type declarations required by the
  module contracts, without implementing either engine.
- Add Zod 4 as the public runtime-schema dependency.
- Add unit and compile-time type-contract tests.
- Update documentation to implemented reality.

### Out of Scope

- `ExecutionEngine`, `StateEngine` or `MemoryEngine` behavior.
- Repository ports or in-memory/SQLite persistence implementations.
- Model gateway adapter or model mock implementation.
- Narrative or Research modules and acceptance scenarios.
- Idempotency, replay, repair, evaluation or commit orchestration.
- Package publication, live provider calls or deployment.

### Definition of Done

- Public types implement the applicable normative contracts from
  specification sections 7–10, state/memory declarations from sections 11–12
  and the error taxonomy from section 14.3.
- Canonical JSON is deterministic, sorts object keys, preserves array order
  and rejects non-JSON runtime values.
- The response pipeline distinguishes empty, parse, schema and semantic
  failures, performs no silent coercion and records allowed cleanups.
- Contract and module registries are immutable after construction, sort their
  listings deterministically and reject duplicate keys/namespaces.
- Compile-time examples prove task-name, task-input and contract-output
  inference and reject an invalid task name.
- Unit tests cover canonicalization, hashing, every pipeline stage and
  registry success/failure behavior.
- Frozen install, format, lint, typecheck, boundaries, tests and build pass.
- `CURRENT_STATUS`, `SYSTEMDOC`, `FILESTRUCTURE` and journal are updated.

### Minimum Verification Gates

- [x] `pnpm install --frozen-lockfile`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] Internal documentation links and balanced Markdown fences
- [x] `git diff --check`

## References

- `docs/design/acme-design-and-development-spec.md`, sections 7–12, 14.3,
  19 and Milestone 1
- `docs/adr/0002-static-task-typed-module-composition.md`

## Checklist

- [x] Activate and freeze the bounded Milestone 1 contract-layer charter.
- [x] Add exact Zod dependency and organize public core exports.
- [x] Implement common deterministic primitives and structured errors.
- [x] Implement model/prompt contracts and response pipeline.
- [x] Implement immutable contract and module registries.
- [x] Implement task-typed module authoring and required envelope types.
- [x] Add canonicalization, pipeline and registry unit tests.
- [x] Add compile-time task inference tests under `packages/core/test-d`.
- [x] Run all minimum verification gates and record evidence.
- [x] Update long-lived documentation and add a signed journal entry.
- [x] Archive the completed task and restore the task template.

## Decisions and Notes

- The user explicitly approved proceeding with Milestone 1 on 2026-07-29.
- Milestone 1 contains several independently valuable work packages. Per the
  task-size rule, ACME-0005 implements only the first coherent contract and
  static-composition foundation.
- State/Memory behavior, in-memory adapters/model mock and the Narrative slice
  require separately activated follow-up tasks.
- The implementation follows existing specification and ADR-0002; no new
  cross-package architectural decision is introduced.
- Zod `4.4.3` is pinned as `@acme/core`'s only external runtime dependency.
- Runtime generic erasure is confined to the contract and module registry
  boundaries; typed authoring and `test-d` examples retain task inference.
- Focused verification passed with 4 test files and 19 unit tests before the
  documentation update.

## Charter Amendment Log

- None.

## Verification

- [x] Verify deterministic canonical JSON and SHA-256 vectors.
- [x] Verify all four response-pipeline failure stages and successful cleanup.
- [x] Verify schema validation does not coerce model output.
- [x] Verify contract registry fingerprints, lookup, ordering and duplicates.
- [x] Verify module registry lookup, ordering and duplicates.
- [x] Verify compile-time task input/output inference and invalid-name failure.
- [x] Verify the core forbidden-vocabulary scan still passes.
- [x] Verify all repository commands and documentation checks.
- [x] Document skipped checks and exact reasons.

Final evidence on 2026-07-29:

- `pnpm install --frozen-lockfile` passed with pnpm `10.34.5`.
- Documentation checks validated 25 Markdown files before archival.
- Format, lint, strict typecheck, dependency boundaries and build passed.
- Typecheck compiled the `packages/core/test-d` task-inference contract,
  including the expected invalid task-name failure.
- Unit tests passed: 4 files and 19 tests.
- Tests cover canonical JSON, SHA-256, all response-pipeline stages, cleanup
  warnings, coercion rejection and registry behavior.
- Conformance, integration and scenario gates passed with no test files;
  implementations for those layers are outside this charter.
- `git diff --check` passed.
- Remote GitHub Actions was not executed because no push was authorized.
  Local checks used installed Node `24.14.1`; CI remains pinned to `24.18.0`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR review: existing ADR-0002 remains sufficient

## Handoff and Follow-ups

- Current state: Complete and archived.
- Next recommended step: Shape and explicitly approve a bounded pure
  StateEngine task within Milestone 1.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0005_pure-contracts-and-static-registries.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
