# ACME Project Brief

Status: Approved direction
Last updated: 2026-08-06

## Identity

- Name: ACME
- Expansion: Adaptive Context Memory Engine
- Repository: `acme-engine`
- Phase: Milestones 1 and 2 delivered; experimental live path proven
  (see `docs/CURRENT_STATUS.md`)

## Problem

AI systems commonly combine prompting, provider calls, domain interpretation,
memory, state mutation and persistence in one service layer. This makes domain
logic difficult to replace, model outputs difficult to audit and executions
difficult to replay safely.

ACME will test whether these responsibilities can be separated into a
domain-neutral execution core and interchangeable domain modules.

## Approved Direction

```text
PromptContract controls communication with the model.
DomainModule interprets validated model output.
MemoryEngine manages generic memory mechanics through a domain policy.
StateEngine applies explicit deltas through a domain reducer and invariants.
ExecutionEngine coordinates one task.
Persistence and Ledger make execution durable, traceable and replayable.
```

Narrative is a reference module. It is not the engine.

## Goals

- Execute typed AI tasks through versioned contracts.
- Keep provider details behind a model gateway.
- Treat model outputs as untrusted candidates.
- Separate memory lifecycle mechanics from domain meaning.
- Change state only through explicit, versioned transitions.
- Make executions idempotent, inspectable and replayable.
- Prove the core with at least two meaningfully different domains.
- Support deterministic offline development with mocks and fixtures.

## Non-goals

- Rebuild an existing product backend.
- Import AudioLeaf, Studio, Marketplace, Inngest or Supabase runtime concerns.
- Build a general workflow language in the first version.
- Build dynamic plugin discovery before static composition is insufficient.
- Migrate every existing narrative prompt or book type.
- Call live providers before deterministic scenario tests exist.

## Initial Reference Domains

### NarrativeModule

- Documents: outline and chapter
- Memory: character facts, relationships and world rules
- State: entity/display-name registry, canonical aliases, current scene,
  fixed short-range narrative window and outline progress

### ResearchModule

- Documents: research brief
- Memory: claims, sources, evidence and contradictions
- State: verified claims, contested claims and open questions

These modules must use the same core without domain branches such as:

```ts
if (domain === "narrative") {
  // ...
}
```

## Initial Logical Architecture

```mermaid
flowchart TB
  entry["CLI / test harness / future API"] --> runner["ScenarioRunner"]
  runner --> engine["ExecutionEngine"]
  engine --> modules["ModuleRegistry"]
  engine --> contracts["ContractRegistry"]
  engine --> gateway["ModelGateway"]
  gateway --> response["ResponsePipeline"]
  response --> module["DomainModule"]
  module --> result["ModuleResult"]
  result --> memory["MemoryEngine + DomainMemoryPolicy"]
  memory --> delta["Domain StateDelta"]
  delta --> state["StateEngine + reducer + invariants"]
  state --> commit["UnitOfWork"]
  commit --> stores["Ledger + documents + memory + state + outbox"]
```

## Required Design Corrections

### Task-typed modules

A module has multiple task input/output pairs. The module-level interface must
therefore expose a typed task map rather than one global input/output generic.

### Domain-separated state

Core must use a generic state envelope. Narrative, Research and future domains
own their schemas inside their packages.

### Policy-injected memory

Core may implement storage, retrieval, timestamps, provenance and lifecycle
execution. Domains own identity, equivalence, contradiction, merge, decay,
reinforcement, relevance and promotion rules.

### Evaluator roles

Safety is generally an evaluator or gate rather than a primary document/state
domain. Module composition must support producer, analyzer, evaluator and
transformer roles without conflating ownership.

## Durability Requirement

The first durable adapter should use SQLite and preserve:

- executions
- model calls
- documents
- memory candidates and records
- state snapshots and transitions
- committed domain events
- outbox entries

A crash after a successful model call but before state commit must be
recoverable without calling the provider again.

## First Proof Milestone

Build a replayable ExecutionEngine with:

- model mock
- in-memory stores
- SQLite stores
- `narrative.observe-document`
- `research.observe-evidence`

This milestone must test contracts, output interpretation, memory, state,
ledger, idempotency and replay without importing an existing product runtime.

## Success Test

The first platform version is successful when:

- core contains no Narrative-, Research- or Kids-specific vocabulary
- two different domains use the same execution, memory and state mechanisms
- invalid output cannot change memory or state
- every committed change is traceable to an execution and contract version
- stale state revisions fail safely
- crash recovery avoids duplicate model calls and duplicate state operations
- all core behavior can be tested without network access

## Next Deliverable

The First Proof Milestone is complete in both halves. The bounded single-task
ExecutionEngine, durable SQLite persistence, NarrativeModule and
ResearchModule are implemented; both reference domains reach committed
canonical state and replay offline through the same core with no domain branch
in it; and the live half landed as a provider adapter behind a transport port,
a ScenarioRunner over `acme-scenario/1` and `acme-scenario/2`, a domain-neutral
post-execution quality-evaluation layer and a CLI composition root.

The durability requirement above is also met. A crash after a successful model
call is recoverable without calling the provider again, an interrupted
transaction is proven to leave no partial state, and committed events can
leave the outbox.

No deliverable is currently outstanding against this brief. The Domain Test
UI decision gates and the evaluation/quality-scoring foundation are delivered.
Open choices are operational surfaces this brief never claimed: durable
quality-result storage, real event transports, redrive for dead-lettered
events, driver-error classification and key lifecycle. Their inventory,
dependencies and recommended activation order are recorded in
`docs/design/gap-resolution-plan.md` (ACME-0056). The next implementation
deliverable must still be explicitly approved before activation; preferred
WP-D, WP-O, and WP-L (plan model pin + live multi-step scenarios) landed as
ACME-0057–0064; next recommended is durable quality (Q1) or trust-stage
evidence (E1).
