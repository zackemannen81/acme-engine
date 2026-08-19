# Current Task

Task ID: ACME-0170
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-19
Last updated: 2026-08-19
Charter frozen at: 2026-08-19

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
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Activated from
[`docs/backlog/prose-path-citations-unchecked.md`](../backlog/prose-path-citations-unchecked.md),
proposed 2026-08-19 while scoping ACME-0169.

`pnpm docs:check` validates Markdown link targets. It does not see a path
written as backticked prose, and much of ACME's documentation cites files that
way. The Domain Test UI mock is referenced from the normative Test UI
specification, `docs/CURRENT_STATUS.md`, `docs/FILESTRUCTURE.md`, a backlog
proposal and the archived `ACME-0038` — five times, never once as a link. If
that file were renamed or deleted today, the check would stay green and all
five references would rot silently.

ACME-0169 closed the loud failure: a renamed record cited by a link now fails
the build. This task closes the quiet one, where a normative document keeps
naming a path that no longer exists.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make stale repository paths cited as prose fail the documentation check on the
surfaces that describe the present, without touching the records that describe
the past.

### Primary Deliverable

A prose-citation check in `tooling/docs/check-docs.mjs` that validates
repository-relative paths written as inline code on a declared set of
present-tense surfaces.

### In Scope

- Recognize a prose citation as a candidate only when the inline-code span
  contains a path separator and a file extension, so that `packages/core` and
  ordinary prose remain unaffected.
- Validate candidates in present-tense surfaces: `AGENTS.md`, `docs/design/`,
  `docs/ops/`, `docs/acceptance/`, `docs/CURRENT_STATUS.md`,
  `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md`, `docs/CURRENT_TASK.md` and
  collection `README.md` files.
- Report, without failing the build, a stale citation inside
  `docs/JOURNAL.md`, `docs/finished/` and `docs/adr/`. Those records state
  what was true when written and legitimately name paths that are now gone,
  so the finding is information for a reader, never a gate.
- Resolve a candidate from the repository root and, where that fails, relative
  to the citing file.
- Repair or annotate every genuine stale citation the new check reports.
- Record the surface split in `AGENTS.md` beside the addressing invariant, so
  a contributor knows which documents are validated.

### Out of Scope

- Rewriting, reflowing or repairing citations inside `docs/JOURNAL.md`,
  `docs/finished/` or accepted ADRs. Those records may not be edited.
- Converting existing prose citations into Markdown links wholesale.
- Renaming, moving or deleting any file to satisfy a stale citation.
- Validating prose citations of directories, globs, package names or code
  identifiers.
- Any change to `packages/`, `apps/`, product behavior, contracts or
  persistence.
- Extending the check to non-Markdown documents or to asset directories such
  as `docs/presentations/`.

### Definition of Done

- `pnpm docs:check` fails on a stale prose citation in a present-tense
  surface, and reports the same citation inside `docs/JOURNAL.md` as a
  warning while still exiting zero.
- Every stale citation the check finds in the current tree is either repaired
  or, where the target is genuinely gone and the sentence is historical, the
  sentence is rewritten to stop naming a path.
- `AGENTS.md` states which surfaces are validated and why history is exempt.
- The check is negative-tested with a deliberately broken fixture in a
  validated surface, which fails, and with the same fixture in an exempt
  surface, which warns and passes. Both fixtures are removed.
- `pnpm docs:check`, `pnpm format:check` and `pnpm lint` pass.
- `docs/JOURNAL.md` has a signed entry and this task is archived.

### Minimum Verification Gates

- [x] `pnpm docs:check` passes
- [x] `pnpm format:check` passes
- [x] `pnpm lint` passes
- [x] `git diff --check` is clean
- [x] Negative test in a validated surface fails the check
- [x] The same negative test in an exempt surface warns and still exits zero
- [x] `git diff --find-renames --diff-filter=R` shows no renamed file

## References

- [`docs/backlog/prose-path-citations-unchecked.md`](../backlog/prose-path-citations-unchecked.md)
- [`docs/finished/ACME-0169_addressing-and-discoverability.md`](ACME-0169_addressing-and-discoverability.md)
- [`tooling/docs/check-docs.mjs`](../../tooling/docs/check-docs.mjs)
- [`AGENTS.md`](../../AGENTS.md), Addressing and Discoverability

## Checklist

- [x] Implement candidate recognition for inline-code paths
- [x] Implement the validated and exempt surface split
- [x] Run the check over the current tree and triage every finding
- [x] Repair the genuine stale citations
- [x] Record the surface split in `AGENTS.md`
- [x] Negative-test both the validated and the exempt case, then remove the
      fixtures
- [x] Update `docs/backlog/prose-path-citations-unchecked.md` to record its
      resolution in place
- [x] Run the verification gates
- [x] Add a signed `docs/JOURNAL.md` entry and archive this task

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- The surface split is the whole design. Enforcing prose paths everywhere
  would fail immediately on history: `docs/JOURNAL.md` deliberately names the
  removed `hrd` directories and the proposals closed by ACME-0029 and
  ACME-0030, and satisfying the check there would require editing records that
  must not be edited.
- Expect false positives on the first run. Triage is part of the task: a
  candidate that is not really a repository path is a reason to tighten
  recognition, not a reason to edit the document.
- Warnings on exempt records are deliberate. Silence would hide real rot in
  history from a reader who is trying to follow it, and failing would force
  edits to records that may not be edited. A warning is the only honest
  position between those two.
- The backlog proposal keeps its path when this task closes. Its `Status:`
  line and its index row carry the resolution, per the ACME-0169 invariant.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] `pnpm docs:check` — 310 files, 0 errors, 30 warnings in history
- [x] `pnpm format:check` — clean across the repository
- [x] `pnpm lint` — clean across the repository
- [x] `git diff --check` — clean
- [x] `git diff --find-renames --diff-filter=R HEAD` — empty
- [x] Validated surface: a probe citation of a non-existent file added to
      `docs/ops/README.md` failed the check with exit 1. Reverted.
- [x] Exempt surface: the same probe added to `docs/adr/README.md` was
      reported as a warning and the check exited 0. Reverted.
- [x] Purpose test: moving the Domain Test UI mock out of the tree failed the
      check from the normative Test UI specification that cites it, which is
      the silent rot this task existed to close. Restored.
- [x] No checks skipped.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `docs/backlog/prose-path-citations-unchecked.md`
- [x] `docs/backlog/README.md`
- [x] `docs/CURRENT_STATUS.md` if any repaired citation changes stated reality
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] `AGENTS.md`, `docs/FILESTRUCTURE.md`,
      `docs/backlog/prose-path-citations-unchecked.md`,
      `docs/backlog/README.md`
- [x] No ADR. The surface split constrains documentation practice, not a
      contract, persistence or migration path.
- [x] `docs/CURRENT_STATUS.md` unchanged: no repaired citation changed
      stated reality, because no present-tense surface held a stale one.

## Handoff and Follow-ups

- Current state: Complete. `pnpm docs:check` validates inline-code repository
  paths on the present-tense surfaces and warns on history.
- Measured result: the current tree holds no stale citation in any validated
  surface. The 30 warnings are all in `docs/JOURNAL.md` and `docs/finished/`,
  and every one names a file that was genuinely removed — proposals closed by
  ACME-0029 and ACME-0030, resumed paused tasks, and the `hrd` artifacts. They
  are correct history and must stay.
- Recognition boundaries, all deliberate and documented in `AGENTS.md`: a
  candidate must start at a real top-level entry and end in an extension
  beginning with a letter. That excludes package-relative fragments such as
  `src/extract.ts`, contract identifiers such as `acme-test-plan/1`, and
  package versions such as `pdfjs-dist/6.2.108`, each of which produced a
  false positive on the first run.
- Known boundary: exemption wins over the collection-index rule, so
  `docs/adr/README.md` and `docs/finished/README.md` are exempt from prose
  validation. Their completeness is enforced by the collection check and their
  links by the link check.
- Backlog proposals and `docs/concepts_sandbox/` are outside both lists, so
  their prose citations are unchecked. That follows the frozen charter and can
  be revisited if it ever matters.
- Next recommended step: none required. `docs/CURRENT_TASK.md` is restored to
  the template.
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
