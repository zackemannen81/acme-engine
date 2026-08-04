# Current Task

Task ID: ACME-0046
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-04
Last updated: 2026-08-04
Archived: 2026-08-04
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
- `docs/adr/0020-acme-test-plan-schema-and-compiler.md`
- `docs/adr/0021-interface-workspace-and-launch-boundary.md`
- `docs/adr/0024-local-spa-loopback-workbench.md`

## Task Summary

Turn the already-delivered S2 plan view and `launchPlan` boundary into a
bounded loopback browser workflow. A developer should be able to paste an
`acme-test-plan/1` document, preview the compiled canonical scenario, launch
one offline mock run, and reach the resulting S3 history entry. Durable runs
remain inspectable through S4 when the workbench has a SQLite ledger.

## Task Charter

The charter is editable while status is `Draft` and immutable once the task
reaches `Ready`.

### Goal

Let a developer preview and launch one offline module test from the local
workbench without terminal-side launch scripting and without changing ACME's
plan, scenario, execution, or verdict semantics.

### Primary Deliverable

A rendered S2 plan designer and protected loopback form flow that previews a
submitted `acme-test-plan/1`, launches it only through the existing
`launchPlan`, records the run in the configured interface workspace, and
links the result into S3/S4.

### In Scope

- Pure S2 HTML rendering from `acme-view-plan/1`, including invalid-plan
  feedback and the compiled `acme-scenario/1` artifact.
- A bounded local form submission path for preview and synchronous offline
  launch.
- Explicit workbench configuration of the scenario/fixture root.
- Same-server request protection, bounded request bodies, safe run identifiers,
  HTML escaping, and reuse of existing plan/path validators.
- Mock gateway launches only, using the plan's declared memory or SQLite
  composition through `launchPlan`.
- S3 redirect after a recorded launch and S4 inspection when durable evidence
  is configured.
- Focused unit, integration, and browser-flow verification.
- Governing documentation and stale Domain Test UI backlog metadata repair.

### Out of Scope

- Live OpenAI launch or live confirmation controls in the browser.
- Multi-step live ScenarioRunner semantics.
- Background workers, queues, progress simulation, retry, or cancellation.
- New plan/scenario fields, model selection changes, or measurement fields.
- Rendering S1 or S5-S10.
- Remote/network hosting, authentication, deployment, or package publication.
- Fixture editing, approval application, shell execution, or arbitrary file
  browsing.
- Core, module, adapter, CLI, or canonical ledger contract changes.

### Definition of Done

- `/s2` renders an authoring form and the S2 contract version without client
  JavaScript or external assets.
- Preview accepts bounded YAML/JSON text, reports parser/validator failures
  without crashing, and renders the compiled canonical scenario for a valid
  plan.
- Launch is refused without same-server request proof, a configured scenario
  root, a safe run id, or a valid plan.
- A valid offline plan launches only through `launchPlan`, writes one
  interface-owned run record, and redirects to the recorded S3 entry.
- SQLite launches remain inspectable through S4 when the configured ledger is
  present; memory launches do not pretend durable evidence exists.
- No browser route accepts credentials, live-provider selection, shell input,
  or paths outside the existing configured roots.
- Existing S3/S4 behavior and all repository verification gates remain green.
- Long-lived docs reflect the delivered browser flow and the residual stubs.

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
- [x] Browser verification of preview, launch, S3 redirect, and S4 inspection
      against loopback with mock fixtures only

## References

- `apps/test-ui/src/read-model/plan.ts`
- `apps/test-ui/src/local/launch.ts`
- `apps/test-ui/src/local/server.ts`
- `apps/test-ui/src/web/`
- `tests/integration/test-ui-workbench.test.ts`
- `docs/design/domain-test-ui-specification.md`
- `docs/backlog/domain-test-ui-implementation.md`

## Checklist

- [x] Review the governing workflow, project state, specification, and ADRs.
- [x] Freeze the charter and mark the task `Ready`, then `In Progress`.
- [x] Add the pure S2 renderer and export it from the public surface.
- [x] Add bounded preview and launch handling to the loopback server.
- [x] Extend local CLI configuration with an explicit scenario root.
- [x] Add renderer and HTTP integration coverage for success and refusal paths.
- [x] Run browser verification over the complete offline flow.
- [x] Run every minimum verification gate.
- [x] Synchronize status, system, structure, backlog, and journal docs.
- [x] Archive the completed task and restore the empty current-task template.

## Decisions and Notes

- 2026-08-04: the reviewed Draft moved through `Ready` to `In Progress`; the
  Task Charter and Minimum Verification Gates above are frozen.
- The compiled `acme-scenario/1` remains the reviewable unit. The renderer
  displays `buildPlanView` output and does not compile or reinterpret a plan.
- Browser launch remains synchronous. S3 progress stays explicitly
  unavailable; this task adds no queue-shaped fiction.
- The scenario root is process configuration, not a browser-supplied path.
  Submitted plans may reference only files accepted by the existing bounded
  plan/path validators below that root.
- A mutating loopback route still needs request protection: network locality
  is not treated as proof that a browser submission originated from the
  workbench.
- `docs/backlog/README.md` and the Domain Test UI proposal header still say
  phases 5-6 are open; their detailed body and governing status documents say
  ACME-0043 through ACME-0045 completed them. This task repairs that metadata
  while preserving the optional residual UI proposal.

## Charter Amendment Log

- None.

## Verification

- Preliminary: `pnpm typecheck` passed.
- Focused: S2/S3/S4 renderer and workbench integration tests passed (13 tests
  across 2 files), including launch, redirect, durable inspection, duplicate,
  form-token, origin, unsafe-id, body-limit and memory-evidence cases.
- Preliminary: `pnpm lint` and `pnpm format:check` passed after the first
  implementation checkpoint.
- Browser: S2 rendered with unique editable controls and no layout overflow;
  a valid plan preview returned the compiled canonical scenario; the bounded
  launch returned `303 /s3/browser-acme-0046-001`; S3 contained exactly one
  run link; S4 rendered the committed execution and all trust stages passed;
  no console errors or framework overlay were present. The in-app automation
  focused but did not dispatch the native form's default POST action, so the
  identical POST/redirect leg was driven by a bounded local request after the
  form had been populated. HTTP integration tests separately exercise the
  native form contract end to end.
- Full repository gates: typecheck, lint, format, boundaries, docs and build
  passed; unit configuration passed 527 tests in 60 files, conformance passed
  58 tests in 7 files, integration passed 49 tests in 8 files, and scenario
  passed 21 tests in 4 files. `git diff --check` passed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/backlog/README.md`
- [x] `docs/backlog/domain-test-ui-implementation.md`
- [x] `docs/design/domain-test-ui-specification.md`
- [x] ADRs if implementation changes a long-lived decision — no new ADR;
      implementation stays within ADR-0021 and ADR-0024

## Handoff and Follow-ups

- Current state: ACME-0046 complete; S2/S3/S4 loopback browser flow delivered,
  fully verified and documented.
- Next recommended step: choose an explicitly approved residual, preferably an
  S1 catalog renderer before expanding live-browser or workflow scope.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none that block the bounded charter.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0046_browser-offline-plan-launch.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
