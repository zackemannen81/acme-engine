# ACME-0049 — Browser State Inspector

Task ID: ACME-0049
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
- `docs/adr/0024-local-spa-loopback-workbench.md`

## Task Summary

Render the already-delivered `acme-view-state/1` contract as S6 in the local
loopback workbench. From S4, a developer should be able to inspect the
canonical state lineage for the execution's namespace/entity scope, including
revision identity, accepted transitions and continuity, without exposing
payloads or changing state.

## Task Charter

The charter is editable while status is `Draft` and immutable once the task
reaches `Ready`.

### Goal

Make canonical state revision lineage inspectable and auditable in the local
browser workbench.

### Primary Deliverable

A pure S6 HTML renderer plus read-only loopback HTML/JSON routes over the
existing `buildStateView` and repository state evidence, linked from S4 for
the same namespace and entity.

### In Scope

- Pure S6 HTML rendering from `acme-view-state/1`.
- Ordered revision cards showing revision/schema/value hash, creation and
  execution provenance, continuity and the accepted transition when present.
- Transition identity, operation key, from/to revision, delta schema, hash
  linkage and default-redacted state/delta payload presentation.
- Explicit head/revision counts, empty lineages, missing transitions, broken
  continuity and unavailable state evidence.
- `GET /s6?namespace=...&entityId=...` HTML and
  `GET /api/state?namespace=...&entityId=...` JSON routes.
- State evidence loading through the configured repository's existing
  read-only snapshot; no direct database reads from render code.
- A contextual S4 link to S6 carrying the exact namespace and entity id.
- Honest guidance/refusal pages for missing scope or absent ledger.
- Focused unit, HTTP integration and browser verification.
- Governing status, system, structure, specification, backlog and journal
  documentation.

### Out of Scope

- New state view fields, lineage rules, reducer semantics or redaction modes.
- Revealing payloads, decrypting content through the browser or adding reveal
  authorization controls.
- Editing state, replaying transitions, rollback or revision comparison tools.
- Filtering lineage by execution or adding state search/listing across scopes.
- Rendering S7–S10 or changing S1–S3 behavior.
- Live provider calls, remote hosting, authentication, deployment or package
  publication.
- Core, module, adapter, CLI, persistence or canonical execution changes.

### Definition of Done

- S4 links to `/s6` with its exact namespace and entity id.
- `/s6` renders the S6 contract version, exact scope and recorded
  revision/head counts without recomputing them.
- Revision order, continuity and transition evidence come only from
  `buildStateView`; linked, broken, unknown and unavailable states remain
  explicit.
- State and delta values remain redacted by default and no browser route can
  request disclosure.
- An actually empty lineage renders as available with zero revisions, while
  unloaded evidence remains unavailable.
- `/api/state` returns the same view contract used by HTML.
- Missing scope and missing ledger states are honest and do not mutate or
  query outside the configured repository.
- Existing S1–S5 behavior and every repository verification gate remain green.
- Long-lived docs reflect S1–S6 as rendered surfaces and name S7–S10 as the
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
- [x] Browser verification of S4→S6 navigation, lineage/transition evidence,
      redaction, responsive layout and error-overlay/console state

## References

- `apps/test-ui/src/read-model/state.ts`
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

- [x] Review the governing workflow, project state, S6 contract and ADRs.
- [x] Review the Draft, move it through `Ready`, freeze it and start work.
- [x] Add and export the pure S6 renderer.
- [x] Compose S6 from existing repository state evidence.
- [x] Add S6 HTML/JSON routes and remove the S6 stub.
- [x] Link S4 to S6 for the same namespace/entity scope.
- [x] Add renderer and HTTP integration coverage.
- [x] Run browser verification over S4→S6.
- [x] Run every minimum verification gate.
- [x] Synchronize governing documentation.
- [x] Archive the completed task and restore the empty current-task template.

## Decisions and Notes

- 2026-08-05: the reviewed Draft moved through `Ready` to `In Progress`; the
  Task Charter and Minimum Verification Gates above are frozen.
- S6 remains a lens. Ordering, continuity and counts come only from
  `buildStateView`; HTML does not derive state semantics.
- Repository snapshot evidence is already the read boundary used by local
  inspection. Render code receives only the versioned view contract.
- Default redaction is fixed for this slice. A reveal control would require a
  separate authorization and data-handling charter.
- No new ADR is expected: this is an ADR-0024 follow-up preserving ADR-0019's
  pure renderer, absence and redaction rules.

## Charter Amendment Log

- None.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm boundaries`,
  `pnpm build` and `git diff --check` passed.
- `pnpm test:unit`: 535 tests / 60 files passed.
- `pnpm test:conformance`: 58 tests / 7 files passed.
- `pnpm test:integration`: 51 tests / 8 files passed.
- `pnpm test:scenario`: 21 tests / 4 files passed.
- `pnpm docs:check`: 116 Markdown files passed link/fence checks after
  archive.
- Browser: followed the exact namespace/entity scope from S4 to S6; confirmed
  one linked revision, its accepted transition, two redacted payload
  presentations and zero reveal controls; missing-scope guidance and an
  actually empty lineage were explicit; console errors were empty; 998 px and
  390 px checks had no document overflow.
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
- Next recommended step: charter S7 replay and digest comparison as the next
  bounded browser lens if continued UI rendering is approved.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none that block the bounded charter.

## Finalize When Complete

- Archive this file as `docs/finished/ACME-0049_browser-state-inspector.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes, supersede this task instead of
  rewriting it.
