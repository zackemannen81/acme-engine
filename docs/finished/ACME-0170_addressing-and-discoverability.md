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

On 2026-08-19 nine backlog proposals were renamed with a `resolved-` prefix to
make resolved items visible in a file listing. Every one already declared its
state in a `Status:` line, so the rename added nothing and broke 39 link
targets in the journal, the task archive, ADR-0049, `CURRENT_STATUS.md`, an
acceptance report and a design plan. Because the journal is append-only and
archived tasks are immutable, repairing those citations was not permitted; the
paths had to be restored.

The repair is complete and recorded in `docs/JOURNAL.md`. What it exposed is
not: the rule it produced — a record's path is its identity, and status lives
in content and indexes — currently exists only inside
`docs/backlog/README.md`, which binds one directory, and inside
`docs/concepts_sandbox/`, which no task may cite as authority. ACME therefore
has no authoritative statement of an invariant it just paid for once.

A measured survey on 2026-08-19 also shows the index side is uneven:

| Collection | Members | Discoverability today |
| --- | --- | --- |
| `docs/adr/` | 52 | Fully indexed |
| `docs/backlog/` | 11 | Fully indexed and mechanically checked |
| `docs/finished/` | 167 | No per-item index, but a deterministic `ACME-NNNN_slug.md` convention |
| `docs/design/` | 12 | Indexed except `first-poc-application-discovery.md` |
| `docs/concepts_sandbox/` | 5 | Indexed except `acme_cm_001_memory_conflict_benchmark.md` |
| `docs/acceptance/` | 4 | No index and no stated convention |
| `docs/poc-1/`, `docs/hrd/`, `docs/paused/` | 3, 1, 0 | Fully indexed |

`docs/finished/` shows that a complete list is not the only valid answer: a
strict naming convention makes 167 archived tasks addressable without one. The
requirement is that a collection is discoverable by one of the two means, not
that every directory carries a list.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make ACME's addressing and discoverability invariant authoritative and
mechanically enforced across every documentation collection, instead of
conventional in one directory.

### Primary Deliverable

An authoritative statement of the invariant in `AGENTS.md`, every
documentation collection made discoverable by an index or a declared naming
convention, and `tooling/docs/check-docs.mjs` extended to enforce both.

### In Scope

- State the invariant in `AGENTS.md` under Documentation Ownership: a record
  cited by append-only or archived documentation keeps its path; status is
  declared in content and in the collection index, never in a filename or a
  location.
- Record the routing consequence in `docs/TASK_WORKFLOW.md`: resolving a
  backlog proposal updates its `Status:` line and its index row; it never
  renames or moves the file.
- Give each collection one declared discoverability mode in its `README.md`:
  index or naming convention.
- Add `docs/acceptance/README.md`, which has neither today.
- Index the two unlisted members in `docs/design/` and
  `docs/concepts_sandbox/`.
- Record in `docs/concepts_sandbox/README.md` that `temp/` is no longer
  temporary: the archived `ACME-0038` cites the mock path, so the file is
  frozen and the directory name is misleading.
- Extend `tooling/docs/check-docs.mjs` from the backlog-only rule to every
  declared collection, honoring both discoverability modes.
- Add a path-stability check: any file that is a link target of a document
  under `docs/finished/`, `docs/JOURNAL.md` or an accepted ADR must not
  change path in the working tree relative to `origin/main`, regardless of
  file type. Source files, fixtures and mocks bind exactly as Markdown does.
- State the forward-looking half in `docs/CONTRIBUTING.md`: material meant to
  be disposable must not be cited by an immutable record. Give it a stable
  path first, or describe it instead of linking it.
- Give CI the history the path-stability check needs. The check compares
  against a base ref, and `actions/checkout` fetches one commit by default.
- Update `docs/FILESTRUCTURE.md` and `docs/CURRENT_STATUS.md` where the
  documentation conventions they describe change.

### Out of Scope

- Renaming, moving, merging or deleting any existing documentation file.
- Rewriting or reflowing existing journal entries, archived tasks or accepted
  ADRs, including to repair historical links.
- Changing the task lifecycle, charter-freeze rules or documentation ownership
  roles themselves.
- Any change to `packages/`, `apps/`, product behavior, contracts or
  persistence.
- Extracting, publishing or acting on the docs-first open-source concept work
  in `docs/concepts_sandbox/`, which remains non-authority.
- Building a general documentation-linting framework. The existing single
  checker script is extended, not replaced.

### Definition of Done

- `AGENTS.md` states the invariant, and a reader can apply it without opening
  `docs/backlog/README.md`.
- Every collection under `docs/` declares exactly one discoverability mode in
  its `README.md`.
- `pnpm docs:check` fails when a collection member is unindexed, when an
  indexed member declares no state, when an index names a file that does not
  exist, and when a record cited by immutable documentation changes path.
- Each new check is negative-tested with a deliberately broken fixture, and the
  fixture is removed before completion.
- `pnpm docs:check`, `pnpm format:check` and `pnpm lint` pass.
- `docs/JOURNAL.md` carries a signed entry and this task is archived.

### Minimum Verification Gates

- [x] `pnpm docs:check` passes
- [x] `pnpm format:check` passes
- [x] `pnpm lint` passes
- [x] `git diff --check` is clean
- [x] Every new check demonstrated to fail on a broken fixture before the
      fixture is removed
- [x] `git log --diff-filter=R` shows no renamed documentation file in this
      task

## References

- `docs/JOURNAL.md`, entry 2026-08-19 "Backlog addressing repaired, and the
  rule it produced"
- [`docs/backlog/README.md`](../backlog/README.md), naming and status rules
- [`tooling/docs/check-docs.mjs`](../../tooling/docs/check-docs.mjs)
- [`docs/finished/README.md`](README.md), the naming-convention
  precedent
- Non-authority background only:
  [`docs/concepts_sandbox/docs-first-open-source-packaging.md`](../concepts_sandbox/docs-first-open-source-packaging.md)
  and
  [`docs/concepts_sandbox/docs-first-extraction-plan.md`](../concepts_sandbox/docs-first-extraction-plan.md)

## Checklist

- [x] Decide the discoverability mode for each collection and record it in the
      collection `README.md`
- [x] Write `docs/acceptance/README.md`
- [x] Write `docs/ops/README.md`, a collection the survey missed until the
      new check reported it
- [x] Index `first-poc-application-discovery.md` in `docs/design/README.md`
- [x] Index `acme_cm_001_memory_conflict_benchmark.md` in
      `docs/concepts_sandbox/README.md`
- [x] Record that `docs/concepts_sandbox/temp/` is frozen, not temporary
- [x] State the invariant in `AGENTS.md`
- [x] State the routing consequence in `docs/TASK_WORKFLOW.md`
- [x] Generalize the backlog check in `tooling/docs/check-docs.mjs` to all
      declared collections
- [x] Implement the path-stability check against `origin/main`, covering all
      cited file types
- [x] Set `fetch-depth: 0` on the CI checkout so the check can run there
- [x] State the disposable-artifact rule in `docs/CONTRIBUTING.md`
- [x] Negative-test every new check, then remove the fixtures
- [x] Update `docs/FILESTRUCTURE.md` and `docs/CURRENT_STATUS.md` if conventions
      change
- [x] Run the verification gates
- [x] Add a signed `docs/JOURNAL.md` entry and archive this task

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- This charter is forward-looking. The backlog repair that motivated it is
  already complete and recorded in `docs/JOURNAL.md` as work carried out
  without a task, following the precedent of the 2026-08-10 hrd entry. No
  charter is backdated over finished work.
- Two discoverability modes are accepted deliberately. `docs/finished/` proves
  that a deterministic naming convention is sufficient for a large archive, and
  forcing a 167-row index would add maintenance cost without adding retrieval
  value.
- The path-stability check compares against `origin/main` rather than the
  previous commit, so that a rename cannot pass by being split across two
  commits inside one branch.
- Decided 2026-08-19: the invariant binds by citation, not by file type. A
  citation graph survey found six non-Markdown link targets, five of them
  source and test files cited by `docs/acceptance/` evidence, where a silent
  rename would leave a frozen acceptance report pointing at nothing.
- `docs/concepts_sandbox/temp/` is already frozen in practice. The archived
  `ACME-0038` names the mock path, so it became immutable on 2026-08-02.
  Binding by citation adds nothing to the file tree; it makes an existing
  invisible constraint visible, which is the purpose of the invariant.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] `pnpm docs:check` — 309 files, 0 errors
- [x] `pnpm format:check` — clean across the repository
- [x] `pnpm lint` — clean across the repository
- [x] `git diff --check` — clean
- [x] `git diff --find-renames --diff-filter=R HEAD` — empty; this task renamed
      nothing
- [x] Broken-fixture demonstration for each new check, all five reverted:
  - unindexed member: a probe file added to the operations collection was
    reported as not listed
  - missing state: a probe proposal without a `Status:` line was reported
  - naming violation: a probe file in the archive was reported against
    `ACME-NNNN_task-slug.md`
  - undeclared collection: `docs/zz-collection/` reported as missing a README
    declaration
  - path stability: renaming `docs/backlog/postgres-gate-test-hygiene.md`
    reported 11 citing immutable records, including `docs/JOURNAL.md`,
    `docs/acceptance/poc-1-reusable-execution-proof.md` and
    `docs/finished/ACME-0153_v2-authentication-and-authorization.md`
- [x] No checks skipped. The path-stability check degrades to a printed skip
      when no base ref resolves; CI now fetches full history so it runs there.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `docs/TASK_WORKFLOW.md`
- [x] `docs/CONTRIBUTING.md`
- [x] Collection `README.md` files
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] `docs/ops/README.md`, `docs/acceptance/README.md`
- [x] No ADR. The invariant constrains documentation practice, not a
      public contract, persistence or migration path. Recorded as a
      decision here and in `AGENTS.md`.

## Handoff and Follow-ups

- Current state: Complete. The invariant is authoritative in `AGENTS.md`, the
  routing consequence is in `docs/TASK_WORKFLOW.md`, the practice rule is in
  `docs/CONTRIBUTING.md`, all ten collections declare a discoverability mode
  and `pnpm docs:check` enforces declarations, index completeness, member
  state, naming conventions and path stability.
- Next recommended step: activate
  `docs/backlog/prose-path-citations-unchecked.md`. Paths cited as backticked
  prose are still invisible to the checker; the Domain Test UI mock is
  referenced five times and never as a link.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: `docs/presentations/` holds two `.docx` files and no
  Markdown, so the implemented rule treats it as an asset directory and
  requires no index. Whether asset directories should be indexed as well is
  unanswered and was left outside this charter.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
