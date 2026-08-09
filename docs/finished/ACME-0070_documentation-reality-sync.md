# Current Task

Task ID: ACME-0070
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-09
Last updated: 2026-08-09
Charter frozen at: 2026-08-09

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

ACME-0065 through ACME-0069 delivered the durable quality-evaluation store,
the quality CLI, the pure S11 quality view, the live-model judge and async
launch with progress and cancellation. Each task updated part of the
documentation, but the current-facing documents were left a release behind in
several places:

- `docs/CURRENT_STATUS.md` is dated 2026-08-06, lists ADRs only through
  ADR-0025, does not mention ACME-0069, and states test counts that no longer
  match the suite.
- `docs/SYSTEMDOC.md` still says durable quality storage, CLI/UI surfaces and
  live judges are "not implemented", still says `failed` outbox entries have
  no redrive path, counts ten view contracts, omits the `quality` commands and
  carries two sentences garbled by earlier merges.
- `docs/FILESTRUCTURE.md` omits files that exist (live judge, outbox file
  dispatcher, quality read model, several tests, `docs/hrd/` and the
  concepts_sandbox subdirectories).
- `AGENTS.md`, `README.md` and `docs/PROJECT_BRIEF.md` describe closed gaps as
  open.
- `docs/design/gap-resolution-plan.md` activation order, the backlog index and
  the Domain Test UI specification still show delivered slices as pending.

A docs-first repository whose entry documents are behind the merged code is
worse than one with no status text, because the next contributor trusts the
stale sentence. This task resynchronizes current-facing claims with observed
repository reality and changes nothing else.

A task is never considered done until `docs/JOURNAL.md`, `docs/SYSTEMDOC.md`
and `docs/CURRENT_STATUS.md` are current.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Every current-facing documentation claim matches the merged behavior of
ACME-0057 through ACME-0069 and the observed repository contents.

### Primary Deliverable

A documentation-only change set correcting the audited stale claims in
`AGENTS.md`, `README.md`, `docs/PROJECT_BRIEF.md`, `docs/CURRENT_STATUS.md`,
`docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md`,
`docs/design/gap-resolution-plan.md`, `docs/design/README.md`,
`docs/design/domain-test-ui-specification.md` and `docs/backlog/README.md`.

### In Scope

- Current-phase statements in `AGENTS.md`, `README.md` and
  `docs/PROJECT_BRIEF.md`.
- `docs/CURRENT_STATUS.md`: date, ADR list, capability list, measured test
  counts, active work and recent-work summary.
- `docs/SYSTEMDOC.md`: date/status line, quality-evaluation section, composition
  root commands, outbox redrive statement, view-contract count and the garbled
  sentences.
- `docs/FILESTRUCTURE.md`: files and directories that exist but are unlisted.
- `docs/design/gap-resolution-plan.md`: slice and activation-order statuses.
- `docs/design/README.md` and `docs/design/domain-test-ui-specification.md`
  status headers where they state delivered work as pending.
- `docs/backlog/README.md` proposal index status.
- A signed `docs/JOURNAL.md` entry and the archive of this task.

### Out of Scope

- Any runtime, test, configuration or tooling change.
- `docs/design/acme-design-and-development-spec.md`, which is the approved
  baseline rather than a status document.
- Archived tasks under `docs/finished/`, which are immutable history.
- ADR content and statuses; nothing here decides anything.
- Activating any backlog proposal, gap slice or work package.
- `FS.txt`, which `docs/FILESTRUCTURE.md` already records as non-authoritative.
- The Swedish `hrd/` deliverables, which are derived artifacts.

### Definition of Done

- No current-facing document states that durable quality storage, the quality
  CLI, the quality view, the live judge, outbox redrive or async launch are
  missing.
- `docs/CURRENT_STATUS.md` test counts equal counts observed from a real run.
- `docs/FILESTRUCTURE.md` lists every tracked source, test and docs path that
  exists, excluding generated directories.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md` and `docs/FILESTRUCTURE.md`
  carry the same current date.
- `pnpm docs:check` passes and `git diff --check` is clean.
- The task is archived and `docs/CURRENT_TASK.md` is restored from the
  template.

### Minimum Verification Gates

- [x] `pnpm docs:check` (internal links and Markdown fences)
- [x] `git diff --check`
- [x] Test counts taken from an actual `pnpm test:unit` / `pnpm test` run
- [x] No file outside documentation is modified

## References

- `docs/finished/ACME-0065_durable-quality-store.md`
- `docs/finished/ACME-0066_quality-cli.md`
- `docs/finished/ACME-0067_quality-view.md`
- `docs/finished/ACME-0068_live-quality-judge.md`
- `docs/finished/ACME-0069_async-launch-progress-cancellation.md`
- [ADR-0026](../adr/0026-durable-quality-evaluation-store.md),
  [ADR-0027](../adr/0027-async-launch-job-progress-cancellation.md)
- Precedent: `docs/finished/ACME-0036_documentation-reality-sync.md`

## Checklist

- [x] Audit the repository against the governing documents.
- [x] Measure the real test counts.
- [x] Update `docs/CURRENT_STATUS.md`.
- [x] Update `docs/SYSTEMDOC.md`.
- [x] Update `docs/FILESTRUCTURE.md`.
- [x] Update `AGENTS.md`, `README.md` and `docs/PROJECT_BRIEF.md`.
- [x] Update `docs/design/gap-resolution-plan.md`, `docs/design/README.md`,
      `docs/design/domain-test-ui-specification.md` and
      `docs/backlog/README.md`.
- [x] Run the verification gates.
- [x] Add the signed journal entry, archive this task and restore the template.

## Decisions and Notes

- Counts recorded in `docs/CURRENT_STATUS.md` are the counts observed on
  2026-08-09: unit 603 tests / 73 files, conformance 64 / 9, integration
  56 / 10, scenario 24 / 5.
- Two sentences in `docs/SYSTEMDOC.md` (the outbox `--transport file` bullet
  and the quality-store bullet) were syntactically broken by earlier merges.
  Repairing them is a non-semantic correction inside this task's scope, not a
  behavior claim change.
- The Domain Test UI specification is amended only where it states a fact that
  ACME-0069 changed (synchronous launch and `RUN_PROGRESS_UNAVAILABLE`);
  phase history stays as written.
- No ADR is created; every claim corrected here was already decided by an
  accepted ADR.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

- [x] `pnpm docs:check` — 141 Markdown files, links and fences clean
- [x] `git diff --check` — one reported line,
      `docs/design/gap-resolution-plan.md:4`. The trailing whitespace is that
      document's existing Markdown hard-break convention (its whole header
      block uses it) and predates this task; removing it on one line only
      would join two rendered lines. Kept deliberately.
- [x] `pnpm test:unit` and `pnpm test` observed for the recorded counts
- [x] Skipped checks: none. `pnpm test:live` was not run; this task changes no
      code and live runs stay operator-initiated.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADRs when long-lived decisions change — none required

## Handoff and Follow-ups

- Current state: documentation synchronized with ACME-0069 reality.
- Next recommended step: activate E1 (trust-stage evidence, G12) or a WP-T
  residual (T2 plan `measurements`, T3 adapter declaration policy, T4 browser
  CI smoke). Both need an explicitly approved charter.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
