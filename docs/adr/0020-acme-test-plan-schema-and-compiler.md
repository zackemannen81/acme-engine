# ADR 0020 — `acme-test-plan/1` schema and compiler

Status: Accepted

Date: 2026-08-02

Decision owners: ACME maintainers

## Context

ADR-0019 gate 3 accepted a thin compilable test plan for the Domain Test UI
and required a separate ADR **when the schema is first exported**. This is
that ADR.

`acme-scenario/1` is already the canonical executable artifact. The
ScenarioRunner validates it with `parseScenario`, executes `execute`,
`assert`, `replay` and `assertDigest` steps serially, and emits a versioned
report. Nothing about that changes here.

What the scenario format is not is comfortable to author. A scenario is a step
list. A person configuring a run thinks in cases: this task, against this
entity, from this input, expecting this outcome. Expressing one case takes
between one and four steps whose ordering and cross-references the author must
keep consistent by hand. Aliases must match between `execute` and every step
that refers to it.

Two constraints discovered while building this shaped the result.

First, `acme-scenario/1` takes the `ModelSelection` from the mock-response
fixture, not from the execute step. The runner reads `{ selection, response }`
out of the fixture the step names. A plan therefore cannot name a model, and
an `ExecutionRequest` cannot be materialized from a plan alone: both the task
input and the model selection live in files the plan only references.

Second, the specification's illustrative plan carries a `measurements` block.
No measurement surface exists — S8 is phase 5 — so nothing would read it.

## Decision

### 1. `acme-test-plan/1` is published, versioned in the document

```yaml
schemaVersion: acme-test-plan/1
name: narrative-observe-baseline
seed:
  clock: '2026-07-31T12:00:00.000Z'
  ids: sequential
  idPrefix: narrative-phase-5
  idPadding: 3
composition:
  repository: memory
  gateway: mock
policy:
  retention: encrypted-payload
cases:
  - id: first
    namespace: narrative
    task: observe-document
    entityId: story-phase-5
    expectedRevision: 0
    input: inputs/chapter-1.json
    mockResponse: responses/chapter-1.json
    expect:
      status: committed
      revision: 1
      documentKeys: [chapter-phase-5]
      digest: digests/narrative-phase-5.json
    replay:
      mode: verify
      expect: match
```

`seed`, `composition` and `cases` are required. `policy`, and every field
marked optional above, are not.

### 2. The plan is convenience; the compiled scenario is the reviewable unit

`compileTestPlan` is a pure function from a validated plan to an
`acme-scenario/1` document. Review, diff and approval happen on the compiled
artifact. A plan that cannot compile has no other effect.

This is the whole reason the plan is allowed to exist. If the plan were the
reviewable unit, it would be a second source of truth about what runs.

### 3. Compilation is deterministic and total

Identical plans produce byte-identical canonical JSON. Every case expands in
declaration order into the same step sequence:

```text
execute  →  assert (when `expect` is present)
         →  replay (when `replay` is present)
         →  assertDigest (when `expect.digest` or `expect.operationDigest` is present)
```

Aliases are the case `id`, so cross-references cannot drift. `requestKey`
defaults to `<plan name>-<case id>` and may be set explicitly per case.

Case `policy` shallow-merges over plan `policy`, and the merged value is
resolved by the engine's own `resolveExecutionPolicy` before it is emitted, so
the compiled step carries the complete effective policy rather than a
fragment a reader has to resolve mentally.

### 4. There is exactly one policy validator, and it is the engine's

Policies are validated by `resolveExecutionPolicy` from `@acme/core` — the
same function the engine uses to resolve a request's policy. A plan cannot
express a policy the engine would reject, and the interface owns no second
policy schema that could drift from it.

### 5. The compiler reads nothing

No filesystem, no network, no clock, no environment. Fixture references are
validated as paths and copied into the compiled document as paths; the runner
loads them at run time, as it already does.

`ExecutionRequest` values are emitted only when the caller supplies
already-loaded fixture contents. Without them the request output is
`unavailable`, in the same sense ADR-0019 fixed for view sections. This is not
a limitation to work around: an `ExecutionRequest` needs the task input and
the model selection, and both are file contents.

### 6. Invalid plans cannot compile

The validator refuses, with a structured `AcmeError`:

- a missing or wrong `schemaVersion`
- an unknown field anywhere in the document
- a missing or malformed `seed`, `composition` or `cases`
- an empty case list, a duplicate case `id`, or a duplicate `requestKey`
- a policy the engine would reject
- a fixture reference that is absolute or escapes the scenario root

Path refusal reuses the phase-2 rules, so the plan compiler and the catalog
agree on what "below the root" means.

### 7. `measurements` is not in v1

The specification's illustrative plan carries a `measurements` block. No
measurement surface exists yet, so a plan carrying it would state a threshold
nothing enforces — the artifact would promise something the system does not
do. It is therefore rejected as an unknown field today.

Optional fields can be added without a version bump, so S8 can introduce it in
phase 5 without an `acme-test-plan/2`.

## Alternatives Considered

### Alternative A — No plan format; author `acme-scenario/1` directly

- Benefits: one format, nothing to compile, no new versioned contract.
- Costs: the ergonomic problem stays; a case remains up to four hand-linked
  steps with aliases the author keeps consistent manually.
- Reason not selected: gate 3 already weighed this and adopted a thin plan.
  The compiled scenario stays canonical either way, so the cost of the plan is
  bounded to a pure function and its golden.

### Alternative B — Let the plan compile to a richer runtime configuration

- Benefits: a plan could pin models, gateways and thresholds in one place.
- Costs: it would become a second engine configuration surface, diverging from
  what the runner accepts, and the compiled artifact would stop being a plain
  scenario.
- Reason not selected: ADR-0019 fixes the output set to `acme-scenario/1` and
  `ExecutionRequest`. Anything else is a second source of truth.

### Alternative C — Let the compiler read fixtures so it can always emit requests

- Benefits: complete `ExecutionRequest` values with no caller ceremony.
- Costs: the compiler becomes I/O-bound, its tests need a disk, and the
  no-I/O property that makes phase 1 and 2 cheap to verify is lost.
- Reason not selected: injection costs the caller one argument and keeps the
  compiler a pure function.

## Consequences

### Positive

- A case is authored once instead of as up to four cross-referenced steps.
- Compiled output is diffable and byte-stable, so review is on the artifact.
- A plan cannot express a policy the engine rejects.
- The compiler stays testable without a filesystem.
- Path rules are shared with the catalog rather than reimplemented.

### Negative

- A second versioned format now exists and must be maintained alongside
  `acme-scenario/1`.
- Plans cannot pin a model; that lives in the mock fixture.
- Plans authored against the specification's illustrative `measurements`
  block are rejected until phase 5 adds it.

### Follow-ups

- Phase 4: authoring and launch over compiled plans, plus run history.
- Phase 5: `measurements` as an optional field, once S8 can enforce it.
- If a scenario step ever carries its own model selection, revisit the
  request-materialization rule.

## Compatibility and Migration

Nothing existing changes. `acme-scenario/1`, `parseScenario`, the
ScenarioRunner, core, the adapters and the CLI are untouched, and every
existing scenario file keeps running unchanged.

`acme-test-plan/1` is additive and lives in `@acme/test-ui`, a leaf package
nothing imports. Optional fields may be added to the schema without a version
bump; removing or reinterpreting a field publishes `acme-test-plan/2`.

## References

- [ADR-0019 Domain Test UI boundary and view contracts](0019-domain-test-ui-boundary-and-view-contracts.md)
- [Domain Test UI — Specification](../design/domain-test-ui-specification.md)
- [ADR-0012 Milestone 1 execution identity and replay](0012-milestone-1-execution-identity-and-replay.md)
- `packages/testing/src/scenario.ts` — `acme-scenario/1` and `parseScenario`
- `packages/core/src/execution-identity.ts` — `resolveExecutionPolicy`
