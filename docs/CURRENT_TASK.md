# ACME-0186 — preserve timeout classification after streamed response start

Task ID: ACME-0186
Parent Task: ACME-0185 / A008-0127 consumer migration
Status: In Progress
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; claim revision `c528c39`

## Task Summary

A008-0127 proves that the Chat Completions streaming adapter overwrites an explicit transport timeout with `MODEL_INVALID_RESPONSE` whenever HTTP 2xx response-start already occurred. This loses the caller's provider-timeout semantics even though the transport knows the terminal reason is timeout.

## Goal

Preserve a known transport timeout as ACME `TIMEOUT` after a successful HTTP response has started, without weakening truncated-stream detection for network/other incomplete streams.

## Primary Deliverable

In Chat Completions `stream()`, a `no-response` event with `reason: "timeout"` is classified by the existing `classifyNoResponse()` path before the post-response-start invalid-response rule. Non-timeout interruption after a 2xx response-start retains the current `MODEL_INVALID_RESPONSE` behavior.

## In Scope

- Add focused streaming timeout regression.
- Preserve existing network/truncated-stream invalid-response regression.
- Apply the minimal classification-order fix in the Chat Completions gateway.
- Run focused adapter/runtime and full relevant verification.
- Publish only the changed public dependency path as patch release 0.1.3:
  - `@acme-engine/adapter-model-chat-completions@0.1.3`
  - `@acme-engine/model-runtime@0.1.3`
  - `acme-engine@0.1.3`
- Pack with pnpm, inspect concrete internal versions, prove tarball and registry consumers.
- Update status/system/journal docs.

## Out of Scope

- A008 implementation changes.
- Changing non-timeout truncated-stream classification.
- Retry/fallback policy.
- Core ModelExecutionEngine changes.
- Provider routing/model selection changes.
- Re-versioning unchanged ACME packages solely for cosmetic version alignment.

## Definition of Done

- Streaming timeout after HTTP 2xx response-start surfaces ACME code `TIMEOUT`.
- Streaming network/other interruption after HTTP 2xx response-start remains `MODEL_INVALID_RESPONSE`.
- Existing streaming success semantics remain unchanged.
- Focused adapter/model-runtime, full unit/typecheck/build/conformance, docs/diff gates pass.
- Verified 0.1.3 tarballs publish successfully for the three changed dependency-path packages.
- Clean registry consumer installs `acme-engine@0.1.3` and preserves timeout classification.
