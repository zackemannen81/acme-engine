# ADR 0010 — Input-bound validation and interpretation

Status: Accepted

Date: 2026-07-30

Decision owners: ACME maintainers

## Context

The original contract boundary validated response semantics with only model
output:

```ts
validateSemantics(output)
```

Task interpretation similarly received only validated output and read
context:

```ts
interpret(output, context)
```

That is insufficient for source-backed tasks. A contract cannot prove an
evidence quote occurs in the supplied document, and a module cannot construct
candidate documents or domain evidence from the original typed request
without a closure, mutable task instance, context abuse or hidden engine
state. The gap blocks ACME-0012's reference-domain provenance decision and
would make replay dependent on values not represented in the pure function
signatures.

## Decision

### Contract semantic validation

`PromptContract` binds its typed input to semantic output validation:

```ts
validateSemantics(
  output: TOutput,
  input: TInput,
): readonly SemanticIssue[];
```

`ResponsePipeline` requires that input:

```ts
process<TInput, TOutput>(
  response: NormalizedModelResponse,
  contract: PromptContract<TInput, TOutput>,
  input: TInput,
): PipelineResult<TOutput>;
```

Before reading response text, the pipeline:

1. validates input through `contract.inputSchema`;
2. proves schema validation did not coerce or transform its canonical JSON;
3. canonical-JSON clones the validated input; and
4. deeply freezes the detached clone.

Invalid input returns non-repairable stage `input`. Schema issues use
`CONTRACT_INPUT_SCHEMA`, non-JSON values use
`CONTRACT_INPUT_NON_JSON_VALUE`, and schema transformations use
`CONTRACT_INPUT_SCHEMA_COERCION`. A model response cannot repair invalid
contract input, so no response cleanup, parsing or semantic callback occurs.

For valid input, the existing empty, parse, output-schema and semantic stages
retain their order and repairability. Output is canonical-JSON cloned and
deeply frozen before `validateSemantics(output, input)`. The successful
pipeline value is that same immutable detached output. Parsed hashes still
cover the validated output only; the complete provider-neutral request hash
already covers contract input as projected into the request.

Semantic validation remains synchronous and pure. It may compare output with
input but cannot read stores, providers, clocks, environment or randomness.

### Task interpretation

`TaskDefinition` binds original typed task input to interpretation:

```ts
interpret(
  output: TContractOutput,
  input: TInput,
  context: ExecutionReadContext<TState>,
): Promise<ModuleResult<TDelta>> | ModuleResult<TDelta>;
```

The future ExecutionEngine must validate the task request through
`task.inputSchema`, retain a detached deeply frozen value and pass that same
validated value to both task projection and interpretation. This child
changes the public signature and compile-time proof; it does not implement the
absent ExecutionEngine.

Contract input and task input are intentionally distinct. `project()` derives
provider-facing contract input from task input plus read context. Contract
semantic validation receives the projected contract input needed to check the
response protocol. Domain interpretation receives the original task input
needed to construct documents and domain candidates.

### Replay

Replay uses recorded validated task input, reproduces contract projection,
validates recorded output against the reproduced contract input and invokes
interpretation with the same recorded task input. No closure or transient
task-instance state participates.

## Alternatives Considered

### Let validators close over the latest input

- Benefits: no signature change.
- Costs: singleton contracts become mutable, concurrent calls race and replay
  depends on call order.
- Reason not selected: contract registries contain immutable definitions.

### Pass task input through `ExecutionReadContext`

- Benefits: one interpretation argument.
- Costs: read context would mix request data with canonical repository reads
  and weaken task typing.
- Reason not selected: input has its own schema and ownership boundary.

### Echo evidence or source text in model output

- Benefits: output-only validators can compare fields.
- Costs: an untrusted model can fabricate both values; no comparison with the
  actual request occurs.
- Reason not selected: model output cannot authenticate its own provenance.

### Defer all input/output comparison to module policy

- Benefits: smaller contract pipeline.
- Costs: invalid protocol output reaches interpretation, and policies still
  lack original task input.
- Reason not selected: prompt-contract semantics belong at the contract trust
  boundary.

## Consequences

### Positive

- Contracts can deterministically verify quotes, locators and other
  input-bound response facts.
- Modules can construct exact source documents and candidates from validated
  task input.
- Function signatures contain all replay-relevant values.
- Semantic callbacks cannot mutate caller-owned or pipeline output values.
- Task input/output/projection inference remains task-specific.

### Negative

- Every response-pipeline caller must retain and pass contract input.
- Every task implementation must accept its typed task input again during
  interpretation.
- Input JSON purity and no-coercion rules are enforced a second time at the
  response trust boundary.
- Existing pre-implementation public signatures change.

## Compatibility and Migration

No ExecutionEngine, reference module or published package uses the old
signatures. Existing tests and contract fixtures are updated in ACME-0013.
Future changes to validation order, input failure repairability or replay input
binding require compatibility review and an ADR.

## Follow-ups

- ACME-0012 resumes and uses contract input for exact source-quote checks and
  task input for retained source evidence.
- The future ExecutionEngine must prove task-input validation, immutable
  retention and exact reuse across `project()` and `interpret()`.
- The reusable DomainModule conformance kit must verify task input binding and
  mutation resistance.

## References

- [ACME specification, contracts and registries](../design/acme-design-and-development-spec.md#8-contracts-and-registries)
- [ACME specification, task-typed modules](../design/acme-design-and-development-spec.md#10-task-typed-domain-modules)
- [ADR 0002 — Static task-typed module composition](0002-static-task-typed-module-composition.md)
- [ACME-0012 task](../finished/ACME-0012_reference-domain-identity-and-provenance.md)
- [ACME-0013 task charter](../CURRENT_TASK.md)
