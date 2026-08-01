# Current Task

Task ID: ACME-0037
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-01
Last updated: 2026-08-01
Charter frozen at: 2026-08-01

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `docs/adr/0015-strict-structured-output-schema-lowering.md`

## Task Summary

Some provider models (observed: `gpt-5.6-terra`) reject `temperature` after
accepting the rest of a structured-output request. Core already treats
`temperature` as optional, and the OpenAI adapter only forwards it when present
on the request. The remaining blocker is the two reference contracts, which
always emit `temperature: 0`.

This task removes that default so live calls no longer send `temperature`
unless a request builder explicitly sets it. Capability/profile gating for
models that *do* want temperature remains a residual, not this charter.

A task is never considered done until `docs/JOURNAL.md`, `docs/SYSTEMDOC.md`
and `docs/CURRENT_STATUS.md` are current.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Reference contracts no longer default-send `temperature`, so models that
reject the parameter are not blocked by the ACME request shape alone.

### Primary Deliverable

Narrative and Research `buildRequest` paths omit `temperature`; goldens and
status docs match that reality.

### In Scope

- Remove `temperature: 0` from
  `packages/module-narrative/src/contracts/observe-document.ts` and
  `packages/module-research/src/contracts/observe-evidence.ts`.
- Update unit tests that assert `temperature === 0` or pin request hashes that
  include temperature.
- Correct current-facing notes in `docs/CURRENT_STATUS.md`, live-test comments,
  and brief ADR residual wording where they claim contracts still emit
  `temperature: 0`.
- Re-pin only request-derived goldens that change because temperature left the
  hash input.

### Out of Scope

- Capability/profile flags or adapter-side temperature stripping for models
  that still reject an *explicitly* supplied temperature.
- Changing core `ModelRequest` types (already optional).
- Changing the OpenAI adapter mapping (already conditional).
- Live provider spend or model-default changes.
- Domain Test UI, outbox redrive, driver error classification, evaluation
  harness, or any Milestone 3 product surface.
- New ADRs unless a boundary decision appears (none expected).

### Definition of Done

- Neither reference contract includes `temperature` on the built request.
- Golden request hashes and contract tests that depended on the old default are
  updated and green.
- Offline unit, conformance, integration and scenario suites pass.
- `docs/CURRENT_STATUS.md` no longer lists “contracts still emit temperature: 0”
  as the active form of the residual; the residual is optional capability
  gating only (or removed if fully obsolete).
- Signed journal entry and archived task.

### Minimum Verification Gates

- [ ] `pnpm typecheck`
- [ ] `pnpm test` (unit)
- [ ] `pnpm test:conformance`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:scenario`
- [ ] `pnpm docs:check` (or equivalent doc gates)
- [ ] `git diff --check`
- [ ] No live provider call required for this task

## References

- Live evidence (ACME-0029): `gpt-5.6-terra` 400 on unsupported `temperature`
  after schema accepted.
- ADR-0014 limitations on temperature forwarding.
- ADR-0015 follow-up: optional profile flags for parameter subsets.
- Core: `packages/core/src/model.ts`, `model-validation.ts`.
- Adapter: `packages/adapter-model-openai/src/request.ts` (already omits when
  undefined).

## Checklist

- [x] Freeze ACME-0037 charter (minimal omit-default scope).
- [x] Remove `temperature: 0` from narrative observe-document contract.
- [x] Remove `temperature: 0` from research observe-evidence contract.
- [x] Update narrative/research unit assertions and golden request hashes.
- [x] Update live-test comments and CURRENT_STATUS residual text.
- [x] Spot-check ADR residual wording only where it claims contracts emit the
  default (no new ADR).
- [x] Run verification gates; record results.
- [x] Journal, archive task, restore empty CURRENT_TASK template.

## Decisions and Notes

- Explicit temperature in adapter/mock fixtures and neutral-execution fixtures
  may remain: those prove optional field handling, not a contract default.
- Request hash goldens must change when temperature leaves the request; that is
  intentional and does not require a contract version bump because the prompt
  contract identity (ref/version) is unchanged—only the optional parameter is
  omitted. Document the re-pin in the journal.
- Profile/capability gating stays a residual for a later explicit charter.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [x] `pnpm typecheck`
- [x] `pnpm test` (384 unit including scenario files in unit config)
- [x] `pnpm test:conformance` (58)
- [x] `pnpm test:integration` (29)
- [x] `pnpm test:scenario` (19)
- [x] `pnpm docs:check` (81 files), `format:check`, `lint`
- [x] `git diff --check`
- [x] Live: skipped by charter (no spend)

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md` only if it states the old default (spot check — none)
- [x] `docs/JOURNAL.md`
- [x] README gap list if it overstates the residual
- [x] ADR-0014 / ADR-0015 residual sentences only if they falsely claim contracts
  still emit the default

## Handoff and Follow-ups

- Current state: Complete; archived under `docs/finished/`.
- Next recommended step: empty CURRENT_TASK awaits an explicitly approved
  charter (Domain Test UI gates, outbox redrive, driver errors, eval harness,
  or optional parameter-capability gating).
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none within charter.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
