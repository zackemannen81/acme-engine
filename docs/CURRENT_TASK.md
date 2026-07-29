# Current Task

Task ID: ACME-0009
Parent Task: None
Status: Draft
Owner: Codex
Created: 2026-07-30
Last updated: 2026-07-30
Charter frozen at:

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/design/acme-design-and-development-spec.md`, sections 5.2–5.3, 9,
  14 and 19
- `docs/adr/0006-aggregate-in-memory-unit-of-work.md`
- `docs/finished/ACME-0008_aggregate-in-memory-unit-of-work.md`
- `packages/core/src/model.ts`
- `packages/core/src/repository-model-call.ts`

## Task Summary

Continue Milestone 1 with a deterministic, provider-neutral model mock and a
reusable `ModelGateway` conformance suite. Resolve the currently unspecified
model-request hash before the mock or future durable ledger depends on it, then
prove capability, cancellation, normalized response and error behavior without
network, wall-clock, filesystem or provider SDK dependencies.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Implement a deterministic scripted `ModelGateway` adapter and executable
gateway conformance contract that future provider adapters can satisfy without
changing core orchestration semantics.

### Primary Deliverable

A tested `@acme/adapter-model-mock` package that consumes explicit immutable
call scripts, matches canonical model requests exactly and passes a reusable
provider-neutral `ModelGateway` conformance suite in `@acme/testing`.

### In Scope

- Define immutable `acme-model-request-hash-1` as canonical SHA-256 over the
  complete provider-neutral `ModelRequest`, excluding call context and model
  selection because those are recorded as separate ledger fields.
- Add request-hash golden, object-order stability, array-order sensitivity and
  content-sensitivity tests.
- Correct and document the provider-neutral gateway behavior required for
  conformance: deterministic capability reporting for a supplied selection,
  required capability checks, cancellation, normalized response validation
  and ACME error semantics.
- Add ADR-0007 for deterministic model-request identity, scripted mock
  behavior and the portable gateway conformance boundary.
- Add `@acme/adapter-model-mock` with no provider SDK, network, environment,
  wall-clock, random or filesystem dependency.
- Define explicit mock profiles that map an exact `ModelSelection` to immutable
  `ModelCapabilities`; reject duplicate or malformed profile identities.
- Define finite scripted calls identified by `(executionId, callKey)` with an
  exact model selection and expected `acme-model-request-hash-1`.
- Support one explicit scripted outcome per call: a complete
  `NormalizedModelResponse` or a structured `AcmeErrorData` limited to
  `TIMEOUT` and the `MODEL_*` gateway error codes.
- Require response timestamps, usage and metadata to come from the script;
  never synthesize nondeterministic response fields or fabricate fallback
  output.
- Validate the complete script before use, including duplicate call
  identities, selection references, request hashes, response envelopes and
  model-stage error data.
- On `generate`, reject an already-aborted signal without consuming a script
  entry, reject unsupported required capabilities before consumption, match
  the exact scripted identity/selection/request hash and consume it once.
- Reject unexpected, mismatched or repeated calls deterministically with
  non-retryable test-harness diagnostics; do not silently choose another
  scripted response.
- Return and retain detached, deeply frozen data so caller-owned request,
  profile, script, response or inspection objects cannot mutate adapter state.
- Expose adapter-specific read-only invocation evidence and an assertion for
  unconsumed scripted calls without expanding the core `ModelGateway` port.
- Add a reusable `ModelGateway` conformance kit under `@acme/testing` covering
  capability discovery, required-capability rejection, pre-call
  cancellation, normalized success, structured model failure and
  immutability through the core port only.
- Activate a non-empty gateway conformance test for the mock while preserving
  the existing repository conformance gate.
- Add workspace/project references and dependency rules so the mock adapter
  depends on core only and core cannot depend on the adapter.
- Update the normative specification and long-lived documentation to
  implemented reality.

### Out of Scope

- `ExecutionEngine` orchestration, request acceptance, model-call reservation,
  ledger integration, retries, repair, revision, resume or replay.
- Changes to repository commit semantics or durable model-call recording.
- OpenAI or any live/provider-specific adapter, SDK, authentication, HTTP,
  streaming, tool execution or provider-response normalization transport.
- Delayed/timer-driven responses, timeout scheduling or simulated races;
  timeout policy remains an ExecutionEngine responsibility.
- Capture or automatic regeneration of scripts from live provider traffic.
- Filesystem fixture loading, fixture discovery or mutable golden updates;
  callers may import data and pass validated script objects.
- Narrative/Research modules, evaluators, complete scenarios, CLI behavior or
  ScenarioRunner.
- Token/cost budget enforcement, retry policy or provider reconciliation.
- SQLite, migrations, crash recovery, outbox delivery or deployment.
- Package publication, push, release or other remote mutation.

### Definition of Done

- `acme-model-request-hash-1` is explicit, versioned, documented and
  golden-tested; `ModelCallReservation.requestHash` has no ambiguous
  algorithm.
- Gateway capability, cancellation, normalized response and error semantics
  are precise enough for independent adapter implementations.
- The mock has no implicit response queue, fallback output, current-time
  access, randomness, network, filesystem or provider dependency.
- The same validated profiles and scripts plus the same calls produce
  byte-equivalent canonical responses and invocation evidence across runs.
- Exact `(executionId, callKey)`, selection and request-hash matching is
  enforced; mismatch, duplicate consumption and unconsumed scripts are
  inspectable deterministic failures.
- Capability mismatch and pre-aborted calls consume no script entry and record
  no successful provider invocation.
- Scripted normalized responses and ACME model errors are returned/thrown
  without semantic rewriting and remain detached and deeply frozen.
- A non-empty reusable gateway conformance suite passes for the mock and is
  suitable for future adapters with injected fixture transports.
- Mock-specific tests cover script validation, matching, consumption,
  mismatch diagnostics, invocation order, immutability and absence of
  nondeterministic fallback behavior.
- Core remains provider-neutral and dependency boundaries pass.
- Frozen install, format, lint, typecheck, boundaries, unit, repository plus
  gateway conformance, integration/scenario gates and build pass.
- The specification, ADR set, `CURRENT_STATUS`, `SYSTEMDOC`, `FILESTRUCTURE`
  and journal reflect implemented reality.

### Minimum Verification Gates

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm boundaries`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance` with non-empty repository and gateway suites
- [ ] `pnpm test:integration`
- [ ] `pnpm test:scenario`
- [ ] `pnpm build`
- [ ] Internal documentation links and balanced Markdown fences
- [ ] `git diff --check`

## References

- `docs/design/acme-design-and-development-spec.md`, sections 5.2–5.3, 9,
  14, 19 and Milestone 1
- `docs/adr/0006-aggregate-in-memory-unit-of-work.md`
- `docs/finished/ACME-0008_aggregate-in-memory-unit-of-work.md`
- `packages/core/src/common.ts`
- `packages/core/src/errors.ts`
- `packages/core/src/hashing.ts`
- `packages/core/src/model.ts`
- `packages/core/src/repository-model-call.ts`
- `packages/testing/src/repository-conformance.ts`

## Checklist

- [x] Verify merged ACME-0008 and read the required repository context.
- [x] Draft and bound the deterministic model-mock/gateway charter.
- [ ] Review the Draft charter with the maintainer.
- [ ] Freeze the approved charter and set status to `Ready`.
- [ ] Add ADR-0007 and correct normative gateway/request-hash contracts.
- [ ] Implement request hashing and core gateway-boundary validation.
- [ ] Add `@acme/adapter-model-mock` and dependency/project boundaries.
- [ ] Implement validated profiles, finite scripts and deterministic matching.
- [ ] Implement immutable invocation inspection and consumption assertions.
- [ ] Add reusable gateway conformance and mock-specific unit tests.
- [ ] Run every minimum verification gate and record exact evidence.
- [ ] Update long-lived documentation and add a signed completion journal.
- [ ] Archive the completed task and restore the task template.

## Decisions and Notes

- The maintainer explicitly approved drafting ACME-0009 on 2026-07-30 after
  merging ACME-0008 and synchronizing local `main`.
- Draft proposal: a scripted call is addressed by `(executionId, callKey)`.
  Selection and request hash are exact expectations, not fallback lookup keys.
- Draft proposal: call context and selection remain outside
  `acme-model-request-hash-1` because the ledger already stores them
  separately; the hash identifies only the immutable `ModelRequest`.
- Draft proposal: each call identity is consumable once. Repeated gateway
  invocation is a test failure; repository reuse and retry orchestration belong
  to the future ExecutionEngine.
- Draft proposal: pre-call cancellation and capability mismatch consume
  nothing. Scripted provider errors consume their matching call because the
  provider interaction is the intended evidence.
- Draft proposal: malformed configuration is `INVALID_REQUEST`; an unexpected,
  mismatched or repeated mock invocation is a non-retryable `INTERNAL` test
  harness failure. Neither is presented as a provider outage.
- Draft proposal: the mock uses fully scripted timestamps and response
  envelopes rather than an injected clock, preventing hidden defaults.
- Adapter inspection remains outside `ModelGateway`, following the same
  port-versus-test-evidence separation as `@acme/adapter-memory`.
- No implementation begins until this Draft is reviewed and explicitly moved
  to `Ready`.
- Apply `docs/TASK_WORKFLOW.md` to every discovered item.

## Charter Amendment Log

- None.

## Verification

- [ ] Verify request-hash golden vector, ordering and sensitivity.
- [ ] Verify exact profile and capability behavior.
- [ ] Verify success/error script outcomes and single consumption.
- [ ] Verify cancellation/capability/mismatch paths do not consume entries.
- [ ] Verify deterministic invocation order and unconsumed-script assertion.
- [ ] Verify caller inputs and returned/inspected values are detached/frozen.
- [ ] Verify reusable non-empty gateway conformance uses only the core port;
  invocation inspection remains mock-specific.
- [ ] Verify no network, environment, filesystem, current-time or randomness
  dependency.
- [ ] Verify all repository gates remain green.
- [ ] Document skipped checks and exact reasons.

## Documentation Updates

- [ ] `docs/design/acme-design-and-development-spec.md`
- [ ] `docs/adr/0007-deterministic-model-mock-and-gateway-conformance.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md`

## Handoff and Follow-ups

- Current state: Draft charter prepared for maintainer review.
- Next recommended step: Review the proposed request-hash boundary, scripted
  call identity and consumption semantics; if approved, freeze the charter.
- Blockers: Maintainer approval is required before implementation.
- Child tasks: None.
- Resume condition: Set status to `Ready`, record the freeze date and begin
  the implementation checklist.
- Open questions: None; the three principal behavioral choices are explicit
  Draft proposals above.

## Finalize When Complete

- Archive this file as
  `docs/finished/ACME-0009_deterministic-model-mock-and-gateway-conformance.md`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changes after `Ready`, supersede this task
  instead of rewriting it.
