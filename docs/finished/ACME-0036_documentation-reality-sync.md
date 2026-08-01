# Current Task

Task ID: ACME-0036
Parent Task: None
Status: Complete
Owner: Claude
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

## Task Summary

ACME-0033 through ACME-0035 completed Milestone 2, and each kept its own
documentation current. The documents those tasks did not touch still describe
an earlier project: the current-facing phase statements in `AGENTS.md`,
`README.md` and `docs/PROJECT_BRIEF.md` all say Milestone 2 durability is
partial, the brief still names the live half of Milestone 1 as remaining work,
and `docs/SYSTEMDOC.md` still tells a reader that no resume behavior exists
and lists a composition root without its outbox commands.

A docs-first repository whose entry documents are a milestone behind is worse
than one with no status text, because a new contributor reads the stale
sentence and trusts it. This task resynchronizes the current-facing claims
with what the merged code does, and changes nothing else.

A task is never considered done until `docs/JOURNAL.md`, `docs/SYSTEMDOC.md`
and `docs/CURRENT_STATUS.md` are current.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Every current-facing documentation claim matches the merged behavior of
Milestone 2.

### Primary Deliverable

A documentation-only change set that corrects the audited stale claims in
`AGENTS.md`, `README.md`, `docs/PROJECT_BRIEF.md`, `docs/SYSTEMDOC.md`,
`docs/CURRENT_STATUS.md` and the Domain Test UI readiness table.

### In Scope

- `AGENTS.md` current-phase paragraph.
- `README.md` capability summary and current-objective gap list.
- `docs/PROJECT_BRIEF.md` phase line and `Next Deliverable` section.
- `docs/SYSTEMDOC.md` composition-root section: the missing `outbox`
  commands and the sentence claiming no resume behavior exists.
- `docs/CURRENT_STATUS.md` spot corrections where ACME-0035 left drift.
- The Domain Test UI readiness table, so its prerequisite list reflects
  Milestone 2 completion.
- A signed journal entry and the archive of this task.

### Out of Scope

- Any runtime, test or configuration change.
- `docs/design/acme-design-and-development-spec.md`, which is the approved
  baseline rather than a status document, and is not rewritten as milestones
  land.
- Archived tasks under `docs/finished/`, which are immutable history.
- Activating any backlog proposal or resolving any decision gate.
- New ADRs; nothing here decides anything.

### Definition of Done

- No current-facing document states that Milestone 2 is partial, that durable
  resume is missing, that the outbox is never drained, or that the live half
  of Milestone 1 is outstanding.
- `README.md` and `AGENTS.md` name the capabilities a reader would otherwise
  have to discover from the journal: durable resume, the durability and
  concurrency proofs, and the outbox delivery boundary.
- The Domain Test UI readiness table states Milestone 2 completion without
  implying its decision gates are resolved.
- `git diff` contains only Markdown changes.
- The documentation verification baseline passes.

### Minimum Verification Gates

- [x] `pnpm docs:check` (internal links and balanced fences)
- [x] `git diff --check`
- [x] `git diff --stat` shows Markdown files only
- [x] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`
- [x] `pnpm test` (unit, conformance, integration, scenario)

## References

- `docs/finished/ACME-0033_durable-execution-resume.md`
- `docs/finished/ACME-0034_milestone-2-durability-proofs.md`
- `docs/finished/ACME-0035_outbox-delivery-boundary.md`
- `docs/adr/0017-durable-execution-resume.md`
- `docs/adr/0018-outbox-delivery-boundary.md`
- `docs/design/acme-design-and-development-spec.md`, Milestone 2 acceptance
- Precedent: ACME-0016, ACME-0024 and ACME-0031 documentation syncs

## Checklist

- [x] Correct the `AGENTS.md` current-phase paragraph.
- [x] Correct `README.md`.
- [x] Correct `docs/PROJECT_BRIEF.md`.
- [x] Correct `docs/SYSTEMDOC.md`.
- [x] Spot-correct `docs/CURRENT_STATUS.md`.
- [x] Update the Domain Test UI readiness table.
- [x] Run every minimum verification gate and record the results.
- [x] Add a signed `docs/JOURNAL.md` entry and archive this task.

## Decisions and Notes

- A checkpoint after each step or substep is required. The checklist is kept
  current during the work.
- The design specification is deliberately left alone. It records the approved
  plan, and rewriting its milestone sections as they complete would destroy
  the record of what was planned versus what happened.
- Where a capability exists but nothing exercises it in production — neither
  reference module emits domain events — the documentation says so rather
  than implying traffic that does not exist.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

- [x] Every minimum verification gate above passed on 2026-08-01:
      `docs:check` 81 Markdown files after archival; `format:check`, `lint`, `typecheck` and
      `build` clean; `pnpm test` 384 unit, 58 conformance, 29 integration and
      19 scenario tests; `git diff --check` clean; the diff is Markdown only.
- [x] Each changed paragraph was read against the merged code, not against the
      journal entries that described it.
- [x] Skipped checks: none. `pnpm test:live` is not a gate for a docs task.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `README.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/design/domain-test-ui-specification.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: complete. Every current-facing document matches the merged
  Milestone 2 behavior.
- Next recommended step: none forced. The open choices are the Domain Test UI
  decision gates, outbox redrive and real transports, the driver-error
  classification backlog item, and an evaluation harness.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none open at freeze.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
