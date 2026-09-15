# Current Task

Task ID: ACME-0180
Parent Task: None
Status: Ready
Owner: OpenAI assistant
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
- `docs/design/acme-model-runtime-1.md`

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
- A008-0114 NO-GO evidence supplied by consumer

## Checklist

- [ ] Accept ADR for v2/multi-provider boundary.
- [ ] Extend provider-neutral request validation/hash surface additively.
- [ ] Implement v2 wire/host compatibility.
- [ ] Implement compatible Chat Completions gateway and router.
- [ ] Implement runnable multi-provider service composition.
- [ ] Add conformance/integration/control-parity regressions.
- [ ] Run verification and update docs.
- [ ] Archive task and restore template.

## Decisions and Notes

- `acme-model-runtime/1` is frozen and remains accepted.
- The caller owns model/provider selection and generation controls; ACME validates/routes but does not infer cognitive policy.
- Unknown or unavailable provider selections fail before dispatch; no direct-provider fallback exists inside ACME.

## Charter Amendment Log

-none

## Verification
