# Current Task

Task ID: ACME-0025
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-07-31
Last updated: 2026-07-31
Charter frozen at: 2026-07-31

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0007-deterministic-model-mock-and-gateway-conformance.md`
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/backlog/encrypted-payload-retention.md`
- `packages/core/src/model.ts` and `packages/core/src/model-validation.ts`
- `packages/testing/src/model-gateway-conformance.ts`
- `packages/adapter-model-mock/src/scripted-model-gateway.ts`

## Task Summary

ACME has never spoken to a real provider. The `ModelGateway` port, the
provider-neutral request and response types, the error taxonomy and a
non-empty gateway conformance suite all exist, but the only implementation is
a scripted mock. Two things are therefore unproven: whether a real provider's
wire format maps cleanly onto the existing contract, and whether that mapping
can be built without provider vocabulary reaching core.

This task answers both offline. It introduces a transport port so the entire
provider mapping — request construction, response normalization and error
classification — is exercised against recorded fixtures with no network. The
real network transport is deliberately a later task.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Prove ACME can speak a real provider's wire format through the existing
`ModelGateway` contract without provider format or provider semantics reaching
`packages/core`.

### Primary Deliverable

A `packages/adapter-model-openai` package implementing `ModelGateway` over an
injected transport port, passing the unchanged shared gateway conformance
suite against recorded fixtures, plus an accepted ADR fixing the live-provider
boundary.

### In Scope

- A new `packages/adapter-model-openai` workspace package targeting the
  OpenAI Responses API only, depending on `@acme/core` and its schema runtime.
- A transport port owned by the adapter. The adapter owns every provider wire
  shape; the transport carries only an opaque request and response, so it can
  be substituted by a fixture with no network.
- Request mapping from the provider-neutral `ModelRequest`, including the
  structured-output contract, temperature, token bounds and stop sequences.
- Response normalization into `NormalizedModelResponse`, including provider,
  model, response ID, finish reason, text, usage and metadata.
- Classification of provider and transport failures into the existing error
  taxonomy: `MODEL_RATE_LIMIT`, `MODEL_AUTH`, `MODEL_UNAVAILABLE`,
  `MODEL_CONTENT_FILTER`, `MODEL_INVALID_RESPONSE`, `TIMEOUT` and `CANCELLED`.
- `capabilities()` resolution from static configuration, never from a network
  probe.
- Hand-written provider fixtures covering success, each classified failure and
  at least one malformed response.
- Execution of the unchanged `modelGatewayConformance()` suite against the
  adapter with a fixture transport.
- Boundary rules and a negative fixture proving no package outside this
  adapter reaches provider wire shapes, plus a core vocabulary guard extension
  for provider names.
- ADR fixing: the transport port boundary; the failure classification table;
  which failures are `ambiguous` versus cleanly `failed`; what idempotency and
  reconciliation mean across a network boundary; and the retention decision
  recorded in `docs/CURRENT_STATUS.md`.
- Documentation updates to `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`,
  `docs/FILESTRUCTURE.md` and `docs/JOURNAL.md`.

### Out of Scope

- Any real network transport, credential handling or environment reading. No
  test may open a socket, and nothing in this task may be given an API key.
- Any live provider call, budget or spend. That is a later approved task.
- Implementing encrypted retention. The ADR decides the question; closing it
  stays in `docs/backlog/encrypted-payload-retention.md`.
- Changing `ModelGateway`, `ModelRequest`, `NormalizedModelResponse`, the
  error taxonomy or the gateway conformance suite to fit the provider. If the
  provider genuinely cannot be expressed through the contract, that is a
  finding: pause and raise a bounded child task.
- The Chat Completions surface, explicitly. It is not a fallback, not a
  compatibility layer and not a portability hedge.
- Streaming, hosted tools, vision, embeddings and multi-call flows.
- ScenarioRunner, CLI composition and the Domain Test UI.
- A second provider. The port must not be shaped to one provider's quirks, but
  proving portability is a later task.

### Definition of Done

- `@acme/adapter-model-openai` passes the unchanged
  `modelGatewayConformance()` suite with a fixture transport.
- Every fixture round-trips: a recorded provider response normalizes to the
  expected `NormalizedModelResponse`, byte-for-byte under canonical JSON.
- Each error-taxonomy code reachable from this provider has a fixture proving
  the classification, and the ADR's table matches the implementation.
- The ADR states explicitly which failures leave the call `ambiguous` and why,
  and the implementation produces that status through `failModelCall`.
- Boundary checks prove provider wire shapes are unreachable from core,
  modules, other adapters and apps, verified by a failing negative fixture.
- The core vocabulary guard rejects provider names in `packages/core/src`.
- No network access occurs in any test, provable by the absence of any
  transport implementation that can reach one.
- All frozen verification gates pass, or every skipped check is recorded with
  its reason.
- The task is archived under `docs/finished/` and `docs/CURRENT_TASK.md` is
  restored or repopulated.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm build`
- [x] `git diff --check`

## References

- `packages/core/src/model.ts`
- `packages/core/src/model-validation.ts`
- `packages/core/src/errors.ts`
- `packages/core/src/repository-model-call.ts` for the `ambiguous` status
- `packages/testing/src/model-gateway-conformance.ts`
- `packages/adapter-model-mock/src/scripted-model-gateway.ts`
- `docs/backlog/encrypted-payload-retention.md`

## Checklist

- [x] Read the required documents and the existing gateway surface in order.
- [x] Settle the provider surface and retention decisions.
- [x] Freeze this charter by moving the status from `Draft` to `Ready`.
- [x] Draft and accept the ADR before implementing.
- [x] Scaffold `packages/adapter-model-openai` with workspace and build wiring.
- [x] Define the transport port and the fixture transport.
- [x] Implement request mapping with golden fixtures.
- [x] Implement response normalization with golden fixtures.
- [x] Implement failure classification, including the ambiguous cases.
- [x] Implement `capabilities()` from static configuration.
- [x] Run the unchanged gateway conformance suite against the adapter.
- [x] Extend boundary rules, the negative fixture and the vocabulary guard.
- [x] Run every frozen verification gate and record evidence.
- [x] Update the long-lived documentation and add the signed journal entry.
- [x] Archive ACME-0025 and restore or repopulate `docs/CURRENT_TASK.md`.

## Decisions and Notes

- A checkpoint after each step is required. The checklist is updated along the
  work and `CURRENT_STATUS.md` is updated when changes affect behavior.
- The interesting problem is not request mapping, which is craft. It is the
  `ambiguous` model-call status: core and both repository adapters already
  handle it, but nothing in the workspace produces it. A transport that fails
  after the request was sent is exactly where it becomes real, because the
  provider may have executed and charged. The ADR must say which failures are
  ambiguous and the transport port must carry enough information to tell them
  apart.
- Injecting the transport is what makes this task fully offline and CI-safe.
  It is also the reason the real transport can be a separate, budgeted task
  without redoing any mapping work.
- ADR-0007 already fixed the deterministic mock and the gateway conformance
  boundary. This task implements a second gateway against that same boundary;
  it does not reopen it.
- Provider-surface decision, 2026-07-31: the first OpenAI adapter targets the
  Responses API only. It is OpenAI's primary surface for hosted tools, agentic
  behavior, richer output objects and current cache control. Chat Completions
  is excluded outright rather than kept as a fallback or compatibility layer,
  because selecting it for portability would mean testing ACME against the
  less expressive boundary. Portability is the `ModelGateway` port's job to
  prove, not something to buy by weakening the first adapter. Part of the
  rationale was that the richer surface keeps future options open, including
  provider-side caching of large recurring context. That is background for the
  decision, not a requirement of this task, and no claim is made here about
  any specific model's caching behavior.
- Retention decision, 2026-07-31: live executions use `hash-only` until real
  encrypted retention exists. The payload is deliberately not persisted, and
  replay for those executions therefore returns `unavailable` rather than
  `failed`. That distinction is the point: the evidence is absent by policy,
  not lost by error. Closing the gap stays in
  `docs/backlog/encrypted-payload-retention.md`.
- Known limitation, 2026-07-31: the provider fixtures are hand-written from
  our understanding of the Responses wire format, not captured from a live
  call. They make the adapter internally consistent and fully testable, but
  they cannot prove our belief about the wire format is correct. Only the
  later live task can confirm that. This is stated plainly in the ADR rather
  than left implicit, because a self-consistent wrong belief is exactly the
  failure mode fixture-driven work invites.
- Finding, 2026-07-31: the shared gateway conformance suite requires deeply
  frozen error data, but `AcmeError` freezes its `data` shallowly. The adapter
  now deep-freezes `details` before constructing the error. Fixed in the
  adapter, not in the suite.
- Mapping decision, 2026-07-31: stop sequences and non-text content parts are
  rejected as `INVALID_REQUEST` rather than silently dropped, because dropping
  them would change response semantics without saying so.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- None.

## Verification

- [x] Prove the gateway conformance suite file is unchanged.
- [x] Prove every fixture round-trips under canonical JSON.
- [x] Prove the ADR's classification table matches the implementation.
- [x] Prove no test can reach the network.
- [x] State the hand-written-fixture limitation in the ADR rather than
      implying the wire format is confirmed.
- [x] Record exact test counts for every gate.
- [x] Document skipped checks and reasons.

Verification completed on 2026-07-31:

- `packages/testing/src/model-gateway-conformance.ts` is untouched; the mock
  and the OpenAI adapter run the identical file.
- `pnpm docs:check` passed for 62 Markdown files after archival.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
- `pnpm boundaries` passed dependency, core-vocabulary and the
  core/module/cross-module/provider/SQLite-driver forbidden fixtures.
- `pnpm test:unit` passed 281 tests in 35 files.
- `pnpm test:conformance` passed 46 tests in 7 files.
- `pnpm test:integration` passed 13 tests in 2 files.
- `pnpm test:scenario` passed 5 tests in 2 files.
- `git diff --check` passed.
- Network access is structurally impossible rather than merely untested: the
  package ships no transport implementation, every test supplies a fixture
  transport, and the adapter reads no environment variable.
- Skipped checks: none.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR for the live-provider boundary.

## Handoff and Follow-ups

- Current state: ACME-0025 is complete. ADR-0014 fixes the live-provider
  boundary and `@acme/adapter-model-openai` implements the Responses mapping
  behind an injected transport port, passing the unchanged gateway conformance
  suite offline. Every frozen gate passed.
- Next recommended step: The agreed order puts a thin CLI composition root
  next, giving `execute`, `replay` and `inspect` a real surface and letting
  something outside tests select an adapter. ScenarioRunner and the budgeted
  live test follow.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None. Both were settled before the charter was frozen:
  Responses API only, and `hash-only` for live executions.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
