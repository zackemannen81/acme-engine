# Current Task

Task ID: ACME-0132
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- ADR-0016, ADR-0039, ADR-0040 and ADR-0044
- ACME-0105, ACME-0129 and ACME-0131

## Task Summary

Implement ADR-0044's execution policy: retire the campaign-level call and cost
ceilings as preconditions, and make the cost they were standing in for
measurable from recorded provider calls.

## Task Charter

The charter was frozen when this task became `Ready`.

### Goal

A live composition resolves without a campaign cap, and the actual cost of a
run is readable from recorded evidence rather than inferred.

### Primary Deliverable

An optional deployment budget, unchanged per-execution bounding, content-free
provider-call metadata persisted by every repository adapter, and a usage
report over recorded calls.

### In Scope

- Make the deployment call ceiling optional. Absent means no campaign cap, not
  a refusal.
- Keep the per-execution run ceiling required, positive and enclosed.
- Persist content-free provider, model and usage on the recorded model call in
  every retention mode, including `none` and `hash-only`.
- Round-trip that metadata through the in-memory, SQLite and PostgreSQL
  adapters and assert it in the shared repository conformance kit.
- Add a usage report over recorded calls: call count, token totals and derived
  cost where the provider supplied it.
- Document the three verification tiers and what each may claim.

### Out of Scope

- The acceptance run itself, new data classes, contract or prompt versions.
- Provider calls, browser surfaces, deployment, release.
- Removing per-execution bounding, the ADR-0040 live tuple, or any guardrail
  listed in ADR-0044 §2.
- Pricing tables. Cost is reported only where the provider supplied it.

### Definition of Done

- A live composition with no configured deployment ceiling resolves, and one
  with a ceiling still enforces it.
- An execution without a positive run ceiling is still refused.
- After a completed call, the recorded evidence names provider, model and
  usage under every retention mode, and no source content joins it.
- The report sums a run's calls and tokens from recorded evidence alone.
- Offline gates and a fresh PostgreSQL journey pass.

### Minimum Verification Gates

- [x] Focused gates for optional-ceiling resolution and retained run bounding
- [x] Conformance gate for provider/model/usage across all three adapters
- [x] typecheck, lint, boundaries, test, build, format, docs and diff
- [x] Fresh PostgreSQL journey

## References

- `packages/live-safety/src/index.ts` — budget assertion
- `apps/evidence-workbench-api/src/live.ts` — capability resolution
- `apps/evidence-workbench-api/src/local.ts` — environment parsing
- `packages/core/src/payload-encryptor.ts` — `applyModelCallRetention`
- `packages/core/src/repository-model-call.ts` — recorded call evidence
- `packages/testing/src/repository-conformance.ts` — shared adapter kit

## Checklist

- [x] Freeze the charter.
- [x] Make the deployment ceiling optional while keeping execution bounding.
- [x] Persist content-free provider/model/usage in every retention mode.
- [x] Round-trip it through all three adapters and the conformance kit.
- [x] Add the usage report and its gate.
- [x] Document the verification tiers.
- [x] Run focused and canonical offline verification.
- [x] Reality-sync docs, archive and commit.

## Decisions and Notes

- Discovery that shapes this task: `acme.model_calls` has `model`, `provider`
  and `usage_json` columns and all three are `NULL` for every recorded call.
  `applyModelCallRetention` returns only `responseHash` and, under
  `encrypted-payload`, the sealed envelope. Provider, model and usage are
  dropped in every retention mode, so ADR-0044 §5's measurement is impossible
  today. The token counts quoted in earlier journal entries came from reading
  responses in flight, not from durable evidence.
- Removing the cap without landing the measurement in the same change is
  refused by ADR-0044's own risk clause. They are one outcome.
- Provider, model and token counts are operational metadata, not source
  content. ADR-0039 already requires content-free audit, and the PostgreSQL
  schema already reserved the columns.
- Usage stays optional in the contract because a provider may not report it,
  and an absent value must read as absent rather than as zero.
- A checkpoint after every substep is required.

## Charter Amendment Log

- None.

## Verification

- [x] `pnpm test:unit` 768/768 across 121 files, up from 759/120.
      `pnpm test:conformance` 78, `pnpm test:integration` 62,
      `pnpm test:scenario` 26.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`, `pnpm build`,
      `pnpm format:check`, `pnpm docs:check`, `git diff --check`.
- [x] `pnpm test:postgres` 37/37 on a disposable `postgres:15` created for this
      task and removed afterwards, up from 36. The shared execution-repository
      conformance kit runs against PostgreSQL too, so the retained metadata is
      proven on all three adapters by one gate.
- [x] No source content reaches the new metadata. The retention gate asserts
      the sealed response text never appears in the retained fields, the
      conformance gate asserts the same for a resumed call, and the PostgreSQL
      gate asserts `response_payload` stays `NULL` under `hash-only` while
      `provider`, `model` and `usage_json` are queryable.
- [x] Running composition with no `ACME_EVIDENCE_LIVE_MAX_MODEL_CALLS`,
      `ACME_EVIDENCE_LIVE_COST_CEILING_MINOR` or `ACME_EVIDENCE_LIVE_CURRENCY`:
      the capability resolves and `/api/capabilities` reports
      `liveObservationMaxModelCalls: null`. Before this task that composition
      refused with `deployment.maxModelCalls must be a positive integer`.
- [ ] No provider call was made.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/CONTRIBUTING.md` — verification tiers
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: complete. A live composition resolves with no campaign
  ceiling, one execution is still bounded, and recorded calls now carry
  provider, model and usage under every retention mode.
- The seven calls already recorded predate this change and carry no metadata;
  they cannot be measured retroactively.
- Follow-up, not a defect: `summarizeModelCallUsage` is a pure function with
  no operator surface. A CLI or API report over it would make cost readable
  without a database client.
- Next task: activate
  `docs/backlog/poc1-live-product-acceptance.md` on a fresh case.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- [x] Archive as
      `docs/finished/ACME-0132_measured-cost-and-optional-ceiling.md`.
- [x] Restore the task template and add a signed Journal entry.
- Supersede rather than rewrite if the Goal changes.
