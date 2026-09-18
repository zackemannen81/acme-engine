# ACME-0185 — honor non-streaming model execution intent

Task ID: ACME-0185
Parent Task: A008-0127 (external consumer blocker)
Status: In Progress
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; claim revision `785ff26`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant model-runtime ADRs

## Task Summary

A008''s in-process migration exposed that `ModelExecutionEngine` selects a gateway''s `stream()` method whenever one exists, even when the model request explicitly carries `stream: false`. Chat Completions then sends a non-streaming provider request but ACME attempts to consume the JSON response as SSE, producing truncated/invalid stream failures and incorrect timeout semantics.

## Task Charter

### Goal

Make ACME honor explicit non-streaming model request intent without changing streaming defaults or provider semantics.

### Primary Deliverable

`ModelExecutionEngine` uses `gateway.generate()` when a validated model request explicitly sets `stream: false`, and otherwise preserves the existing streamed execution path when the gateway supports streaming.

### In Scope

- Change the engine''s generate-vs-stream selection at the model execution boundary.
- Add focused engine regressions for explicit `stream:false`, explicit/default streaming behavior, terminal response/evidence, and provider transport shape.
- Verify Chat Completions non-streaming JSON responses are consumed through `generate()`.
- Verify streaming requests still emit deltas and terminal completion through `stream()`.
- Release the unchanged public package topology as npm version `0.1.2` using the verified pnpm-pack/tarball publication procedure from ACME-0184.
- Verify registry manifests contain concrete internal `0.1.2` dependencies and a clean consumer can import/use `acme-engine@0.1.2`.
- Update required project status/system/journal documentation.

### Out of Scope

- A008 implementation changes.
- Provider routing or profile-selection changes.
- New streaming APIs or callback semantics.
- Changing provider adapters'' existing wire formats.
- Memory, cognition, orchestration or task-runtime behavior.
- Automatic fallback/retry policy changes.
- Package-topology or public-API redesign.

### Definition of Done

- Explicit `stream:false` executes through `ModelGateway.generate()` even when `stream()` is available.
- Requests that are not explicitly non-streaming preserve the existing streamed path when supported.
- Non-streaming Chat Completions JSON completes successfully and is not classified as a truncated stream.
- Streaming event ordering/evidence behavior remains unchanged.
- Relevant core/model-runtime/adapter tests, typecheck/build, docs checks and diff checks pass.
- All seven public packages are published at `0.1.2` from verified pnpm tarballs with concrete internal dependency versions.
- A clean registry-only consumer installs/imports `acme-engine@0.1.2` successfully.

### Minimum Verification Gates

- [ ] Focused ModelExecutionEngine generate-vs-stream regression.
- [ ] Chat Completions explicit non-stream JSON regression.
- [ ] Existing streaming engine/adapter regression.
- [ ] Public closure build/typecheck/tests.
- [ ] Version/lockfile consistency at 0.1.2.
- [ ] Tarball manifests contain no `workspace:*`.
- [ ] Clean tarball consumer proof.
- [ ] npm publication from verified tarballs in dependency order.
- [ ] Registry manifest verification.
- [ ] Clean registry-only consumer import/runtime proof.
- [ ] `pnpm docs:check` and `git diff --check`.

## Checklist

- [ ] Add failing regression that proves explicit `stream:false` must use `generate()`.
- [ ] Make the minimal engine selection fix.
- [ ] Run focused and public-closure verification.
- [ ] Update version/package-lock metadata to 0.1.2.
- [ ] Pack and inspect all public tarballs.
- [ ] Prove tarballs in a clean external consumer.
- [ ] Publish verified tarballs and inspect registry manifests.
- [ ] Prove registry-only install/import.
- [ ] Update CURRENT_STATUS, SYSTEMDOC and JOURNAL.
- [ ] Archive the completed task and restore CURRENT_TASK template.

## Decisions and Notes

- This task is a bounded blocker discovered by A008-0127.
- The consumer''s explicit non-streaming intent is authoritative. Gateway capability availability must not override it.
- No A008-side workaround is accepted as the primary repair because the incorrect execution-mode choice is inside ACME''s model execution boundary.

## Charter Amendment Log

-none

## Verification

Pending.

