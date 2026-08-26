# Current Task

Task ID: ACME-0173
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
- Non-authoritative input only: `docs/concepts_sandbox/docs-first-extraction-plan.md`

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Stand up `docs-first_continuity-protocol` as an independent repository holding a
frozen, provable copy of ACME's docs-first model, and running that model on
itself from its first commit.

The repository exists and is empty and private at
`https://github.com/zackemannen81/docs-first_continuity-protocol`, cloned to
`C:\code\docs-first_continuity-protocol`. Its local branch is already `main` and
the first push makes that the default branch, so no rename is required.

This task activates the concept work in
`docs/concepts_sandbox/docs-first-extraction-plan.md`, which remains
non-authoritative. The plan's milestones M0 and part of M5 are in scope. The
specification, templates, validator, profiles and evidence report are not: they
belong to the new repository's own tasks, written under its own workflow.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Produce a frozen, verifiable baseline of ACME's docs-first model in a separate
repository that already operates the model on itself, without changing ACME's
workflow and without making ACME depend on the result.

### Primary Deliverable

The first commits of `docs-first_continuity-protocol`: a verbatim baseline with
provenance, an extraction ledger, and a working docs-first instance that passes
the technician test on itself.

### In Scope

- Tag the ACME source revision as `protocol-baseline-2026-08-19` so the baseline
  is provable rather than asserted.
- Copy the ACME workflow documents named in the extraction plan into
  `baseline/acme-2026-08-19/` verbatim, preserving relative paths, with a
  provenance README recording source repository, revision, date, copier and the
  rule that the tree is never edited again.
- Verify the copy byte for byte against the tagged revision and record the
  command that proves it.
- Create `extraction/ledger.md` with the three-way CORE, PROFILE and PROJECT
  classification and the rows already established by the concept work,
  including the four rules that were added after observed failures rather than
  taken from the baseline.
- Bootstrap the new repository's own docs-first instance: entry point, active
  task, task workflow, project brief, contributing, current status, system
  document, journal, file structure, identity register, and README stubs for
  decisions, backlog, paused, finished and the concepts sandbox.
- Choose the new repository's task identity prefix. It must not encode the
  undecided product name: identities cannot be renamed once cited, so a prefix
  tied to a brand would have to survive a rename it cannot survive.
- Charter the new repository's own first task under its own workflow, claim its
  identity in its own register, and leave it ready for the next actor.
- Record in ACME: a journal entry and an index note that the extraction has
  begun. ACME's normative documents are otherwise untouched.
- On completion, restore `docs/CURRENT_TASK.md` to the content `main` holds
  rather than to the template. `main`'s active-task slot carries another
  actor's in-progress ACME-0169 charter, and this branch does not own it.

### Out of Scope

- Writing the protocol specification, the numbered requirements, the templates,
  the validator, the profiles, the case studies or the evidence report. Those
  are the new repository's own tasks.
- Selecting the project name, the license or any trademark position.
- Making the repository public, announcing it, or describing it as open source.
  It has no license yet, so it is not open source yet.
- Publishing private journal content, client material, personal data or
  case-study source material.
- Changing ACME's workflow, guardrails, tooling or documentation ownership.
- Creating any dependency from ACME on the new repository. The relation is one
  way.
- Any change to `packages/`, `apps/`, contracts, persistence or product
  behavior.

### Definition of Done

- The ACME baseline revision is tagged and the tag is pushed.
- `baseline/acme-2026-08-19/` in the new repository is byte-identical to that
  revision, proven by a recorded command rather than by assertion.
- `extraction/ledger.md` exists and classifies every copied rule group.
- The new repository runs the model on itself: it has an active task, a journal
  entry, a current status, an identity register with its first claim, and an
  entry point naming the reading order.
- The technician test passes on the new repository: a competent stranger can
  name the active task, the document owning each truth, what exists now and the
  next action, using the repository alone.
- The new repository's default branch is `main` and it remains private.
- ACME has a signed journal entry, this task is archived, and ACME gained no
  dependency on the new repository.
- `docs/CURRENT_TASK.md` on this branch matches `main`, so merging changes
  nobody else's active task.

### Minimum Verification Gates

- [x] `pnpm docs:check`, `pnpm format:check`, `pnpm lint` pass in ACME
- [x] `git diff --check` clean in both repositories
- [x] `git diff --no-index` between the tagged ACME documents and the copied
      baseline reports no difference
- [x] Manual link and fence review in the new repository, which has no tooling
      of its own yet
- [x] Technician-test checklist answered in writing for the new repository

## References

- [`docs/concepts_sandbox/docs-first-extraction-plan.md`](../concepts_sandbox/docs-first-extraction-plan.md), non-authority
- [`docs/concepts_sandbox/docs-first-open-source-packaging.md`](../concepts_sandbox/docs-first-open-source-packaging.md), non-authority
- [`docs/TASK_IDS.md`](../TASK_IDS.md)
- [`AGENTS.md`](../../AGENTS.md)

## Checklist

- [x] Tag and push `protocol-baseline-2026-08-19`
- [x] Copy the baseline documents verbatim and write the provenance README
- [x] Prove the copy byte for byte and record the command
- [x] Write `extraction/ledger.md`
- [x] Decide the task identity prefix and record the reasoning
- [x] Bootstrap the new repository's docs-first instance
- [x] Charter the new repository's first task and claim its identity
- [x] Push `main` to the new repository and confirm it is the default branch
- [x] Answer the technician-test checklist in writing
- [x] Update ACME's journal and concepts index
- [x] Restore `docs/CURRENT_TASK.md` to `main`'s content, not the template
- [x] Run the verification gates and archive this task

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Extraction is transcription, not redesign. The value of the ACME workflow is
  in rules added after observed failures, and a generalization pass written from
  memory would keep the parts that read well and silently drop the failure
  knowledge. Copy first, classify second, generalize only project identity.
- The baseline must be provable. A copy nobody can verify against a tagged
  revision is a claim, not evidence, and this repository does not ship claims.
- The new repository self-hosts from its first commit. That gives the first
  conformance test, a permanently maintained example, and immediate
  falsification of any rule that turns out to be unusable.
- The identity prefix must not carry the product name. ACME-0170 made paths and
  identities immutable once cited; a prefix encoding an undecided brand would
  need a rename that the invariant forbids.
- The repository stays private and unlicensed in this task. Calling something
  open source before it has an OSI-approved license is inaccurate, and the
  license choice needs review this charter does not authorize.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] ACME gates: `pnpm docs:check` 313 files 0 errors, `pnpm format:check`
      clean, `pnpm lint` clean, `git diff --check` clean
- [x] Byte-identity proof: all fifteen copied files compared by SHA-256 against
      `git show protocol-baseline-2026-08-19:<path>`; all matched
- [x] Manual link and fence review in the new repository: sixteen own documents
      plus the ledger, zero problems
- [x] Technician-test checklist answered in writing at
      `docs/concepts_sandbox/bootstrap-technician-test.md` in the new
      repository, including its own weaknesses
- [x] Skipped checks: the new repository has no tooling, so its verification is
      manual review. Twenty-two links inside `baseline/` do not resolve and are
      recorded as correct rather than repaired, because repairing them would
      mean editing the frozen tree.

## Documentation Updates

- [x] `docs/JOURNAL.md`
- [x] `docs/concepts_sandbox/README.md`, noting that extraction has begun
- [x] `docs/TASK_IDS.md`, already claimed
- [x] `docs/CURRENT_STATUS.md` only if ACME's own reality changes, which it
      should not
- [x] No ADR: this created no ACME contract, dependency or migration path

## Handoff and Follow-ups

- Current state: Complete. `docs-first_continuity-protocol` exists at commit
  `3e38ffa`, private, default branch `main`, holding the verified baseline, the
  extraction ledger and its own operating docs-first instance.
- Baseline: tag `protocol-baseline-2026-08-19` points at
  `75e4b5ee72201d02ad57f22b1a5fcfb3244d521e` and is pushed, so the copy stays
  provable rather than asserted.
- Identity prefix: `DFC`, encoding the descriptive method rather than a brand,
  because the name is undecided and an identity cannot be renamed once cited.
- Deliberate omissions from the baseline, recorded in its provenance: the
  source repository's active charter, which holds another contributor's
  in-progress work; `docs/JOURNAL.md`, because 6500 lines of client, product
  and personal material must never be copied raw; and the project's status,
  architecture, brief and decisions, because the model is the workflow rather
  than the product it was used on.
- Honesty carried forward: four of the rules being extracted are hours old
  rather than months. The ledger marks them and the new repository's status
  document repeats it, so the evidence report cannot silently treat them as
  equally proven.
- Next step, in the new repository: DFC-0001 writes `SPEC.md` from the CORE
  rows. It is `Draft` and unassigned; its identity must be claimed on that
  repository's `main` before the charter freezes.
- `docs/CURRENT_TASK.md` is restored to `main`'s content rather than the
  template, because that slot holds Felix's in-progress ACME-0169 charter and
  this branch does not own it.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none inside this charter. The name, license and publication
  timing remain open in the new repository's brief.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
