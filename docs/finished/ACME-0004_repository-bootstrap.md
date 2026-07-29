# Current Task

Task ID: ACME-0004
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

Activate the first implementation milestone from specification section 26.
Create a deterministic workspace and enforce its package boundaries without
claiming or adding execution-engine behavior.

## Task Charter

The charter is frozen. Goal, Primary Deliverable, scope, Definition of Done
and Minimum Verification Gates must not be expanded, weakened or redefined.

### Goal

Create a deterministic, strict TypeScript workspace in which ACME packages can
be implemented and boundary-tested.

### Primary Deliverable

A bootstrapped pnpm monorepo with `@acme/core`, `@acme/testing` and
`@acme/cli` skeletons plus CI-quality local verification.

### In Scope

- Pin Node 24 LTS patch and pnpm 10 patch.
- Add root `package.json`, `pnpm-workspace.yaml` and lockfile.
- Add shared strict ESM `tsconfig`.
- Configure ESLint, Prettier, Vitest and dependency-cruiser.
- Add minimal package manifests and typed exports, without engine behavior.
- Add the scripts listed in Milestone 0.
- Add one passing workspace import test.
- Add one automated forbidden-boundary fixture/test.
- Update documentation to implemented reality.

### Out of Scope

- ExecutionEngine, StateEngine or MemoryEngine behavior.
- SQLite and model provider packages.
- Narrative or Research task implementation.
- Package publication, live calls or deployment.

### Definition of Done

- Clean install is lockfile-reproducible.
- Format, lint, typecheck, boundary, unit and build commands pass.
- Core has zero runtime dependencies on SDKs, databases, apps or modules.
- CI definition runs the same commands without secrets.
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

- `docs/design/acme-design-and-development-spec.md`, sections 5, 6, 18, 23
  and 26
- `docs/adr/0001-typescript-pnpm-workspace.md`
- `docs/adr/0002-static-task-typed-module-composition.md`

## Checklist

- [x] Record the activated frozen charter and begin the task.
- [x] Inspect the prescribed package layout, dependency rules and root scripts.
- [x] Select and record exact compatible dependency patch versions.
- [x] Create the root workspace, toolchain pins and shared configuration.
- [x] Create the `@acme/core`, `@acme/testing` and `@acme/cli` skeletons.
- [x] Add a passing workspace import test.
- [x] Add an automated forbidden-boundary fixture/test.
- [x] Add CI using the same local verification commands.
- [x] Install with pnpm and commit the generated lockfile.
- [x] Run all minimum verification gates and record the evidence.
- [x] Update long-lived documentation and add a signed journal entry.
- [x] Archive the completed task and restore the task template.

## Decisions and Notes

- The exact charter comes from specification section 26 and was explicitly
  activated by the user on 2026-07-29.
- This milestone creates build substrate only; no engine behavior may be
  introduced or claimed.
- Pin Node `24.18.0`, pnpm `10.34.5`, TypeScript `6.0.3` and exact patch
  versions for every root development dependency. The Node pin follows the
  current Node 24 LTS archive; package versions were verified against the npm
  registry on 2026-07-29.
- Pin Vitest `4.0.18` rather than `4.1.10`: the latter selected Vite 8 and a
  Rolldown WASM dependency with unresolved peer metadata under strict pnpm
  validation. Vitest `4.0.18` remains on the required major and declares Vite
  6/7 support.
- The generated lockfile passed both a normal frozen install and a forced
  frozen reinstall with pnpm `10.34.5`.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [x] Verify a frozen-lockfile install.
- [x] Verify formatting, linting, strict typecheck and package build.
- [x] Verify unit tests, including the workspace import.
- [x] Verify the allowed dependency graph passes.
- [x] Verify the forbidden dependency fixture fails for the expected rule.
- [x] Verify CI invokes the same secret-free commands.
- [x] Verify documentation links, Markdown fences and repository diff hygiene.
- [x] Document skipped checks and exact reasons.

Final evidence on 2026-07-29:

- `pnpm install --frozen-lockfile` and a forced frozen reinstall passed with
  pnpm `10.34.5`.
- Documentation checks validated 24 Markdown files.
- Format, lint, strict typecheck, dependency boundaries and build passed.
- The workspace import unit test passed: 1 file and 1 test.
- Conformance, integration and scenario gates ran successfully with no test
  files, as expected for the behavior-free bootstrap.
- The allowed graph passed and the negative fixture failed for
  `core-is-domain-neutral` as required.
- `git diff --check` passed.
- Remote GitHub Actions was not executed because this task did not authorize a
  push. Local checks ran on the installed Node `24.14.1`; CI is configured to
  use the exact repository pin `24.18.0`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR review: no long-lived architectural decision changed

## Handoff and Follow-ups

- Current state: Complete and archived.
- Next recommended step: Shape and explicitly approve a bounded Milestone 1
  charter for pure contracts and in-memory execution.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0004_repository-bootstrap.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
