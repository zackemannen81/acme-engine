# Current Task

Task ID: ACME-0053
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
- [`docs/design/domain-test-ui-specification.md`](../design/domain-test-ui-specification.md)
- [`docs/adr/0019-domain-test-ui-boundary-and-view-contracts.md`](../adr/0019-domain-test-ui-boundary-and-view-contracts.md)
- [`docs/adr/0023-live-evaluation-gate.md`](../adr/0023-live-evaluation-gate.md)
- [`docs/adr/0024-local-spa-loopback-workbench.md`](../adr/0024-local-spa-loopback-workbench.md)
- [`docs/finished/ACME-0044_domain-test-ui-live-evaluation.md`](ACME-0044_domain-test-ui-live-evaluation.md)
- [`docs/finished/ACME-0052_browser-fixture-review.md`](ACME-0052_browser-fixture-review.md)

## Task Summary

Phases 0–6 delivered the S10 live-evaluation contract, confirmation gate and
local single-execution launch boundary. ACME-0045–0052 rendered S1–S9 in the
loopback workbench, leaving S10 as the final navigation stub and leaving the
existing live launch boundary inaccessible from the browser.

This task renders the existing `acme-view-live-evaluation/1` contract and
connects an explicit browser confirmation to the existing
`launchLiveExecution` function. The process environment remains the first
gate, the browser confirmation remains the second, credentials remain outside
all form/view/run values, and default verification uses an injected offline
transport rather than a paid provider call.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Let a local developer inspect live-only run history and explicitly launch one
budgeted live execution from S10 without weakening ADR-0023's two-key gate,
mixing deterministic history into the view, or exposing credentials.

### Primary Deliverable

A complete S10 browser surface over `acme-view-live-evaluation/1`, including a
CSRF- and same-server-protected single-execution launch form that delegates to
the existing `launchLiveExecution` boundary and records the resulting
interface-owned live run.

### In Scope

- Pure `renderLiveEvaluationViewHtml` over the existing S10 view contract.
- `/s10` HTML and `/api/live-evaluation` JSON routes over workspace run
  records, preserving live-only partitioning and unreadable-record evidence.
- Browser fields for one `ExecutionRequest` plus the existing
  `acme-live-confirmation/1` values; no credential field.
- Protected `/s10/launch` using the existing CSRF, same-server, body-size and
  safe run-id controls.
- Delegation to `launchLiveExecution`, including process opt-in, environment
  credential lookup, confirmation parsing and model-call budget enforcement.
- Duplicate/concurrent run-id refusal and post-launch redirect to S10 history.
- Test-only transport/API-key injection at the workbench composition boundary
  so HTTP launch is proven without network.
- Health-contract registration and removal of the S10 stub.
- Focused unit, HTTP integration and responsive browser verification.
- Governing status, system, structure, specification, backlog and journal
  documentation.

### Out of Scope

- Multi-step live scenarios or ScenarioRunner changes.
- Adding live fields to `acme-test-plan/1` or changing plan compilation.
- New provider adapters, provider selection beyond ADR-0023's OpenAI v1 path,
  retry/repair semantics or cost-estimation logic.
- Persisting confirmations as separate workspace artifacts.
- Accepting API keys, tokens or other credentials through the browser,
  confirmation document, view contract, URL or run record.
- Remote hosting, non-loopback binding, authentication, deployment,
  publication or paid verification calls.
- Core, module, CLI, canonical ledger or existing view-contract changes.

### Definition of Done

- `/s10` renders `acme-view-live-evaluation/1` and
  `/api/live-evaluation` returns the same live-only history projection.
- Mock records are excluded, live runs are ordered by the existing builder,
  unavailable confirmation/cost stays explicit and unreadable run filenames
  remain visible.
- The launch form contains no credential control and forms an existing
  `acme-live-confirmation/1` plus exactly one `ExecutionRequest`.
- Launch is impossible unless both process opt-in and a valid named,
  rationalized, budgeted confirmation pass; request model-call budget cannot
  exceed the confirmed ceiling.
- CSRF, same-server, fixed body-size, safe/unique run id and active-launch
  guards apply before provider dispatch; existing history is never
  overwritten.
- Successful and failed launches are recorded through
  `launchLiveExecution`, remain in the live series and redirect to S10; no
  browser code calls a provider or writes the ledger directly.
- Offline injected transport proves the complete HTTP launch path without a
  network call, and no credential value appears in rendered HTML, view JSON or
  stored run JSON.
- Existing S1–S9 behavior and every repository verification gate remain green.
- Long-lived docs describe S1–S10 as rendered and live browser launch as
  bounded single-execute; multi-step live remains a named gap.

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
- [x] Browser verification of gated live form/history, responsive layout,
      error-overlay state and no live network call

## References

- [`docs/design/domain-test-ui-specification.md`](../design/domain-test-ui-specification.md)
- [`docs/backlog/domain-test-ui-implementation.md`](../backlog/domain-test-ui-implementation.md)
- [`docs/adr/0019-domain-test-ui-boundary-and-view-contracts.md`](../adr/0019-domain-test-ui-boundary-and-view-contracts.md)
- [`docs/adr/0023-live-evaluation-gate.md`](../adr/0023-live-evaluation-gate.md)
- [`docs/adr/0024-local-spa-loopback-workbench.md`](../adr/0024-local-spa-loopback-workbench.md)
- `apps/test-ui/src/read-model/live-evaluation.ts`
- `apps/test-ui/src/live-gate.ts`
- `apps/test-ui/src/local/live-launch.ts`
- `apps/test-ui/src/local/server.ts`

## Checklist

- [x] Read required governing documents and relevant ADRs in order.
- [x] Activate ACME-0053, freeze its charter and record the scope assumption.
- [x] Add the pure S10 renderer and exports.
- [x] Compose live-history HTML/JSON routes and remove the S10 stub.
- [x] Add the protected single-execution launch route over the existing gate.
- [x] Add focused renderer and offline HTTP integration coverage.
- [x] Run responsive browser verification without live provider traffic.
- [x] Run every minimum verification gate and record exact results.
- [x] Update all affected long-lived documentation.
- [x] Add a signed journal entry, archive the task and restore the template.

## Decisions and Notes

- The user explicitly approved ACME-0053 as the final S10 task on 2026-08-05.
- “Final S10 task” is bounded to S10 rendering plus browser access to the
  already delivered single-execute live boundary. Multi-step live scenarios
  are a distinct engine/runner expansion and remain outside this charter.
- No new ADR is required: implementation follows ADR-0019, ADR-0023 and
  ADR-0024 without changing a public contract or long-lived boundary.
- Implementation checkpoint: pure renderer, HTML/JSON history routes,
  protected launch route, test-only provider injection and append-once run
  writes are implemented; `pnpm typecheck` passes before focused tests.
- Verification checkpoint: 23 focused renderer/HTTP tests pass. Browser S10
  launched one recorded run through an injected offline transport, rendered
  its exact execution link, showed no credential value, emitted no console
  warning/error and had no horizontal overflow at 1200 px or 390 px.
- The first full integration run exposed that the existing v1 policy validator
  rejects a two-call request before the confirmation-ceiling check. The test
  expectation was corrected to that authoritative behavior; no production
  behavior changed, and the complete integration suite then passed.
- A checkpoint after each step or substep is required. Checklist is therefore
  updated along the work and `CURRENT_STATUS.md` is updated when behavior
  changes.

## Charter Amendment Log

- none

## Verification

- [x] Pure renderer covers gate absent/present, live runs, cost available/
      unavailable, failures, unreadable files and HTML escaping.
- [x] HTTP integration covers HTML/JSON history, process-gate refusal,
      malformed confirmation/request, duplicate/concurrent id refusal and one
      successful offline-transport launch.
- [x] Stored/view/rendered values are asserted credential-free.
- [x] Browser checks desktop and narrow layouts, a refused gate and a
      successful injected offline launch with no provider network.
- [x] Full baseline gates pass; no check was skipped. Results: typecheck, lint,
      format, boundaries and build passed; unit 546 tests / 61 files;
      conformance 58 / 7; integration 55 / 9; scenario 21 / 4;
      documentation check 119 Markdown files before archive; final
      `git diff --check` passed.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `README.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/backlog/README.md`
- [x] `docs/backlog/domain-test-ui-implementation.md`
- [x] `docs/design/README.md`
- [x] `docs/design/domain-test-ui-specification.md`
- [x] ADRs when long-lived decisions change — none required

## Handoff and Follow-ups

- Current state: complete and ready to archive.
- Next recommended step: no task is implicitly activated; choose any later
  multi-step live work through a separately approved charter.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none that block the bounded charter.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0053_browser-live-evaluation.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
