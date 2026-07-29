# ADR 0002 — Static task-typed module composition

Status: Accepted

Date: 2026-07-29

Decision owners: ACME maintainers

## Context

A domain module owns multiple tasks with different input, contract-output and
result types. One module-wide input/output generic loses those relationships.
Dynamic plugin discovery would also move validation and compatibility failures
to runtime before ACME has a demonstrated need for it.

Narrative must be a consumer of the engine, not the engine itself. A second,
meaningfully different Research module must use the same core.

## Decision

Each `DomainModule` owns a statically declared `TaskMap`. Every
`TaskDefinition` binds its own:

- task input schema
- contract reference
- context projection
- validated contract output type
- interpretation into a `ModuleResult`

The composition root builds immutable module and contract registries.
Authoring helpers preserve task-name/input inference; runtime registry
boundaries erase generics only after schemas and unique keys are registered.

Core contains no module imports or namespace branches. Modules depend only on
core contracts and never on concrete adapters.

## Alternatives Considered

### One input and output generic per module

- Benefits: smaller interface.
- Costs: unions, casts and loss of task-specific inference.
- Reason not selected: it misrepresents the actual relationship between tasks.

### Dynamic plugin discovery

- Benefits: deploy modules without rebuilding the composition root.
- Costs: runtime loading, trust, version negotiation and debugging complexity.
- Reason not selected: no first-version requirement justifies those costs.

### Domain switch inside core

- Benefits: simple initial dispatch.
- Costs: makes Narrative or Research vocabulary part of the engine.
- Reason not selected: directly violates the domain-neutral goal.

## Consequences

### Positive

- Task authors receive compile-time input/output guidance.
- Registration errors fail at startup.
- Package boundaries visibly prove domain neutrality.
- Static composition is easy to test and replay.

### Negative

- Runtime registry code needs a carefully contained erased type boundary.
- Adding a module requires changing the composition root and rebuilding.
- Type-level tests are required to prevent inference regressions.

### Follow-ups

- ACME Milestone 1 implements compile-time `test-d` examples.
- Dynamic discovery requires a future ADR and demonstrated need.

## Compatibility and Migration

Task names and contract references are persisted execution identity. Renaming a
task creates a new task identity or requires an explicit compatibility alias.
Registry construction rejects duplicate namespaces and contract keys.

## References

- [ACME specification, sections 8–10](../design/acme-design-and-development-spec.md#8-contracts-and-registries)
- [ACME project brief](../PROJECT_BRIEF.md)
