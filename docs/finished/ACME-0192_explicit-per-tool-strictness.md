# Current Task

Task ID: ACME-0192
Parent Task: None
Status: Complete
Owner: Codex
Created: 2026-09-30
Last updated: 2026-09-30
Charter frozen at: 2026-09-30; claim 1cb2bef verified on origin/main

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR-0015, ADR-0053, ADR-0054, ADR-0055 and ADR-0056

## Task Summary

A008 embeds ACME for provider execution and needs an explicit non-strict tool
option for MCP schemas outside OpenAI's strict subset. ACME carries the option;
the caller owns MCP policy, argument validation and bounded correction attempts.

## Task Charter

### Goal

Allow callers of the embedded model runtime to select non-strict function
calling per tool while retaining strict as the default and preserving the
independent guarantees of structured final output.

### Primary Deliverable

A public per-tool `strict?: boolean` contract, validated and mapped explicitly
to OpenAI Responses and Chat Completions, with request identity, diagnostics,
offline regression coverage and documented caller responsibilities.

### In Scope

- Validate and preserve explicit tool strictness, including request hashing.
- Default each tool independently to strict; preserve original parameter
  schemas in explicit non-strict mode without strict-schema lowering.
- Keep OpenAI Responses strict lowering and fail-closed refusal for strict
  tools, and map the explicit boolean on compatible Chat Completions tools.
- Expose content-free effective per-tool mode diagnostics and retain them on
  terminal/replayed embedded execution results.
- Document caller resolution of tool override, MCP-server default, then true;
  original-schema validation before execution in both modes; bounded caller
  correction; and ACME's non-execution/non-retry ownership boundary.
- Preserve frozen HTTP v1/v2 tool shapes; the new option is embedded-only.
- Record an ADR, update system/status/package documentation, journal, archive,
  commit, push the development branch and open a PR.
- Preserve the separately paused ACME-0191 release charter and local changes.

### Out of Scope

- A008 changes, MCP discovery/configuration or a tool executor in ACME.
- Automatic mode fallback, schema weakening, argument repair or model retry.
- Changing structured final-output schemas, domain execution or data authority.
- npm publication, version bumps, live provider calls, deployment, tags/releases
  or merging the implementation PR.

### Definition of Done

- Omitted/true tool modes are strict; false is honored individually, including
  mixed-mode requests and schemas refused by the strict Responses lowerer.
- Invalid mode values fail locally. Non-strict schemas reach the provider
  unchanged; structured final output remains strict and independently checked.
- Explicit modes affect identity; requests omitting the new field retain
  historical hashes. A changed mode cannot reuse another mode's execution.
- Effective modes are visible without exposing tool names, schemas or arguments.
- Public facade execution and streaming/buffered provider mappings are proven
  offline. Frozen HTTP protocols refuse the new option explicitly.
- Required checks pass; documentation, signed journal and archive are complete.
- Changes are committed, pushed and available in a reviewable PR.

### Minimum Verification Gates

- [x] Focused core validation/hash/engine, both adapter and public facade tests.
- [x] `pnpm typecheck`.
- [x] `pnpm test:unit --maxWorkers=2` (includes offline integration/scenarios).
- [x] `pnpm test:conformance --maxWorkers=2`.
- [x] `pnpm lint`, `pnpm boundaries`, `pnpm format:check`, `pnpm docs:check`.
- [x] `git diff --check`.
- [x] No live calls, publication, version bumps or unrelated local edits.

## References

- https://developers.openai.com/api/docs/guides/function-calling
- `packages/core/src/model.ts`
- `packages/adapter-model-openai/src/request.ts`
- `packages/adapter-model-chat-completions/src/gateway.ts`
- `packages/acme-engine/src/index.ts`

## Checklist

- [x] Claim ACME-0192 on remote main and create an isolated development branch.
- [x] Charter and freeze the task before implementation.
- [x] Implement the contract, mappings, diagnostics and compatibility guards.
- [x] Add offline regressions and verify all gates.
- [x] Update ADR/system/status/package documentation and signed journal.
- [x] Archive, restore the template, commit, push and open a PR.

## Decisions and Notes

- ACME-0191 is preserved in `docs/paused/ACME-0191_publish-oneof-schema-lowering.md`;
  its release candidate edits remain in the original checkout/release branch.
- Chat Completions previously omitted provider strictness. Sending true by
  default is an intentional behavior change; provider rejection is surfaced,
  never retried in a weaker mode. Its schema passthrough remains unchanged.

## Charter Amendment Log

None.

## Verification

- Typecheck passed, including exported facade types and all tests.
- Full offline unit gate: 162 files / 1,120 tests passed with two workers,
  including integration and scenario/evaluation tests. A subsequently added
  interrupted-resume diagnostic test and the final HTTP compatibility assertion
  passed in the final focused run: 12 files / 166 tests.
- Conformance: 13 files / 86 tests passed.
- Lint, boundaries, format, documentation and diff checks passed. The docs
  checker reports 31 pre-existing non-gating historical path warnings.
- No live infrastructure/provider tests ran: they require separate authority
  and do not establish additional proof for this offline mapping change.
- No versions, published artifacts or A008 files changed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md`.
- [x] New ADR and collection index.
- [x] Public facade/runtime README guidance.
- [x] `docs/JOURNAL.md` and task archive.

## Handoff and Follow-ups

- Current state: Complete; implementation, regression proof and documentation
  delivered on codex/acme-0192-tool-strict-mode.
- Final delivery: commit/push this archive and open the implementation PR.
- Next step after review: separately authorize a release of the changed core,
  both adapters, model-runtime and facade. A008 then applies its MCP defaults
  and original-schema validation/correction policy.
- Blockers: None.
- Publication and A008 adoption require separate work after review.

## Finalize When Complete

Archive under `docs/finished/`, restore `docs/template_CURRENT_TASK.md`, and
leave a signed journal entry with checks and outstanding release responsibility.
