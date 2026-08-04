# ACME-0048 — Browser Memory Decisions

Task ID: ACME-0048
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-04
Last updated: 2026-08-04
Charter frozen at: 2026-08-04

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
- `docs/adr/0024-local-spa-loopback-workbench.md`

## Task Summary

Render the already-delivered `acme-view-memory-decisions/1` contract as S5 in
the loopback workbench. From a durable S4 execution, a developer should be able
to follow each recorded memory candidate through the domain-owned decision to
its prepared mutation, including ignored candidates and unavailable evidence,
without exposing payloads or mutating memory.

## Task Charter

The charter is editable while status is `Draft` and immutable once the task
reaches `Ready`.

### Goal

Make the recorded candidate → decision → mutation chain inspectable and
auditable in the local browser workbench.

### Primary Deliverable

A pure S5 HTML renderer plus read-only loopback HTML/JSON routes over the
existing `buildMemoryDecisionsView` and durable replay evidence, linked from
S4 for the same execution.

### In Scope

- Pure S5 HTML rendering from `acme-view-memory-decisions/1`.
- Ordered decision cards showing candidate identity and provenance, domain
  action/disposition/reason, applied status, affected memory ids and correlated
  prepared mutations.
- Explicit counts, ignored candidates, missing candidates, unattributed
  mutations and unavailable prepared-commit evidence.
- Default-redacted candidate and mutation payload presentation; no reveal
  control.
- `GET /s5?executionId=...` HTML and
  `GET /api/memory-decisions?executionId=...` JSON routes.
- Durable evidence loading through the configured SQLite repository's existing
  `loadReplayEvidence`; no direct database reads from render code.
- A contextual S4 link to S5 carrying the same execution id.
- Honest guidance/refusal pages for a missing execution id, absent ledger or
  unknown execution.
- Focused unit, HTTP integration and browser verification.
- Governing status, system, structure, specification, backlog and journal
  documentation.

### Out of Scope

- New memory view fields, decision rules, correlation semantics or redaction
  modes.
- Revealing payloads, decrypting content through the browser or adding reveal
  authorization controls.
- Listing/searching all canonical memory records or comparing executions.
- Writing, editing, approving, forgetting, reinforcing or deleting memory.
- Rendering S6–S10 or changing S1–S3 behavior.
- Live provider calls, remote hosting, authentication, deployment or package
  publication.
- Core, module, adapter, CLI, persistence or canonical execution changes.

### Definition of Done

- S4 links a durable execution to `/s5` with the exact execution id.
- `/s5` renders the S5 contract version, exact execution id and recorded
  candidate/decision/mutation counts without recomputing them.
- Decision order is preserved; ignored decisions and domain reasons stay
  visible; correlated mutations remain attached to their owning decision.
- Candidate and mutation values remain redacted by default and no browser
  route can request disclosure.
- Missing prepared commit/candidate evidence and unattributed mutations are
  shown explicitly rather than hidden or rendered as successful emptiness.
- `/api/memory-decisions` returns the same view contract used by HTML.
- Missing id, missing ledger and unknown execution states are honest and do
  not mutate or query outside the configured repository.
- Existing S1–S4 behavior and every repository verification gate remain green.
- Long-lived docs reflect S1–S5 as rendered surfaces and name S6–S10 as the
  remaining stubs.

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
- [x] Browser verification of S4→S5 navigation, decision evidence,
      redaction, responsive layout and error-overlay/console state

## References

- `apps/test-ui/src/read-model/memory.ts`
- `apps/test-ui/src/local/server.ts`
- `apps/test-ui/src/web/render-execution.ts`
- `apps/test-ui/src/web/`
- `apps/test-ui/test/read-model.test.ts`
- `apps/test-ui/test/web-render.test.ts`
- `tests/integration/test-ui-read-model.test.ts`
- `tests/integration/test-ui-workbench.test.ts`
- `docs/design/domain-test-ui-specification.md`
- `docs/backlog/domain-test-ui-implementation.md`

## Checklist

- [x] Review the governing workflow, project state, S5 contract and ADRs.
- [x] Review the Draft, move it through `Ready`, freeze it and start work.
- [x] Add and export the pure S5 renderer.
- [x] Compose S5 from existing durable replay evidence.
- [x] Add S5 HTML/JSON routes and remove the S5 stub.
- [x] Link S4 to S5 for the same execution.
- [x] Add renderer and HTTP integration coverage.
- [x] Run browser verification over S4→S5.
- [x] Run every minimum verification gate.
- [x] Synchronize governing documentation.
- [x] Archive the completed task and restore the empty current-task template.

## Decisions and Notes

- 2026-08-04: the reviewed Draft moved through `Ready` to `In Progress`; the
  Task Charter and Minimum Verification Gates above are frozen.
- S5 remains a lens. Correlation, counts and redaction come only from
  `buildMemoryDecisionsView`; HTML does not derive memory policy outcomes.
- The route loads `ExecutionReplayEvidence.preparedCommit` through the
  repository port already used by S4. It does not query SQLite directly.
- Default redaction is fixed for this slice. A reveal control would require a
  separate authorization and data-handling charter.
- No new ADR is expected: this is an explicit ADR-0024 follow-up preserving
  ADR-0019's pure renderer, absence and redaction rules.

## Charter Amendment Log

- None.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
  `pnpm build` and `git diff --check` passed.
- `pnpm test:unit`: 533 tests / 60 files passed.
- `pnpm test:conformance`: 58 tests / 7 files passed.
- `pnpm test:integration`: 51 tests / 8 files passed.
- `pnpm test:scenario`: 21 tests / 4 files passed.
- `pnpm docs:check`: 115 Markdown files passed link/fence checks after archive.
- Browser: followed the exact durable execution id from S4 to S5; confirmed
  three ordered decisions, three correlated mutations, six redacted payload
  presentations and zero reveal controls; missing-selection and unknown-id
  states were explicit; console errors were empty; 998 px and 390 px checks
  had no document overflow after adding long-subtitle wrapping.
- No live provider call or external network request was made.

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
      implementation stays within ADR-0019 and ADR-0024.

## Handoff and Follow-ups

- Current state: complete and ready to archive.
- Next recommended step: charter S6 state inspection as the next bounded
  browser lens if continued UI rendering is approved.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none that block the bounded charter.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0048_browser-memory-decisions.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
