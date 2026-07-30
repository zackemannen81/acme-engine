# Domain memory decisions to state projection

Status: Backlog proposal  
Discovered in: ACME-0010

## Discovery context

`TaskDefinition.interpret()` currently returns `ModuleResult.stateDelta`
before `MemoryEngine.prepare()` produces domain memory resolutions. The
approved Narrative behavior expects resolved memory operations to influence
state, and Research promotion/contest status likewise depends on multi-source
memory decisions.

## Proposed outcome

Define one domain-neutral orchestration boundary that lets a domain project
validated prepared memory decisions into its typed state delta without moving
domain meaning into core or allowing policies to persist effects.

Candidates for review include:

- a domain hook after memory preparation
- a two-stage interpreted result with a typed projection function
- a task result that separates raw candidates from post-policy state intent

The decision must preserve replay, deterministic hashing, schema validation
and one atomic Unit of Work.

## Why this is outside ACME-0010

ACME-0010 produces implementation guides. Changing `DomainModule`,
`ModuleResult` or ExecutionEngine sequencing is a public cross-package
architecture decision requiring its own charter and ADR.

## Dependencies

- current `DomainModule` and `ModuleResult` contracts
- MemoryEngine prepared decisions
- future ExecutionEngine orchestration
- StateEngine typed delta preparation

## Suggested verification

- compile-time inference for the new typed hook/boundary
- Narrative character/relationship decision projects deterministically
- Research defer/verify/contest projects deterministically
- rejected/ignored candidates cannot alter state
- replay yields identical delta and state hashes
- core contains no domain vocabulary

