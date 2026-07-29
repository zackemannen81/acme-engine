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
