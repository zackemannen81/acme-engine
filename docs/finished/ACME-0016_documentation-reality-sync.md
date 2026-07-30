# Current Task

Task ID: ACME-0016
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-07-30
Last updated: 2026-07-30
Charter frozen at: 2026-07-30
Archived: 2026-07-30

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `README.md`
- `FS.txt`
- the actual non-generated working-tree inventory

## Task Summary

Synchronize repository-facing documentation with the implemented Milestone 1
reality after ACME-0015. Correct stale pre-implementation language and repair
the repository map against the files that actually exist, without changing
runtime behavior or rewriting historical task records.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make current, non-historical repository documentation accurately describe the
implemented workspace, active phase, remaining gaps and actual file
structure.

### Primary Deliverable

A documentation-only synchronization of `AGENTS.md`,
`docs/FILESTRUCTURE.md` and every directly affected current-facing status or
orientation document, verified against the real non-generated workspace.

### In Scope

- Update `AGENTS.md` so its phase and verification language acknowledge the
  implemented contract layer, pure engines, in-memory adapters and shared
  conformance while naming the still-missing orchestration, durable
  persistence and reference modules.
- Audit `docs/FILESTRUCTURE.md` against the actual working tree, excluding
  intentionally omitted generated `node_modules/` and `dist/` content.
- Add missing tracked/current files and archive/readme/template entries to the
  repository map, including the newly completed ACME-0015 artifacts.
- Record `FS.txt` accurately as a legacy, non-authoritative raw filesystem
  snapshot while keeping `docs/FILESTRUCTURE.md` canonical.
- Correct stale current-phase and next-deliverable text in `README.md` and
  `docs/PROJECT_BRIEF.md`.
- Correct directly affected status wording in `docs/CURRENT_STATUS.md` and
  `docs/SYSTEMDOC.md`.
- Add a signed journal entry describing the audit and exact verification.
- Preserve completed task archives as historical evidence even when their
  original statements are no longer current.

### Out of Scope

- Runtime, test, package, dependency, schema, contract or architecture
  behavior changes.
- Editing completed task archives or historical journal entries to make old
  statements look current.
- Deleting or regenerating `FS.txt`; removal can be proposed separately if
  desired.
- Implementing or activating the Domain Test UI or changing its backlog
  status.
- Implementing a reference module, ExecutionEngine, ScenarioRunner, SQLite or
  a live provider.
- Changing an accepted ADR or approved architecture boundary.
- Deployment, publication, push, release or other remote mutation.

### Definition of Done

- `AGENTS.md` no longer claims that no runtime implementation exists and its
  code-task verification wording reflects current practice.
- `docs/FILESTRUCTURE.md` accounts for every relevant non-generated
  working-tree file or explicitly documents an intentional summarized group.
- Current-facing README, brief, status and system documentation agree on the
  implemented substrate and persistent gaps.
- Historical archives and journal entries remain unchanged.
- The Domain Test UI implementation remains a backlog proposal.
- Internal links and Markdown fences pass and `git diff --check` is clean.

### Minimum Verification Gates

- [x] Compare the non-generated working-tree inventory with
      `docs/FILESTRUCTURE.md`
- [x] Search current-facing documentation for superseded phase/status claims
- [x] `pnpm docs:check`
- [x] Balanced Markdown fences in every edited document
- [x] `git diff --check`

## References

- `AGENTS.md`
- `README.md`
- `FS.txt`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/FILESTRUCTURE.md`
- `docs/finished/ACME-0015_reusable-domain-module-conformance.md`

## Checklist

- [x] Activate ACME-0016 as a bounded Draft.
- [x] Review and freeze the documentation-only charter.
- [x] Inventory the actual non-generated workspace.
- [x] Update `AGENTS.md` current phase and verification wording.
- [x] Repair `docs/FILESTRUCTURE.md` and document summarized/legacy entries.
- [x] Synchronize README, project brief, status and system wording.
- [x] Verify links, fences, stale-language search and diff hygiene.
- [x] Add a signed journal entry.
- [x] Archive ACME-0016 and restore the task template.

## Decisions and Notes

- The maintainer explicitly requested and approved this separate
  documentation-reality task on 2026-07-30.
- `docs/CURRENT_STATUS.md` remains authoritative for implementation reality;
  `docs/PROJECT_BRIEF.md` remains authoritative for approved direction.
- `FS.txt` is tracked but contains a stale raw Windows filesystem dump,
  including generated directories and mojibake. It is recorded, not deleted,
  because deletion was not explicitly requested.
- Completed task archives and earlier journal entries are historical evidence,
  not current-facing status documents.
- The Domain Test UI implementation remains in backlog.
- The reviewed charter was frozen unchanged at `Ready` and then moved to
  `In Progress` on 2026-07-30.

## Charter Amendment Log

- None.

## Verification

- [x] Confirm current-facing phase statements agree.
- [x] Confirm every top-level file appears in the repository map.
- [x] Confirm archive, backlog, paused and template entries are represented.
- [x] Confirm generated `node_modules/` and `dist/` remain intentionally
      omitted.
- [x] Confirm no historical record was rewritten.
- [x] Confirm the UI implementation proposal remains in backlog.

Exact evidence on 2026-07-30:

- Compared the actual non-generated working-tree inventory with the canonical
  map and added the missing backlog/paused/archive README entries, complete
  ACME-0001 through ACME-0016 archive inventory, ACME-0015 code/test fixtures
  and `FS.txt`.
- Current-facing stale-language search returned no pre-implementation phase,
  obsolete active-task, old test-count or unresolved-conformance claims.
- `FS.txt` remains tracked and unchanged; `docs/FILESTRUCTURE.md` now marks it
  non-authoritative and continues to omit generated `node_modules/` and
  `dist/`.
- `docs/backlog/domain-test-ui-implementation.md` remains present.
- `pnpm docs:check` passed for 47 Markdown files and `git diff --check`
  passed.
- No runtime gate applies because this task changes documentation only.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `README.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: Complete and archived.
- Next recommended step: Activate the separately approved bounded
  NarrativeModule task as a Draft for review.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0016_documentation-reality-sync.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
