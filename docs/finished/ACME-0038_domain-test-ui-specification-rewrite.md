# Current Task

Task ID: ACME-0038
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-01
Last updated: 2026-08-01
Charter frozen at: 2026-08-01

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/domain-test-ui-specification.md`
- `docs/backlog/domain-test-ui-implementation.md`
- `docs/concepts_sandbox/README.md`

## Task Summary

Milestone 2 is complete and both reference domains run offline and live through
the CLI. The Domain Test UI remains documentation only, but its backlog and
design specification still speak like 2026-07-30: engine layers "missing",
phase 1 = plan compiler first, and seven open decision gates with no recorded
recommendation.

A visual workbench mock now lives under `docs/concepts_sandbox/temp/` (explicit
non-authority). This task is **docs-only**: rewrite the backlog activation
proposal and the design specification so they match repository reality, freeze
**recommended** answers to the irreversible gates, reorder the build plan
(view-contract / catalog before full plan authoring), and introduce a clear
module-versus-adapter workbench split. No application package and no runtime
code.

Also records the hygiene already done in this session: removal of resolved
backlog files for encrypted-payload (ACME-0030) and strict structured-output
(ACME-0029).

A task is never considered done until `docs/JOURNAL.md`, `docs/SYSTEMDOC.md`
and `docs/CURRENT_STATUS.md` are current.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Domain Test UI documentation is honest about Milestone 2, records proposed gate
decisions for review, and gives a build order that can be activated without
re-litigating architecture from chat history.

### Primary Deliverable

Rewritten `docs/design/domain-test-ui-specification.md` and
`docs/backlog/domain-test-ui-implementation.md`, plus status/journal sync.
No code.

### In Scope

- Rewrite the design specification: readiness, surfaces, module/adapter modes,
  proposed gate freeze, storage recommendation, reordered build plan,
  verification bar, package sketch, mapping to the concepts_sandbox mock.
- Rewrite the backlog implementation proposal to match that specification.
- Update `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md` (Domain Test UI
  paragraphs only), `docs/FILESTRUCTURE.md`, `docs/design/README.md` as needed.
- Confirm resolved backlog removals (encrypted-payload, strict-structured) are
  reflected in backlog README / FILESTRUCTURE if not already.
- Signed journal entry and archive of this task.

### Out of Scope

- Any runtime package (`apps/test-ui` or similar).
- Implementing `acme-test-plan/1`, read models, or rendering.
- ADRs that only become mandatory when implementation is activated (this task
  may *name* that a future activation ADR is required for `acme-test-plan/1`).
- Domain Test UI decision to ship in product version 1 is recorded as a
  **proposed freeze**, not a binding product commitment beyond documentation.
- Driver-error classification, outbox redrive, evaluation harness, or live
  ScenarioRunner steps.
- Moving the HTML mock out of `concepts_sandbox` into a normative path.

### Definition of Done

- Design spec states engine prerequisites are satisfied; activation is blocked
  only by explicit product/priority freeze and a future implementation charter.
- All seven former decision gates have a written **proposed freeze** answer
  (or an explicit "defer until activation ADR" with a single recommended path).
- Build plan starts with pure read-model / view contracts and catalog, not with
  a full UI shell.
- Backlog proposal matches the design spec and recommends the first
  implementation charter shape.
- Docs checks pass; no TypeScript changes required for this task.
- Task archived; CURRENT_TASK restored.

### Minimum Verification Gates

- [ ] `pnpm docs:check`
- [ ] `git diff --check`
- [ ] Spot-check internal links from design/backlog/CURRENT_STATUS
- [ ] No runtime test suite required (docs-only)

## References

- Prior: ACME-0014 Domain Test UI specification (finished).
- Mock (non-authority):
  `docs/concepts_sandbox/temp/testregistry_workbench_professional_test_engineering_suite.html`
- Engine reality: ACME-0018–0036 (ExecutionEngine, modules, SQLite, ScenarioRunner,
  CLI, resume, outbox, docs sync).

## Checklist

- [x] Freeze ACME-0038 docs-only charter.
- [x] Rewrite design specification.
- [x] Rewrite backlog implementation proposal.
- [x] Sync CURRENT_STATUS, SYSTEMDOC, FILESTRUCTURE, design README.
- [x] Confirm resolved backlog hygiene is complete.
- [x] `pnpm docs:check` and `git diff --check`.
- [x] Journal, archive, restore CURRENT_TASK template.

## Decisions and Notes

- Gate answers in this task are **proposed freezes for documentation**. A later
  implementation charter may promote them via ADR without re-opening product
  debate if maintainers accept this document.
- concepts_sandbox remains non-authority; the mock is a visual hypothesis only.
- Prefer view-contract-first delivery over plan-compiler-first after M2.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] `pnpm docs:check` (81 Markdown files after archival)
- [x] `git diff --check`
- [x] Runtime suites: skipped (docs-only)

## Documentation Updates

- [x] `docs/design/domain-test-ui-specification.md`
- [x] `docs/backlog/domain-test-ui-implementation.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/design/README.md`, concepts_sandbox README, root README, backlog README

## Handoff and Follow-ups

- Current state: Complete and archived.
- Next recommended step: maintainer acceptance of proposed gate freezes, then
  a bounded implementation charter (phase 0/1 only: skeleton + S4–S7 view
  contracts). Do not start `apps/test-ui` without that charter.
- Blockers: none.
- Open questions: none within this charter.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
