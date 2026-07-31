# Current Task

Task ID: ACME-0024
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-07-31
Last updated: 2026-07-31
Charter frozen at: 2026-07-31

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
- `docs/backlog/domain-test-ui-implementation.md`
- `docs/finished/ACME-0021_durable-sqlite-persistence.md`
- `docs/finished/ACME-0022_research-module-observe-evidence.md`
- `docs/finished/ACME-0023_research-offline-acceptance-scenario.md`

## Task Summary

ACME-0021, ACME-0022 and ACME-0023 delivered durable SQLite persistence,
ResearchModule and the Research acceptance scenario, but the governing
entry-point documents still describe a repository where none of that exists.
`AGENTS.md` is the file every new contributor reads first and it is two tasks
behind. A sweep found six stale locations across four documents. This task
makes the governing documents describe the repository that exists, and records
one verified gap discovered while planning the live-provider work.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Make every current-facing governing document agree with the merged repository
after ACME-0023.

### Primary Deliverable

One reviewed documentation change that corrects each identified stale claim,
records the retention gap as a persistent caveat, and files the remaining
follow-ups as backlog proposals.

### In Scope

- `AGENTS.md` current-phase claim that durable persistence and ResearchModule
  do not exist.
- `README.md` claim that no durable persistence adapter or Research reference
  module exists.
- `docs/PROJECT_BRIEF.md` "Next Deliverable" claim that ResearchModule and
  durable SQLite persistence remain separate deliverables.
- `docs/CURRENT_STATUS.md` residual present-tense claims that Research
  implementation remains a separate task and that the Domain Test UI
  prerequisites do not exist.
- `docs/FILESTRUCTURE.md` claim that the Domain Test UI readiness
  prerequisites are unimplemented.
- `docs/backlog/domain-test-ui-implementation.md` prerequisite list, which
  names `@acme/adapter-sqlite` as non-existent.
- Record in `docs/CURRENT_STATUS.md` the verified gap that
  `retention: 'encrypted-payload'` performs no encryption, and that
  `hash-only` makes replay unavailable.
- File a backlog proposal for closing that retention gap.
- A dated signed `docs/JOURNAL.md` entry.

### Out of Scope

- Any runtime, contract, adapter, module or test behavior change.
- Implementing encryption, the live provider adapter, ScenarioRunner or the
  CLI composition root.
- Resolving the Domain Test UI decision gates; this task only stops
  misdescribing its prerequisites.
- Rewriting dated `docs/JOURNAL.md` entries that were accurate when recorded.
- Commits, pushes or remote mutations beyond what the user explicitly asks
  for.

### Definition of Done

- No governing document claims that durable persistence, ResearchModule or the
  Research acceptance scenario is missing.
- The Domain Test UI prerequisite lists name only what is genuinely still
  missing.
- `docs/CURRENT_STATUS.md` records the retention gap in its own words, without
  overstating it as a vulnerability in delivered behavior.
- A backlog proposal exists for closing the retention gap.
- A repeat of the discovery sweep returns no remaining stale existence claim.
- All frozen verification gates pass, or every skipped check is recorded with
  its reason.
- The task is archived under `docs/finished/` and `docs/CURRENT_TASK.md` is
  restored or repopulated.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm build`
- [x] repeat of the stale-claim sweep
- [x] `git diff --check`

## References

- `AGENTS.md`
- `README.md`
- `docs/PROJECT_BRIEF.md`
- `docs/backlog/domain-test-ui-implementation.md`
- `packages/adapter-sqlite/src/repository.ts` retention handling
- `packages/adapter-memory/src/repository.ts` retention handling

## Checklist

- [x] Read the required documents in order.
- [x] Correct `AGENTS.md`.
- [x] Correct `README.md`.
- [x] Correct `docs/PROJECT_BRIEF.md`.
- [x] Correct the residual claims in `docs/CURRENT_STATUS.md`.
- [x] Correct `docs/FILESTRUCTURE.md`.
- [x] Correct the backlog prerequisite list.
- [x] Record the retention gap and file its backlog proposal.
- [x] Repeat the sweep and confirm nothing stale remains.
- [x] Run every frozen verification gate and record evidence.
- [x] Add the signed journal entry.
- [x] Archive ACME-0024 and restore or repopulate `docs/CURRENT_TASK.md`.

## Decisions and Notes

- This is a documentation-reality task in the ACME-0016 and ACME-0020
  tradition. Code is authoritative when prose and code disagree.
- Historical per-task paragraphs stay; only present-tense claims that are now
  false are corrected, and they are corrected in place rather than deleted.
- The retention gap was verified by reading both adapters: with
  `retention: 'encrypted-payload'` the full `NormalizedModelResponse` is stored
  as-is and `protectedResponse` is a caller-supplied field nothing populates.
  It is a naming and future-privacy gap, not a defect in any delivered
  behavior, because every retained payload so far is a test fixture.
- The gap matters now because the agreed next deliverable sends real provider
  data. It is recorded so the live-provider ADR must confront it rather than
  discover it.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- None.

## Verification

- [x] Re-run the discovery sweep and show it returns nothing stale.
- [x] Confirm no file outside documentation changed.
- [x] Record exact test counts for every gate.
- [x] Document skipped checks and reasons.

Verification completed on 2026-07-31:

- The discovery sweep was repeated. Its only remaining hits are true
  statements about the live provider adapter, ScenarioRunner and the CLI
  composition root, none of which exist.
- `pnpm docs:check` passed for 60 Markdown files.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
- `pnpm boundaries` passed dependency, core-vocabulary and the
  core/module/cross-module/SQLite-driver forbidden fixtures.
- `pnpm test:unit` passed 243 tests in 33 files.
- `pnpm test:conformance` passed 41 tests in 6 files.
- `pnpm test:integration` passed 13 tests in 2 files.
- `pnpm test:scenario` passed 5 tests in 2 files.
- `git diff --check` passed.
- `git status` confirms every change is under `AGENTS.md`, `README.md` or
  `docs/`. No source, test or configuration file changed, and the unchanged
  test counts confirm it.
- Skipped checks: none.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `README.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/backlog/`
- [x] `docs/JOURNAL.md`
- [x] No ADR change; the retention decision belongs to the live-provider ADR.

## Handoff and Follow-ups

- Current state: ACME-0024 is complete. Every governing document now describes
  the repository that exists, and the retention gap is recorded rather than
  latent. Every frozen gate passed.
- Next recommended step: The agreed order puts the live provider boundary
  next: an ADR plus a fixture-driven adapter with injected transport, so the
  whole provider mapping is testable offline. That ADR must decide the
  retention question recorded in `docs/CURRENT_STATUS.md` and must define what
  produces the `ambiguous` model-call status.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
