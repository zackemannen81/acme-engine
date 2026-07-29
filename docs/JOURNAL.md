# Journal

Add one dated, signed entry for every meaningful work session or handoff.

## 2026-07-29 — Docs-first foundation created

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0001
- Summary: Created ACME's docs-first foundation in the new `acme-engine`
  repository. Added canonical agent guardrails, project brief, contribution
  workflow, current status, pre-implementation system documentation, file
  structure, journal, task template, ADR structure, design directory and
  finished-task archive. Added deterministic LF handling and a conservative
  ignore file. Archived the bootstrap task and made the complete design and
  development specification the active task. No runtime packages, provider
  calls, deployment or production systems were created or changed.
- Verification: Documentation links, Markdown fences and scoped repository
  diff are verified in this work session. No typecheck or tests exist yet
  because runtime tooling has not been bootstrapped.
- Follow-ups: Execute `docs/CURRENT_TASK.md` and create the complete ACME
  design and development specification before implementation bootstrap.
- Signature: Codex

## 2026-07-29 — Frozen task charter workflow created

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0002
- Summary: Added a canonical workflow that freezes each task's Goal, Primary
  Deliverable, In Scope, Out of Scope, Definition of Done and minimum
  verification gates when status reaches `Ready`. Added immutable task IDs,
  explicit task states, scope-change decision tree, paused-parent and
  bounded-child mechanics, backlog proposals, supersession rules and a
  one-active-task invariant. Updated AGENTS, CONTRIBUTING and the task
  template, created `docs/paused/` and `docs/backlog/`, ID-tagged the
  foundation as ACME-0001 and migrated the active design specification to
  ACME-0003 without changing its goal or completion conditions.
- Verification: Documentation links, Markdown fences, trailing whitespace and
  repository diff checked in this work session. Runtime checks are not
  applicable.
- Follow-ups: Continue ACME-0003 against its frozen charter. Route every new
  discovery through `docs/TASK_WORKFLOW.md`.
- Signature: Codex

## 2026-07-29 — Complete design and development specification

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0003
- Summary: Created the normative ACME design and development specification.
  It defines ownership, domain-neutral package boundaries, task-typed
  TypeScript contracts, the model trust pipeline, memory/state semantics,
  evaluator composition, execution/retry/cancellation/replay protocols,
  revisioned SQLite schema and Unit of Work, Narrative and Research vertical
  slices, ScenarioRunner/CLI behavior, quality strategy, security/privacy
  boundaries, governance, milestones and the exact proposed bootstrap task.
  Accepted ADRs 0001–0003 for the toolchain, static module composition and
  SQLite durability. `C:\code\kids_standalone` at commit `e1bb69f3...` was
  inspected as read-only evidence; no source or production system was changed.
- Verification: Internal Markdown links and anchors, balanced fences,
  Mermaid block structure, terminology/ownership, requirement traceability,
  line endings, trailing whitespace and `git diff --check` verified. Runtime
  typecheck/tests are not applicable because no runtime or toolchain exists.
- Follow-ups: Activate the bounded ACME-0004 repository-bootstrap charter from
  specification section 26 when implementation is explicitly approved.
- Signature: Codex

## 2026-07-29 — Repository bootstrap completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0004
- Summary: Activated and completed the frozen repository-bootstrap charter.
  Added a pnpm workspace and lockfile, exact Node/pnpm and development
  dependency pins, shared strict ESM TypeScript configuration, ESLint,
  Prettier, Vitest and dependency-cruiser. Added behavior-free `@acme/core`,
  `@acme/testing` and `@acme/cli` skeletons, a passing workspace import test,
  a core vocabulary guard and a negative dependency fixture. Added a
  secret-free GitHub Actions workflow mirroring the local gates. No execution,
  memory, state, persistence, provider or domain behavior was introduced.
- Verification: `pnpm install --frozen-lockfile` and a forced frozen reinstall
  passed with pnpm `10.34.5`. Documentation checks covered 24 Markdown files.
  Format, lint, strict typecheck, dependency boundaries, unit tests and build
  passed. The unit suite passed 1 file and 1 test. Conformance, integration
  and scenario commands passed with no test files, as expected for this
  behavior-free milestone. `git diff --check` passed. Remote GitHub Actions was
  not run because no push was authorized. Local checks used installed Node
  `24.14.1`; CI uses the exact repository pin `24.18.0`.
- Follow-ups: Shape and explicitly approve a bounded Milestone 1 task for pure
  contracts and in-memory execution. Do not begin runtime work from the empty
  task template.
- Signature: Codex

## 2026-07-29 — Pure contracts and static registries completed

- Date: 2026-07-29
- Author: Codex
- Task: ACME-0005
- Summary: Began Milestone 1 with a bounded pure contract-layer task. Added
  Zod-backed public schemas, common JSON/identity/time/document types,
  `acme-cjson-1` canonical JSON, SHA-256 hashing, the ACME error taxonomy,
  provider-neutral model and prompt-contract types, a strict response
  pipeline and immutable contract/module registries. Added task-typed module
  authoring, state/memory envelope and policy declarations and compile-time
  task inference examples. The pipeline records permitted BOM/JSON-fence
  cleanup, rejects parsed-value coercion and produces a deterministic parsed
  hash. No engine, repository, adapter or reference-domain behavior was added.
- Verification: Frozen install, formatting, lint, strict typecheck,
  dependency boundaries and build passed. Typecheck compiled the task
  inference and expected invalid-name example. Unit tests passed 4 files and
  19 tests covering canonicalization, hashing, all pipeline stages, cleanup,
  coercion rejection, fingerprints, ordering, lookup and duplicates.
  Conformance, integration and scenario gates passed empty because their
  implementations remain outside this charter. Documentation checks covered
  25 files before archival and `git diff --check` passed. Remote CI was not
  run because no push was authorized; local checks used Node `24.14.1` while
  CI remains pinned to `24.18.0`.
- Follow-ups: Explicitly activate a bounded pure StateEngine task next.
  MemoryEngine, in-memory repository/model mock and the Narrative slice remain
  separate Milestone 1 tasks.
- Signature: Codex
