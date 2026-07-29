# System Documentation

Last updated: 2026-07-29
Status: Approved pre-implementation architecture

This document describes long-lived system boundaries. It does not claim that
the runtime currently exists. Exact contracts, storage schema, protocols and
milestones are defined in
[`docs/design/acme-design-and-development-spec.md`](design/acme-design-and-development-spec.md).

## System Purpose

ACME coordinates typed, model-backed tasks while keeping model communication,
domain interpretation, memory mechanics, state transitions and persistence
separate.

## Core Responsibilities

### ExecutionEngine

- Accept one typed task request.
- Resolve the module and task definition.
- Load the expected state revision and relevant memory.
- Build and execute a model request when required.
- Validate and interpret the response.
- Coordinate memory and state processing.
- Commit results through persistence ports.
- Return a structured execution result.

It does not own domain vocabulary or multi-step workflow definitions.

### Contract System

- Version prompt/model interfaces.
- Runtime-validate contract input and output.
- Declare required model capabilities.
- Build provider-neutral requests.
- Perform technical and semantic validation.

Contracts do not write state or persistence.

### DomainModule

- Own task definitions and contract selection.
- Project domain context into contract input.
- Interpret validated contract output.
- Own domain memory policy.
- Own state reducer and invariants.

### MemoryEngine

- Manage generic candidate and record lifecycle.
- Preserve provenance and timestamps.
- Execute domain-provided comparison and lifecycle strategies.
- Retrieve records through ports.

It does not define what a relationship, claim or comfort anchor means.

### StateEngine

- Check expected revision.
- Validate a typed domain delta.
- Apply the domain reducer immutably.
- Run domain invariants.
- Produce the next versioned snapshot and transition provenance.

It is not a universal unvalidated JSON Patch engine.

### Persistence and Ledger

- Persist executions and model calls.
- Persist documents, memory and versioned state.
- Make commit idempotent.
- Detect stale state revisions.
- Support replay after partial failure.
- Publish committed events through an outbox boundary.

## State Ownership

Core uses a generic state envelope:

```ts
interface StateSnapshot<TState> {
  entityId: string;
  namespace: string;
  schemaVersion: string;
  revision: number;
  value: TState;
  updatedAt: string;
}
```

Each domain owns and validates its `TState`.

## Trust Boundary

```text
Raw provider response
  → technical normalization
  → parsing
  → runtime schema validation
  → semantic validation
  → ContractOutput
  → DomainModule interpretation
  → ModuleResult candidates
  → domain policies and invariants
  → committed memory/state/events
```

No earlier stage is canonical truth.

## Initial Persistence Direction

- In-memory adapters for deterministic tests.
- SQLite in WAL mode for the first durable local implementation.
- One aggregate repository owns the atomic Unit of Work.
- State uses complete snapshots, explicit transitions and revision
  compare-and-swap.
- Model responses are durably recorded before interpretation and canonical
  commit.
- Domain events and outbox rows commit together.
- No production database decision has been made.

## Initial Domain Proof

- NarrativeModule
- ResearchModule

Core is not accepted as domain-neutral until both use it without domain
branches in core.

## Implementation Baseline

- Node.js 24 LTS, pnpm 10, strict ESM TypeScript 6 and Zod 4.
- Static task-typed module and contract registries.
- Core, testing, in-memory, SQLite, model adapters and reference modules are
  separate workspace packages.
- `ExecutionEngine` executes one task; `ScenarioRunner` sequences tasks.
- Retry, repair and revision are bounded and ledgered.
- Replay uses recorded model results and never invokes a live provider.
- Structured logs redact content by default.

## Deliberately Deferred Decisions

- production hosting and production database
- dynamic module discovery
- workflow runtime beyond ScenarioRunner
- vector retrieval
- provider-specific reconciliation details
- encryption key lifecycle and privacy deletion

These require evidence and ADRs before implementation.
