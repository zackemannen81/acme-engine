# Current Task

Task ID: ACME-0105
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-08-15
Last updated: 2026-08-15
Charter frozen at: 2026-08-15

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0023-live-evaluation-gate.md`
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `docs/adr/0036-evidence-case-management-and-isolation.md`
- `docs/adr/0039-evidence-workbench-live-model-boundary.md`
- `docs/adr/0040-poc-1-live-product-applicability.md`

## Task Summary

Implement the reusable live-safety primitives, Evidence-specific confirmation
and the typed `evidence-poc1-live/1` composition resolver. Wire the hosted
Evidence composition to a real OpenAI gateway only after the complete
PostgreSQL/provider/source-origin/execution-authority tuple and durable payload
key have passed fail-closed validation. Keep every default/test composition
mock-only and provider-unreachable.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

Make it impossible for a partial, ambient or mixed composition to claim or
obtain the POC #1 live gateway.

### Primary Deliverable

A typed, tested live-composition boundary used by the Evidence hosted
composition, with shared live-safety primitives and durable payload-key
configuration.

### In Scope

- Extract provider-neutral credential scanning, environment opt-in and budget
  ceiling primitives into a shared leaf package and migrate the Domain Test UI
  to them without behavior change.
- Implement strict `evidence-live-confirmation/1` parsing with no actor field,
  exact case binding and typed refusal reasons.
- Add deny-by-default `live-model.run`, granted only to `case-admin`.
- Implement a pure `evidence-poc1-live/1` resolver that requires the ADR-0040
  four-part tuple and deployment ceilings.
- Add environment/configuration parsing that cannot activate from credentials
  alone.
- Require a mounted durable payload-key file for the hosted live profile and
  use it for the PostgreSQL execution repository.
- Select and construct the OpenAI Responses gateway only after the resolver
  succeeds; allow injected transport/key only in tests.
- Add executable unit and offline integration proofs for valid composition and
  each mixed/refused composition.
- Keep Stage A source import and the browser/job endpoint outside this task;
  the resulting gateway is composed but cannot yet be invoked through a new
  product route.

### Out of Scope

- Versioning the text-import data class or importing the supplied documents.
- A new live execution API/browser flow, worker job type or product audit
  events; those form the next vertical task.
- Stage B FUP material and excluded formats.
- Real provider spend in default verification.
- Cumulative per-principal accounting.

### Definition of Done

- Shared live-safety primitives are used by both existing Test UI and Evidence
  confirmation code.
- Evidence confirmation and composition schemas reject credential fields,
  wrong case, missing authority, non-PostgreSQL persistence, mock gateway,
  fixture source, missing durable payload key and exceeded ceilings.
- `live-model.run` is absent for every role except `case-admin`.
- Default and synthetic compositions still construct only the scripted gateway.
- One offline injected-transport test proves a valid resolved profile reaches
  the OpenAI adapter while invalid profiles contact it zero times.
- Canonical code, test and documentation gates pass; the task is archived and
  committed.

### Minimum Verification Gates

- [x] Focused package and Evidence composition tests
- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm boundaries`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `pnpm format:check`
- [x] `pnpm docs:check`
- [x] `git diff --check`
- [x] `pnpm test:postgres`

## References

- ADR-0023, ADR-0039 and ADR-0040
- `apps/test-ui/src/live-gate.ts`
- `apps/evidence-workbench-api/src/local.ts`
- `packages/evidence-auth/src/policy.ts`
- `packages/adapter-model-openai/src/index.ts`

## Checklist

- [x] Activate and freeze the task charter.
- [x] Add and test the shared live-safety package; migrate Test UI primitives.
- [x] Add and test Evidence confirmation, authorization and composition
  contracts.
- [x] Wire hosted PostgreSQL payload key and resolved OpenAI gateway.
- [x] Add offline adapter-contact and mixed-composition refusal proofs.
- [x] Run all verification gates.
- [x] Reality-sync documentation and add signed journal entry.
- [x] Archive and commit the completed task.

## Decisions and Notes

- This is the first runtime checkpoint after ADR-0040, not another readiness
  document. It deliberately stops before a callable product route so the
  composition safety invariant lands independently of import/job semantics.
- Test injection may supply transport and key material directly. Production
  resolution reads credentials and key bytes only after explicit live opt-in.
- No attached source content is read or stored by this task.

## Charter Amendment Log

- None.

## Verification

- [x] Focused live-safety, Test UI compatibility, Evidence authorization and
  Evidence live-composition suites: 39 tests passed.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm boundaries` and `pnpm build` passed.
- [x] `pnpm test`: 742 unit, 78 conformance, 62 integration and 26 scenario
  tests passed.
- [x] `pnpm test:postgres`: 34 tests across six files passed against a clean
  disposable PostgreSQL 15 container; the container was stopped and removed.
- [x] `pnpm format:check`, `pnpm docs:check` (212 Markdown files) and
  `git diff --check` passed.
- [x] No provider network call or spend occurred; the OpenAI proof used an
  injected offline transport.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] Relevant READMEs and product plans

## Handoff and Follow-ups

- Current state: Complete; the live capability is closed and callable only
  from code after full run authorization, with no product route yet.
- Next recommended step: Add the Stage A data contract plus authenticated live
  job/browser flow after this composition boundary is green.
- Blockers: None.
- Child tasks: None.
- Resume condition: Immediate.
- Open questions: None within the frozen charter.

## Finalize When Complete

- Archive under `docs/finished/ACME-0105_evidence-live-composition-boundary.md`.
- Restore the current-task template.
- Add a signed journal entry.
