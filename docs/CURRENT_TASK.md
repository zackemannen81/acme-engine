# Current Task

Task ID: ACME-0188
Parent Task: None
Status: Ready
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; task identity claim merged in `2079fa9`

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

ACME already contains a native OpenAI Responses gateway with tools, reasoning-effort, structured-output and streaming support. A008 moved Luna onto the generic compatible Chat Completions route during its embedded-runtime migration because the native Responses adapter rejects ACME image content parts. ACME-0188 restores native Responses parity for invocation-local image input without changing Chat Completions behavior or A008 cognition.

## Task Charter

### Goal

Allow ACME `ModelContentPart { type: "image" }` on user messages to map deterministically to OpenAI Responses `input_image` content while preserving all existing Responses semantics.

### Primary Deliverable

The native OpenAI Responses adapter accepts mixed user text/image content and emits ordered `input_text` / `input_image` parts using the existing image `dataRef` as `image_url`.

### In Scope

- Map user-message image content parts to Responses `{ type: "input_image", image_url: dataRef }`.
- Preserve mixed text/image order within the user message.
- Reject empty image `dataRef` before transport.
- Continue rejecting image parts on roles whose image semantics are not represented by this adapter contract.
- Add adapter regressions for image-only, mixed ordered content and malformed/unsupported role cases.
- Add model-runtime regression proving an `openAi` profile with `vision: true` routes a native image request through the Responses gateway.
- Publish the affected public dependency closure as 0.1.5 if verification is green.

### Out of Scope

- Any Chat Completions adapter changes.
- A008 provider routing/config changes; those require a separate A008 task after this package is proven.
- Image generation, audio/video/file inputs or built-in OpenAI tools.
- Durable image history or memory semantics.
- Provider-side image preprocessing, upload or file IDs.
- Stateful Responses `previous_response_id` / `store` changes.

### Definition of Done

- Native Responses body maps a user image `dataRef` to `input_image.image_url`.
- Mixed user text/image part order is preserved.
- Empty image refs and assistant/system/tool image parts fail before transport.
- Existing tools, reasoning, structured-output, stream and failure regressions remain green.
- Model runtime can select an `openAi` profile declaring vision and execute the image request through native Responses.
- 0.1.5 package closure contains no `workspace:*` leakage and a clean consumer can exercise the mapping.

### Minimum Verification Gates

- [ ] Focused OpenAI adapter request/gateway tests.
- [ ] Model-runtime native OpenAI image route regression.
- [ ] Adapter/model-runtime typecheck + build.
- [ ] Full unit and conformance suites.
- [ ] Format/lint/boundaries/docs/diff checks.
- [ ] Packed-manifest inspection.
- [ ] Registry-only 0.1.5 consumer proof after publication.

## References

- Existing `createOpenAiResponsesGateway` in `@acme-engine/adapter-model-openai`.
- Existing ACME image content contract in `@acme-engine/core`.
- ACME-0182 Chat Completions native-image parity as the sibling adapter precedent.
- OpenAI Responses image input contract: user input content may contain `input_image` with `image_url`.

## Checklist

- [x] Claim task id.
- [x] Freeze charter.
- [x] Add Responses image mapping and validation.
- [x] Add adapter/runtime regressions.
- [x] Run verification gates.
- [ ] Bump/publish public closure 0.1.5.
- [ ] Verify clean registry consumer.
- [ ] Update docs, archive task and restore template.

## Decisions and Notes

- The existing `dataRef` is provider-ready input (A008 supplies a data URL); ACME does not own source-store resolution or base64 encoding.
- User-message image support is sufficient for current A008 parity because invocation-local images are not committed to durable conversation history.
- No statefulness behavior is added; this task only restores missing input modality parity on the existing stateless/replayable Responses adapter.
- The current Chat Completions path remains untouched for NVIDIA/KIE/compatible providers.

## Charter Amendment Log

- none

## Verification

- OpenAI Responses adapter gateway suite: 51/51 passed after image mapping.
- `@acme-engine/adapter-model-openai` typecheck passed.
- `git diff --check` passed for the first implementation checkpoint.
- Focused adapter + model-runtime suite: 55/55 passed; runtime proof emitted `/v1/responses` with ordered `input_text` + `input_image`, `max_output_tokens` and reasoning effort.
- `@acme-engine/model-runtime` typecheck passed.
- Full static gates passed: format, lint, boundaries, docs, typecheck, build and diff-check. Docs check reports the same 34 historical non-gating missing-path citations.
- Full unit suite: 161/161 files, 1086/1086 tests passed.
- Full conformance suite: 13/13 files, 86/86 tests passed.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes

## Handoff and Follow-ups

- Current state: charter frozen; implementation pending.
- Next recommended step: implement ordered user text/image mapping in the native Responses request builder.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
