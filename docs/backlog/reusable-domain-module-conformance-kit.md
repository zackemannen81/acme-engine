# Reusable DomainModule conformance kit

Status: Backlog proposal  
Discovered in: ACME-0010

## Discovery context

The design requires all core ports/modules to have conformance contracts, but
`@acme/testing` currently contains repository and gateway conformance only.
NarrativeModule and ResearchModule need one shared executable module boundary
to prove that they compose identically with core.

## Proposed outcome

Add a provider- and adapter-neutral `DomainModule` conformance kit under
`@acme/testing` covering:

- namespace/schema/task identity and deterministic registry behavior
- runtime input/state/delta validation
- deterministic, immutable `project()` and `interpret()` behavior
- unique document/memory/event keys
- pure initialization, reducer and invariants
- memory-policy validation and deterministic identity
- empty analyzer results where explicitly allowed
- compile-time task-name/input/output inference support

Module-specific policy semantics remain in each package's own unit tests.

## Why this is outside ACME-0010

ACME-0010 creates documentation only. Adding executable test APIs and fixtures
is a separate cross-package implementation deliverable.

## Dependencies

- current `DomainModule`, `TaskDefinition` and `ModuleResult` contracts
- `@acme/testing`
- ADR-0008 post-memory state projection and its filtering invariants

## Suggested verification

- the same suite runs unchanged for Narrative and Research fixtures
- the kit uses core ports/types only
- adapter-specific inspection is not required
- negative fixtures prove domain packages cannot import adapters
- typecheck includes valid and invalid task-name examples
