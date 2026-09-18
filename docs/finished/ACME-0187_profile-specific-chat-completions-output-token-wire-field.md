# Current Task

Task ID: ACME-0187
Parent Task: None
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; task identity claim merged as `a086f76`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`

## Task Summary

A008-0127 embedded ACME reaches OpenAI successfully, but ACME's generic Chat Completions adapter serializes `maxOutputTokens` as `max_tokens` for every profile. Current OpenAI chat models reject that field and require `max_completion_tokens`.

## Task Charter

### Goal

Preserve provider/profile-specific Chat Completions output-token wire naming without changing ACME's provider-neutral `maxOutputTokens` request contract.

### Primary Deliverable

Add an explicit profile-level output-token parameter choice to the Chat Completions adapter, defaulting to `max_tokens`, and allow embedded A008 OpenAI Chat Completions profiles to choose `max_completion_tokens`.

### In Scope

- Extend `ChatCompletionsModelProfile` / model-runtime chat profile config with a bounded output-token wire-field option.
- Keep default behavior as `max_tokens` for NVIDIA, KIE and existing compatible profiles.
- Add regression tests for both wire-field variants.
- Publish the affected public package closure as 0.1.4 from pnpm-packed tarballs.
- Verify a registry-only consumer.
- Update ACME status/system/journal and archive this task.

### Out of Scope

- Model-name sniffing.
- Changing ACME's provider-neutral `maxOutputTokens` API.
- Changing unrelated generation controls.
- Changing A008 cognition, memory or model-selection semantics.
- Migrating OpenAI chat calls to the Responses API.

### Definition of Done

- Default Chat Completions profiles still emit `max_tokens`.
- A profile can explicitly emit `max_completion_tokens`.
- Existing timeout and non-stream regressions remain green.
- 0.1.4 package closure is published and registry-consumable.
- A008 can consume 0.1.4 and route OpenAI chat without the unsupported-parameter failure.

### Minimum Verification Gates

- [x] Focused adapter regression for both output-token field names.
- [x] Model-runtime config propagation regression.
- [x] Full typecheck and build.
- [x] Full unit and conformance suites.
- [x] Format, lint, boundaries, docs and diff checks.
- [x] Packed manifest inspection for 0.1.4.
- [x] Registry-only 0.1.4 consumer proof.
- [x] A008 focused embedded OpenAI config/request proof.

## Checklist

- [x] Add profile-level wire-field contract.
- [x] Propagate through model-runtime config.
- [x] Add regressions.
- [x] Bump/publish public dependency closure to 0.1.4.
- [x] Verify registry consumer.
- [x] Update docs, archive task, restore template and push.

## Decisions and Notes

- The field choice is explicit profile configuration, not inferred from provider or model names.
- `max_tokens` remains the default for backward compatibility.
- A008 will opt OpenAI Chat Completions profiles into `max_completion_tokens`.

## Charter Amendment Log

- none

## Verification

- Focused adapter/model-runtime proof: 30/30 passed after rebuilding the adapter/runtime package outputs.
- Full static gates: docs-check, format, lint, boundaries, typecheck, build and diff-check passed.
- Full unit suite: 161/161 files, 1082/1082 tests passed.
- Full conformance suite: 13/13 files, 86/86 tests passed.
- pnpm-packed 0.1.4 manifests contained concrete dependency versions and no `workspace:*` leakage.
- Tarball-only consumer emitted `max_completion_tokens: 321` and omitted `max_tokens`.
- Published `@acme-engine/adapter-model-chat-completions@0.1.4`, `@acme-engine/model-runtime@0.1.4` and `acme-engine@0.1.4`.
- Fresh-cache registry-only consumer installed the 0.1.4 chain and returned `ACME_0187_REGISTRY_CONSUMER_OK 321`.
- Detached A008 proof from canonical `origin/main`, using registry `acme-engine@0.1.4`, passed build plus the embedded/parity/config suite 20/20. A dedicated OpenAI route regression then passed 7/7 and proved the A008 embedded request emitted `max_completion_tokens: 321` with no `max_tokens`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: complete and published as 0.1.4.
- Next recommended step: A008 should consume 0.1.4 and explicitly set `maxOutputTokensParameter: "max_completion_tokens"` on OpenAI Chat Completions profiles.
- Blockers: none in ACME.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.
