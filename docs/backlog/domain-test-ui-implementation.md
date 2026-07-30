# Domain test UI implementation

Status: Backlog proposal  
Discovered in: ACME-0014

## Discovery context

ACME-0014 specifies a Domain Test UI for configuring, executing, inspecting,
validating and measuring domain tests. The specification is
[`docs/design/domain-test-ui-specification.md`](../design/domain-test-ui-specification.md).

The specification is complete enough to review but deliberately implements
nothing. It also documents that the interface has no evidence to display until
several missing engine layers exist.

## Proposed outcome

Activate the specified interface in the five ordered phases the specification
defines, starting with the pure, testable layers:

1. the `acme-test-plan/1` schema and its deterministic compiler
2. versioned read-model view contracts over recorded evidence fixtures
3. catalog and inspection surfaces over the in-memory composition
4. authoring and execution surfaces
5. measurement, human fixture review and gated live evaluation

Each phase is independently valuable and should be chartered separately. Phases
1 and 2 are the only ones that can begin against fixtures rather than a live
engine.

## Why this is outside ACME-0014

ACME-0014 packages documentation only. Adding an application package, a new
versioned configuration contract, a read model and rendering surfaces is a
cross-package implementation deliverable with its own verification story.

## Dependencies

- `ExecutionEngine` orchestration, which does not exist
- `ScenarioRunner` and its JSON report in `@acme/testing`, which do not exist
- at least one reference module, which does not exist
- the reusable `DomainModule` conformance kit implemented by ACME-0015
- `@acme/adapter-sqlite` for durable run history, which does not exist
- resolution of the seven decision gates in the specification, in particular
  the runtime shape, the `acme-test-plan/1` contract and interface storage
  location

## Suggested verification

- plan compilation is deterministic and byte-identical for identical plans
- every surface's view contract is asserted as JSON without rendering
- content payloads are redacted by default under every retention mode
- prepared memory decision order and registry order are preserved
- a live run is impossible without explicit environment opt-in, confirmation
  and a configured budget
- golden fixtures cannot be updated without a recorded human approval
- the app package imports no core internal and is imported by no other package
- no test in the package performs a network call or reads the wall clock
