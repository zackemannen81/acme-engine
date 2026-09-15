# Current Task

Task ID: ACME-0180
Parent Task: None
Status: Complete
Owner: Grok
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; claim `b915df8`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `docs/adr/0053-model-only-execution-runtime.md`
- `docs/adr/0054-model-runtime-v2-multi-provider-routing.md`
- `docs/design/acme-model-runtime-1.md`
- `docs/design/acme-model-runtime-2.md`

## Task Summary

A008 live adoption proved `acme-model-runtime/1` end to end with OpenAI, but the frozen request cannot represent all A008 generation controls and the runnable test composition has only an OpenAI Responses gateway. Add a backward-compatible v2 model-only wire and provider routing so the same ACME execution owner can carry the complete caller-owned generation request to OpenAI or OpenAI-compatible Chat Completions providers without absorbing product cognition.

## Task Charter

### Goal

Make ACME model-only execution provider-complete for A008's supported text/tool execution controls while preserving the frozen v1 wire and all model-only ownership boundaries.

### Primary Deliverable

`acme-model-runtime/2` plus a routed runnable model-runtime composition that executes prepared requests through OpenAI Responses or configured OpenAI-compatible Chat Completions gateways.

### In Scope

- Add provider-neutral optional `topP`, `reasoningBudget`, `enableThinking`, `reasoningEffort` and `seed` controls to `ModelRequest` without changing historical hashes when absent.
- Specify and implement `acme-model-runtime/2`; keep `acme-model-runtime/1` accepted and unchanged.
- Add an OpenAI-compatible Chat Completions gateway with text, reasoning, tools, continuation, streaming, usage and structured ACME error classification.
- Add explicit provider routing by caller-owned `providerHint`/selection; no model strategy inference in core.
- Add a runnable model-runtime service composition with environment-only credentials for OpenAI, NVIDIA and optional compatible endpoints.
- Preserve cancellation, ambiguity, idempotency, sequence, retention and error evidence from ADR-0014/0017/0053.

### Out of Scope

- A008 cognition, memory, retrieval, orchestration or model-choice policy.
- Automatic provider fallback after dispatch.
- Image/audio/video execution.
- Deployment, release or package publication.
- A008 GO decision or Stage 4.

### Definition of Done

- v1 compatibility and existing v1 tests remain green.
- v2 accepts and hashes all listed controls and rejects malformed/unknown fields.
- OpenAI Responses and compatible Chat Completions gateways pass provider-neutral conformance and focused streaming/tool tests.
- Routed gateway selects only the explicitly requested configured provider and fails closed when unavailable.
- Offline integration proves Luna/OpenAI and Nemotron/Kimi-style NVIDIA selections retain the controls A008 supplied.
- Runnable service starts from explicit configuration without exposing credentials.

### Minimum Verification Gates

- `pnpm docs:check`
- `pnpm format:check`
- affected package typechecks
- focused unit/conformance/integration tests
- `git diff --check`
- no live provider call required for task completion

## References

- ADR-0053 model-only execution runtime
- ADR-0054 model runtime v2 and multi-provider routing
- A008-0114 NO-GO evidence supplied by consumer

## Checklist

- [x] Accept ADR for v2/multi-provider boundary.
- [x] Extend provider-neutral request validation/hash surface additively.
- [x] Implement v2 wire/host compatibility.
- [x] Implement compatible Chat Completions gateway and router.
- [x] Implement runnable multi-provider service composition.
- [x] Add conformance/integration/control-parity regressions.
- [x] Run verification and update docs.
- [x] Archive task and restore template.

## Decisions and Notes

- `acme-model-runtime/1` is frozen and remains accepted.
- The caller owns model/provider selection and generation controls; ACME validates/routes but does not infer cognitive policy.
- Unknown or unavailable provider selections fail before dispatch; no direct-provider fallback exists inside ACME.
- NVIDIA-hosted Kimi, DeepSeek, Muse and Laguna share the Chat Completions wire with Nemotron; routing is by caller `providerHint`, not by inferring a provider family.
- OpenAI Responses maps `temperature`, `topP`, `maxOutputTokens` and `reasoningEffort`, and refuses `stop`, `seed`, `enableThinking` and `reasoningBudget`.
- Chat Completions profiles declare which controls they honor, including the thinking-template mapping (`enable_thinking` vs `thinking`).

## Charter Amendment Log

-none

## Verification

- [x] `pnpm docs:check`
- [x] `pnpm format:check`
- [x] `tsc -b` and `tsc -p tsconfig.tests.json --noEmit`
- [x] `pnpm boundaries`
- [x] Focused unit/conformance/integration: 109/109
- [x] Existing `acme-model-runtime/1` loopback: 4/4
- [x] `git diff --check`
- [x] No live provider call

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/design/acme-model-runtime-2.md`
- [x] `docs/adr/0054-model-runtime-v2-multi-provider-routing.md`

## Handoff and Follow-ups

- Current state: ACME-0180 complete. `acme-model-runtime/2`, Chat Completions adapter, explicit `providerHint` router and runnable `acme-model-runtime` composition are in the tree.
- Next recommended step: A008-0118 consume runtime/2 and prove OpenAI / Nemotron / Kimi / DeepSeek / Muse / Laguna parity against the live stack. That is A008 work, not an ACME charter expansion.
- Blockers: none inside ACME-0180.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none for this charter. A008 GO / Stage 4 remain out of scope.
