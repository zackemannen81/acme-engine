# Current Task

Task ID: ACME-0058
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-08-06
Last updated: 2026-08-06
Charter frozen at: 2026-08-06
Archived: 2026-08-06

## Task Summary

Gap plan slice **D2**: operator commands to list stranded executions and
discharge them to a terminal failed outcome with audit fields—without
inventing model results or erasing ledger evidence.

## Task Charter

### Goal

An operator can list non-terminal stranded executions and discharge one by id
with who/why/when, so human decisions are explicit rather than invisible.

### Primary Deliverable

- Pure stranded classification in `@acme/core`
- CLI: `execution stranded` (list) and `execution discharge`
- Tests over fixture ledger evidence

### In Scope

- Classify non-terminal executions whose primary model call is reserved /
  in-flight, succeeded-without-readable-response, failed, or ambiguous.
- Also surface already-terminal failed executions with
  `MODEL_UNAVAILABLE` / `RESUME_EVIDENCE_UNAVAILABLE` (or operator-discharge
  marker) for inventory.
- CLI list with limit; discharge with `--by` and `--rationale`.
- Discharge uses existing `markTerminal`; refuses committed, non-stranded,
  and already-terminal rows.
- No silent resume; no provider call.

### Out of Scope

- Provider-side reconciliation (G14)
- Multi-tenant operator authn
- Test UI surface
- Automatic retry
- Outbox work (WP-O)
- Live provider calls

### Definition of Done

- Core pure list/classify is deterministic and unit-tested.
- CLI list and discharge work on memory and sqlite composition.
- Discharge records operator audit in terminal error details; leaves model
  call evidence intact; does not write state/memory/documents.
- G06 closed in CURRENT_STATUS / gap plan; JOURNAL updated.
- typecheck, unit, conformance, integration, docs:check pass.

### Minimum Verification Gates

- [x] `pnpm typecheck`
- [x] `pnpm test:unit` (574)
- [x] `pnpm test:conformance` (61)
- [x] `pnpm test:integration` (55)
- [x] `pnpm docs:check`
- [x] `git diff --check`

## Delivered

- `packages/core/src/stranded-execution.ts` — `listStrandedExecutions`,
  `prepareOperatorDischarge`, `acme-stranded-list/1`
- CLI `execution stranded` / `execution discharge --by --rationale`
- Unit + CLI SQLite fixture tests
- Docs: G06 closed, SYSTEMDOC, gap plan, JOURNAL, FILESTRUCTURE

## Decisions

- Primary call identity matches ADR-0017: `model:0` / attempt 1 / primary.
- Discharge must not `appendAttempt` with `stage: 'failed'` first — adapters
  promote attempt.stage into execution.status.
- Operator audit lives in `terminal.error.details` (`operatorDischarge`,
  `dischargedBy`, `rationale`, `dischargedAt`, `strandedReason`).

## Handoff

- Next: WP-O / O1 outbox redrive (G04).
