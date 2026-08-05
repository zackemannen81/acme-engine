# ACME-0050 — Browser Replay Inspector

Task ID: ACME-0050
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
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/adr/0019-domain-test-ui-boundary-and-view-contracts.md`
- `docs/adr/0024-local-spa-loopback-workbench.md`

## Task Summary

Render the already-delivered `acme-view-replay/1` contract as S7 in the local
loopback workbench. From S4, a developer should be able to run read-only replay
verification for the same recorded execution and inspect the engine's exact
verdict, operation-digest comparison and diagnostic differences without a
model call or canonical write.

## Task Charter

The charter is editable while status is `Draft` and immutable once the task
reaches `Ready`.

### Goal

Make recorded execution replay and digest comparison inspectable and auditable
in the local browser workbench.

### Primary Deliverable

A pure S7 HTML renderer plus read-only loopback HTML/JSON routes over the
existing `ExecutionEngine.replayVerify` and `buildReplayView`, linked from S4
for the same execution.

### In Scope

- Pure S7 HTML rendering from `acme-view-replay/1`.
- The engine's exact `match | different | unavailable` replay vocabulary.
- Recorded/replayed operation digests, comparison state, diagnostic count and
  ordered diagnostic facts with default-redacted details.
- `GET /s7?executionId=...` HTML and
  `GET /api/replay?executionId=...` JSON routes.
- Read-only replay through the configured composition and a gateway guard that
  fails if replay attempts a provider call.
- Recorded digest loading through the repository's existing replay-evidence
  port; no direct database reads from render code.
- A contextual S4 link to S7 carrying the exact execution id.
- Honest guidance/refusal pages for missing execution id, absent ledger and an
  unknown execution.
- Focused unit, HTTP integration and browser verification.
- Governing status, system, structure, specification, backlog and journal
  documentation.

### Out of Scope

- New replay modes, verdicts, digest algorithms or diagnostic semantics.
- Persisting replay reports, changing execution evidence or writing canonical
  state, memory, documents, events or outbox entries.
- Any provider call, replay resume, rebuild, fork or comparison between two
  different executions.
- Revealing diagnostic payloads or adding browser disclosure controls.
- Rendering S8–S10 or changing S1–S3 behavior.
- Live provider calls, remote hosting, authentication, deployment or package
  publication.
- Core, module, adapter, CLI, persistence or canonical execution changes.

### Definition of Done

- S4 links to `/s7` with its exact execution id.
- `/s7` invokes existing replay verification and renders the S7 contract
  version plus the engine's exact verdict without recomputing it.
- Digest equality/difference/unavailability and diagnostic counts come only
  from `buildReplayView`; missing values remain explicit.
- Replay uses a gateway guard and tests prove the browser path makes no model
  call and no canonical repository mutation.
- `match`, `different` and engine `unavailable` remain distinct; the pure
  renderer also displays `REPLAY_NOT_RUN` honestly when supplied that view.
- Diagnostic details remain redacted by default and no browser route can
  request disclosure.
- `/api/replay` returns the same view contract used by HTML.
- Missing execution id, absent ledger and unknown execution states are honest.
- Existing S1–S6 behavior and every repository verification gate remain green.
- Long-lived docs reflect S1–S7 as rendered surfaces and name S8–S10 as the
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
- [x] Browser verification of S4→S7 navigation, match/unavailable evidence,
      diagnostic redaction, responsive layout and error-overlay/console state

## References

- `apps/test-ui/src/read-model/replay.ts`
- `apps/test-ui/src/local/composition.ts`
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

- [x] Review the governing workflow, project state, S7 contract and ADRs.
- [x] Review the Draft, move it through `Ready`, freeze it and start work.
- [x] Add and export the pure S7 renderer.
- [x] Compose read-only replay through the existing engine boundary.
- [x] Add S7 HTML/JSON routes and remove the S7 stub.
- [x] Link S4 to S7 for the same execution.
- [x] Add renderer and HTTP integration coverage.
- [x] Run browser verification over S4→S7.
- [x] Run every minimum verification gate.
- [x] Synchronize governing documentation.
- [x] Archive the completed task and restore the empty current-task template.

## Decisions and Notes

- 2026-08-05: the reviewed Draft moved through `Ready` to `In Progress`; the
  Task Charter and Minimum Verification Gates above are frozen.
- S7 remains a lens. The engine produces the replay verdict and
  `buildReplayView` owns digest comparison; HTML displays those values only.
- Replay gets a fail-closed gateway implementation. Any accidental provider
  access turns into a test-visible error instead of external I/O.
- The route computes replay on request but persists no replay report and makes
  no canonical write.
- No new ADR is expected: this is an ADR-0024 follow-up preserving ADR-0012
  and ADR-0019 replay semantics.
- The pre-existing S2 origin hotfix had two identical cross-site checks after
  its manual edit. Keeping the declared `fetchSite` check removes only the
  duplicate branch and preserves the reviewed behavior while restoring the
  formatting baseline required by this task's gates.

## Charter Amendment Log

- None.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
  `pnpm build` and `git diff --check` passed.
- `pnpm test:unit`: 537 tests / 60 files passed.
- `pnpm test:conformance`: 58 tests / 7 files passed.
- `pnpm test:integration`: 51 tests / 8 files passed.
- `pnpm test:scenario`: 21 tests / 4 files passed.
- `pnpm docs:check`: 116 Markdown files passed before archive; rerun after
  archive passed 117 files.
- Browser: followed S4→S7 for a hash-only durable execution and observed the
  engine's `unavailable` verdict, preserved recorded digest and redacted
  diagnostic. A retained encrypted-payload execution produced `match`, equal
  recorded/replayed digests and zero differences. Exact execution ids were
  preserved and the shared responsive shell rendered without an error overlay.
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
      implementation stays within ADR-0012, ADR-0019 and ADR-0024.

## Handoff and Follow-ups

- Current state: complete and ready to archive.
- Next recommended step: charter S8 measurement rendering as the next bounded
  browser lens if continued UI rendering is approved.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none that block the bounded charter.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0050_browser-replay-inspector.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
