# ACME-0052 — Browser Fixture Review

Task ID: ACME-0052
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-05
Last updated: 2026-08-05
Charter frozen at: 2026-08-05

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0019-domain-test-ui-boundary-and-view-contracts.md`
- `docs/adr/0021-interface-workspace-and-launch-boundary.md`
- `docs/adr/0022-measurement-and-fixture-approval.md`
- `docs/adr/0024-local-spa-loopback-workbench.md`

## Task Summary

Render the already-delivered `acme-view-fixture-review/1` contract as S9 in
the local loopback workbench. A developer should be able to stage one explicit
fixture-change proposal, review its recorded provenance and digest change,
then approve or reject it with a named reviewer and rationale. The resulting
workspace approval describes a repository edit; it never applies that edit.

## Task Charter

The charter is editable while status is `Draft` and immutable once the task
reaches `Ready`.

### Goal

Make proposed golden-fixture changes and deliberate human decisions
inspectable and auditable in the local browser without allowing the interface
to author or modify a golden.

### Primary Deliverable

A pure S9 HTML renderer plus loopback HTML/JSON review routes and one
CSRF-protected decision route over the existing `buildFixtureReviewView`,
`decideFixtureChange` and workspace approval boundary.

### In Scope

- Pure S9 HTML rendering from `acme-view-fixture-review/1`.
- Request-local staging of one complete proposal: safe proposal id, relative
  fixture path, expected/proposed digests, run id and execution id.
- Source-check that the named run is a readable workspace record and the
  execution id belongs to one of its cases.
- `GET /s9` HTML and `GET /api/fixture-review` JSON routes over stored
  approvals plus the optional staged proposal.
- Reconstruction of decided proposal history from approval records, which
  already retain every proposal field.
- `POST /s9/decision` for `approved | rejected`, requiring existing
  approver/rationale rules, a bounded form body, per-process CSRF token and
  same-server request proof.
- Append-once browser semantics: a decided proposal id, a conflicting proposal
  with the same id, a matching unreadable approval file or an in-flight
  decision is refused rather than overwritten.
- Explicit pending, approved, rejected, unreadable and `applied: false`
  presentation, including the existing human repository-edit instruction.
- Health-contract registration and removal of the S9 stub.
- Focused unit, HTTP integration and browser verification.
- Governing status, system, structure, specification, backlog and journal
  documentation.

### Out of Scope

- Writing, editing, renaming or deleting any fixture or scenario file.
- Automatically applying an approved change or promoting a digest.
- Persisting proposals separately; only approval records remain workspace
  artifacts under ADR-0022.
- Inferring proposals, paths or digests from human-readable failure messages.
- Discovering fixture diffs, computing digests or validating that supplied
  digests match file contents.
- Changing, replacing or deleting an existing approval decision.
- Batch decisions, automatic acceptance, approval thresholds or anonymous
  decisions.
- Rendering S10 or adding live browser controls.
- Provider calls, authentication, remote hosting, deployment or publication.
- Core, module, adapter, CLI, ledger or canonical execution changes.

### Definition of Done

- `/s9` renders `acme-view-fixture-review/1`; `/api/fixture-review` returns the
  same view for the same request-local proposal and stored approval evidence.
- A proposal is staged only when all fields are supplied, its id/path are
  safe, its digests differ and its run/execution provenance exists in the
  current workspace.
- Pending remains distinct from acceptance and exposes approve/reject controls
  only with named approver and non-empty rationale fields.
- A successful decision is built only by `decideFixtureChange`, stored only by
  `Workspace.recordApproval` and rendered after a same-proposal redirect.
- Existing, conflicting, unreadable or concurrent decisions cannot be
  overwritten through the browser.
- Every decided card shows reviewer, rationale, time, repository-edit
  instruction and `applied: false`; no route reads or writes the fixture.
- Stored unreadable approval filenames remain visible rather than skipped.
- Existing S1–S8 behavior and every repository verification gate remain green.
- Long-lived docs reflect S1–S9 as rendered surfaces and name S10 as the
  remaining stub.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm docs:check`
- [x] `pnpm build`
- [x] `git diff --check`
- [x] Browser verification of pending → decided history, fixture unchanged,
      responsive layout and error-overlay state

## References

- `apps/test-ui/src/fixture-approval.ts`
- `apps/test-ui/src/read-model/fixture-review.ts`
- `apps/test-ui/src/local/workspace.ts`
- `apps/test-ui/src/local/server.ts`
- `apps/test-ui/src/web/`
- `apps/test-ui/test/measurement.test.ts`
- `apps/test-ui/test/web-render.test.ts`
- `tests/integration/test-ui-launch.test.ts`
- `tests/integration/test-ui-workbench.test.ts`
- `docs/design/domain-test-ui-specification.md`
- `docs/backlog/domain-test-ui-implementation.md`

## Checklist

- [x] Confirm S8 is committed, pushed and the worktree is clean.
- [x] Review the governing workflow, S9 contract, workspace boundary and ADRs.
- [x] Review the Draft, move it through `Ready`, freeze it and start work.
- [x] Add and export the pure S9 renderer.
- [x] Compose validated request-local proposals and stored approval history.
- [x] Add protected decision persistence with overwrite refusal.
- [x] Add S9 HTML/JSON routes, health registration and remove the S9 stub.
- [x] Add renderer and HTTP integration coverage.
- [x] Run browser verification over pending and decided S9 states.
- [x] Run every minimum verification gate.
- [x] Synchronize governing documentation.
- [x] Archive the completed task and restore the empty current-task template.

## Decisions and Notes

- 2026-08-05: the reviewed Draft moved through `Ready` to `In Progress`; the
  Task Charter and Minimum Verification Gates above are frozen.
- ADR-0022 deliberately stores approvals but not proposals. S9 therefore
  accepts one proposal request-locally and reconstructs decided history from
  approval records, which already contain the complete proposal fields.
- The route checks run/execution linkage through the interface workspace. It
  does not parse a failure message or claim that supplied fixture digests were
  independently verified.
- Browser decisions are append-once even though the low-level workspace port
  can write a named approval file. This prevents the visual review surface
  from silently rewriting its own audit history.
- No new ADR is expected: this is an ADR-0024 follow-up preserving ADR-0021
  storage and ADR-0022 approval semantics.

## Charter Amendment Log

- None.

## Verification

- [x] Focused renderer and workbench integration tests: 29 tests passed across
      `web-render.test.ts` and `test-ui-workbench.test.ts`; package typecheck
      passed.
- [x] Full repository gates listed above.
- [x] Manual browser verification with no live provider call: pending proposal
      → explicit rejection → decided history at 622 px, no horizontal overflow
      or error overlay, fixture SHA-256 unchanged.
- `pnpm test:unit`: 543 tests / 60 files passed.
- `pnpm test:conformance`: 58 tests / 7 files passed.
- `pnpm test:integration`: 53 tests / 8 files passed.
- `pnpm test:scenario`: 21 tests / 4 files passed.
- `pnpm docs:check`: 118 Markdown files passed before archive; rerun after
  archive passed 119 files.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
  `pnpm build` and `git diff --check` passed.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `README.md` if its current-objective summary changes
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/backlog/README.md`
- [x] `docs/backlog/domain-test-ui-implementation.md`
- [x] `docs/design/README.md`
- [x] `docs/design/domain-test-ui-specification.md`
- [x] ADRs if implementation changes a long-lived decision — no ADR required;
      implementation stays within ADR-0021, ADR-0022 and ADR-0024.

## Handoff and Follow-ups

- Current state: complete and ready to archive.
- Next recommended step: charter S10 live evaluation separately if approved.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none that block the bounded charter.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0052_browser-fixture-review.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
