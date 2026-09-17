# Current Task

Task ID: ACME-0182
Parent Task: None
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-17
Last updated: 2026-09-17
Charter frozen at: 2026-09-17; claim revision e263715

## Task Summary

Add the already-modeled ACME image content part to the OpenAI-compatible Chat Completions wire mapping so A008 can use native vision through the normal ACME execution substrate.

## Task Charter

### Goal
Map provider-neutral user image parts to standard Chat Completions `image_url` content blocks without changing execution, cognition, tool, retry, or memory semantics.

### Primary Deliverable
A bounded adapter change in `@acme/adapter-model-chat-completions` with focused regressions.

### In Scope
- Permit `text` + `image` content parts on non-assistant user messages.
- Map `{type:"image", mediaType, dataRef}` to `{type:"image_url", image_url:{url:dataRef}}`.
- Preserve byte-identical text-only request behavior.
- Reject image parts on unsupported roles or malformed/empty refs through existing request errors.
- Add adapter tests for vision mapping and text-only parity.

### Out of Scope
- Provider capability discovery, A008 UI/protocol work, image fetching/storage, OCR, image generation, OpenAI Responses adapter vision, or ACME cognitive/memory changes.

### Definition of Done
- User text+image request produces Chat Completions multimodal content array in supplied order.
- Existing text-only requests remain plain string content.
- Tool/assistant semantics remain unchanged.
- Adapter tests, typecheck/build/docs check and `git diff --check` pass.

### Minimum Verification Gates
- [x] Focused adapter tests pass.
- [x] Workspace typecheck/build relevant gates pass.
- [x] `pnpm docs:check` passes.
- [x] `git diff --check` passes.

## Checklist
- [x] Implement wire mapping.
- [x] Add regressions.
- [x] Run gates.
- [x] Update current docs, archive, restore CURRENT_TASK template.

## Charter Amendment Log
- none
