# Current Task

Task ID: ACME-0176
Parent Task: None
Status: Complete
Owner: Grok (delegated)
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; project direction revision `6b347b9`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `docs/adr/0017-durable-execution-resume.md`
- `docs/adr/0051-canonical-acme-runtime-boundary.md`

## Task Summary

ACME can durably execute domain tasks and can expose the full `ExecutionEngine`
through `acme-runtime/1`, but its provider-neutral `ModelRequest` is currently
structured-JSON-only and the OpenAI adapter is buffered/text-only with no tool
or streaming contract.An external AI product must be able to hand ACME one fully prepared model call
and receive reliable provider execution without invoking ACME domain modules,
semantic interpretation, memory or state. The existing `/v1/execute` path is
therefore explicitly not the integration surface for this task.

## Task Charter

The charter is frozen. Do not widen this task into product orchestration or an
A008-specific implementation.

### Goal

Add a domain-neutral **model-only execution runtime** that can execute one
already-prepared text/tool model request with streaming, cancellation,
idempotent durable evidence and provider isolation, while preserving every
existing structured-JSON execution behavior.

### Primary Deliverable

A versioned model-execution contract and runnable ACME runtime surface, distinct
from full `ExecutionEngine` task execution, backed by ACME's provider gateway,
model-call evidence and durability rules. It must support plain-text output,
function-tool schemas/tool-call results and ordered streaming events.

### In Scope

- Extend `ModelRequest.output` to a discriminated `json | text` contract; existing
  JSON requests and their canonical request hashes remain compatible.
- Add provider-neutral function-tool definitions and normalized tool-call output.
- Admit caller-supplied tool-result messages for a subsequent model execution.- Add an ordered provider-neutral stream contract for reasoning/content deltas,
  fragmented tool-call deltas and terminal normalized completion/evidence.
- Extend the existing OpenAI Responses gateway/transport to honor `text` output,
  function tools, tool-result continuation and SSE streaming while retaining the
  ADR-0014 delivery/ambiguity classifications.
- Add a model-only execution owner that validates one prepared request, checks
  capabilities, computes request identity, reserves the model call before
  dispatch, records success/failure/ambiguity, applies retention and exposes
  usage/cost/evidence without invoking application semantics.
- Expose that owner through a **new versioned external model-execution runtime
  protocol/surface**. Do not overload `acme-runtime/1` `/v1/execute`, whose
  meaning remains full `ExecutionEngine` task execution.
- Keep authentication as a composition port and apply explicit request, stream
  event and retained-payload bounds.
- Treat supplied messages, tool schemas, tool results and selected model as
  caller-owned execution input. ACME may validate their execution shape but may
  not choose, remove, enrich or reinterpret them semantically.
- Preserve ACME's conservative ambiguity rule: after dispatch, an unobserved or
  ambiguous provider outcome is evidence, not permission for an automatic retry.
- Preserve recoverability of a successfully retained model response without a
  second provider call.
- Expose safe diagnostic evidence sufficient to distinguish timeout, cancel,
  provider HTTP failure, malformed/truncated stream, ambiguous delivery and
  completed response, without exposing credentials or retained payload by
  default.

### Out of Scope

- Any A008 source, type, naming, memory model, orchestration rule or product
  behavior; ACME remains a reusable execution runtime.- DomainModule, ContractRegistry task projection, ResponsePipeline semantic
  interpretation, MemoryEngine, StateEngine, domain reducers and state commits.
- Tool approval, tool execution, agent loops, delegation, context retrieval,
  model selection strategy or deciding whether another model call is useful.
- Semantic repair of malformed tool calls or guessed completion of truncated
  provider output.
- Automatic retry of an ambiguous or already-dispatched call.
- New provider families, multimodal expansion, deployment, TLS/DNS or a public
  authentication scheme.
- Changes to Evidence V2, the frozen Evidence Workbench/POC #1 application or
  the established meaning of `acme-runtime/1`.

### Definition of Done

- Existing structured-JSON `ModelRequest` fixtures, validation, request hashes,
  gateway conformance and replay/durability tests remain compatible.
- A text/no-tool execution emits ordered stream deltas and a validated terminal
  normalized result through the model-only runtime.
- Function tools are mapped structurally, fragmented provider tool-call output
  is assembled deterministically, and ACME returns the call without executing it.
- A later caller-prepared request containing the corresponding tool result is
  accepted and executed as a distinct bounded model execution.
- Cancellation propagates through model-only runtime -> gateway -> provider
  transport; timeout/network/HTTP/truncated-stream cases retain honest evidence.
- Same request identity is idempotent; a conflicting reuse fails closed; a
  successfully retained response survives process/repository restart without a
  second provider call. Ambiguous/in-flight evidence never auto-retries.
- A real loopback model-only runtime transport test proves request, SSE stream,
  terminal result and disconnect cancellation with a deterministic fake provider.- Tests prove the model-only path invokes no DomainModule, domain contract
  projection, MemoryEngine, StateEngine or domain commit path.
- Canonical ACME documentation distinguishes full task execution from model-only
  execution and records the new runtime protocol without weakening ADR-0014/17.
- Required canonical code gates pass with no live provider call.

### Minimum Verification Gates

- [x] Core validation/hash regression for historical JSON requests plus new text
  and tool request forms.
- [x] Shared gateway conformance covers text, tools and ordered streaming without
  weakening existing buffered/structured-output cases.
- [x] OpenAI fixture tests cover fragmented content/tool SSE, usage, finish
  reasons, malformed/truncated stream, HTTP failures, timeout and cancellation.
- [x] In-memory and durable persistence prove reservation-before-dispatch,
  idempotent terminal reuse, retained-response restart and ambiguous no-retry.
- [x] A boundary test fails if the model-only path calls domain modules, memory,
  state, reducers or full `ExecutionEngine.execute()`.
- [x] Real loopback HTTP/SSE model-runtime proof uses a deterministic local
  provider and validates disconnect cancellation.
- [x] `pnpm docs:check`, format, lint, typecheck, boundaries, unit, conformance,
  integration, scenarios, build and applicable PostgreSQL gates pass.
- [x] `git diff --check` passes; no live provider call, deployment or publication.

## References

- `docs/PROJECT_BRIEF.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `docs/adr/0017-durable-execution-resume.md`
- `docs/adr/0051-canonical-acme-runtime-boundary.md`
- `packages/core/src/model.ts`
- `packages/core/src/repository-model-call.ts`
- `packages/adapter-model-openai/src/request.ts`
- `packages/adapter-model-openai/src/transport.ts`
## Checklist

- [x] Record an ADR for the model-only execution boundary and its relationship
  to ADR-0014, ADR-0017 and ADR-0051.
- [x] Generalize the provider-neutral model contract for text output and tools
  without changing historical JSON semantics or identities.
- [x] Add ordered streaming primitives and extend gateway conformance.
- [x] Extend the OpenAI Responses adapter/transport for text, tools, tool-result
  continuation and SSE.
- [x] Implement the model-only durable execution owner using existing ACME
  execution/model-call evidence rules where they apply.
- [x] Add the separate versioned external model-execution runtime surface.
- [x] Add deterministic failure, cancellation, idempotency, restart and
  domain-boundary regressions.
- [x] Run canonical gates and update owning documentation.
- [x] Archive, hand off and restore `docs/CURRENT_TASK.md` before completion.

## Decisions and Notes

- `/v1/execute` is intentionally not reused. It is a full domain-task execution
  surface and would cross the non-cognitive model-execution boundary.
- Tool schemas and tool-call results are execution data. ACME does not approve or
  execute tools and does not infer what a tool call means.
- Streaming is observability/delivery of one model execution. Stream events do
  not become domain events, memory or canonical application state.
- No mechanical retry policy may weaken ADR-0014's ambiguous-call rule. A later
  retry design requires an explicit architecture decision with duplicate-call
  safety evidence.
- The implementation must remain useful to clients other than A008.
- Frozen consumer wire: `docs/design/acme-model-runtime-1.md` (`acme-model-runtime/1`).
  Machine-readable twin: `apps/cli/src/acme-model-runtime-wire.ts`.
  Architecture: `docs/adr/0053-model-only-execution-runtime.md`.

## Charter Amendment Log

- none
## Verification

- [x] Record exact focused and canonical gate commands/results.
- [x] Record proof that historical structured-JSON execution remains unchanged.
- [x] Record proof that no domain/memory/state authority is reachable from the
  model-only runtime path.
- [x] Record skipped checks and reasons; live-provider verification is not
  required by this charter.

Focused:

- `pnpm exec vitest run packages/core/test/model-request-hash.test.ts`
  golden vector `b0ae4b222a04c393ed24e1364b93d828211af5885f721de55f72ff5e76b46bd3`
  unchanged; text/tools hashes differ.
- `packages/core/test/model-execution-engine.test.ts` text stream, tool-result
  continuation, idempotency, conflict, ambiguous no-retry, no domain imports.
- `packages/adapter-model-openai/test/gateway.test.ts` text/tools mapping,
  fragmented SSE, truncated stream, HTTP 401, ambiguous no-response.
- `packages/adapter-memory/test/model-execution-repository.test.ts` reserve
  before dispatch and encrypted reveal.
- `packages/adapter-sqlite/test/model-execution-repository.test.ts` restart
  without a second provider call; ambiguous no-retry after reopen.
- `tests/integration/model-execution-boundary.test.ts` spies never called.
- `tests/integration/acme-model-runtime-listener.test.ts` loopback SSE and
  disconnect cancellation through a local fake provider.

Canonical:

- `pnpm docs:check` passed (321 Markdown files; historical-path warnings only).
- `pnpm format:check` passed.
- `pnpm lint` passed.
- `pnpm exec tsc -b --pretty false` passed.
- `pnpm exec tsc -p tsconfig.tests.json --noEmit` passed.
- `pnpm boundaries` passed.
- `pnpm test:unit` passed 153 files / 1018 tests.
- `pnpm test:conformance` passed 12 files / 80 tests.
- `pnpm test:integration` passed 19 files / 94 tests.
- `pnpm test:scenario` passed 7 files / 26 tests.
- `git diff --check` passed.

Skipped:

- Live provider calls: not required by this charter.
- `pnpm test:postgres`: no `ACME_POSTGRES_URL` in this environment. Existing
  PostgreSQL execution schema is unchanged; model-only persistence is a sibling
  SQLite/in-memory store. Applicable postgres gates were not runnable here.
- Deployment and publication: not in scope.

Historical JSON proof: golden `acme-model-request-hash-1` vector unchanged;
gateway `generate` JSON fixtures and `ExecutionEngine` scenario tests still
pass.

Domain-boundary proof: `ModelExecutionEngine` does not import
`execution-engine.js`, `memory-engine.js`, `state-engine.js`, `modules.js` or
`response-pipeline.js`; integration spies on execute/interpret/retrieve/apply
were never invoked.

## Documentation Updates

- [x] `docs/PROJECT_BRIEF.md` if the general execution-runtime direction needs a
  durable clarification.
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] new/updated ADR and `docs/adr/README.md`

## Handoff and Follow-ups

- Current state: ACME-0176 complete. `acme-model-runtime/1` is the frozen
  consumer wire.
- Next recommended step: A008 (or any other client) can build against
  `docs/design/acme-model-runtime-1.md`. A later task may compose a runnable
  `acme-model-runtime` process analogously to ACME-0169.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none remaining inside this charter.

## Finalize When Complete

- Archive under `docs/finished/ACME-0176_*.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry and leave downstream integration evidence
  sufficient for A008 to build against without chat-history assumptions.
