# ADR 0005 — Pure memory decision application

Status: Accepted

Date: 2026-07-29

Decision owners: ACME maintainers

## Context

ACME separates generic memory mechanics from domain meaning. Core owns stable
ordering, timestamps, provenance, record versions and application of policy
decisions. A domain policy owns identity, equivalence, contradiction, merge,
strength, relevance and lifecycle choices.

The original `MemoryResolution` contract could select `reinforce` without
supplying the resulting strength. Create and merge had the same ambiguity, and
`supersede-existing` did not describe the replacement record. A MemoryEngine
could therefore implement the contract only by inventing a generic
reinforcement/promotion rule in core or by leaving decisions incomplete.

Memory preparation must also remain separate from persistence. The future Unit
of Work needs explicit create/update candidates and expected record versions,
but the engine must not read, write or make them canonical.

## Decision

### Policy-owned results

`DomainMemoryPolicy.identity(candidate)` is the only source of a candidate's
identity key.

The resolution union carries every other domain-owned result required by core:

- `create` supplies value and resulting strength
- `reinforce` supplies target memory ID and resulting strength
- `merge` supplies target memory ID, merged value and resulting strength
- `contest` supplies the affected memory IDs
- `supersede-existing` supplies affected IDs plus replacement value and
  strength
- `reject-candidate` and `ignore` produce no record mutation

All resulting strengths must be finite and non-negative. Core does not infer,
increment, cap or decay strength.

### Stable preparation

The MemoryEngine validates candidates and existing records before policy
application. Candidates are processed by ascending candidate key. Each policy
call receives an immutable working set sorted by `identityKey`, then
`memoryId`.

A valid decision updates the working set before the next candidate is
processed. Later candidates therefore observe earlier prepared decisions
without any store access.

New records consume `IdGenerator.next("memory")` only after the complete
create or replacement decision has validated. Non-creating decisions consume
no ID. Deterministic replay fixtures must provide a deterministic generator;
canonical persistence still owns idempotency.

### Generic mutation semantics

Core applies decisions as follows:

- create/replacement records start active at record version one
- reinforce preserves value and status, updates strength, `lastSeenAt` and
  `lastReinforcedAt`
- merge replaces value, preserves status and updates the same reinforcement
  fields
- contest changes targets to `contested` and updates `lastSeenAt`
- supersede changes targets to `superseded`, updates `lastSeenAt` and creates
  the explicit replacement
- reject and ignore create decision evidence but no record mutation

Candidate provenance is appended to affected records without duplicating an
identical provenance reference. Every update increments `recordVersion`
exactly once and records the previous version as
`expectedRecordVersion`. Core returns prepared mutations but never persists
them.

### Retrieval and lifecycle

The domain policy chooses relevant records and scores. Core verifies that
ranked records came from the supplied working set, rejects duplicates and
non-finite scores, then sorts by descending score, `identityKey` and
`memoryId` before enforcing the limit.

Lifecycle runs only through an explicit engine call and explicit recorded
timestamp. `retain` has no mutation, `update-strength` prepares a versioned
update and `forget` marks the record forgotten. Background wall-clock decay is
not introduced.

## Alternatives Considered

### Core-defined reinforcement formula

- Benefits: smaller policy result and uniform mechanics.
- Costs: a universal formula would encode domain promotion and confidence
  semantics in core.
- Reason not selected: reinforcement and promotion are explicitly
  domain-owned.

### Let policies return complete records

- Benefits: maximum domain control and a small engine.
- Costs: domains would own generic IDs, scope, timestamps, provenance and
  record-version invariants.
- Reason not selected: those are core mechanics and persistence-facing
  contracts.

### Apply each decision immediately through a repository

- Benefits: the policy always observes canonical current records.
- Costs: policy evaluation becomes effectful, partial candidate application is
  possible and the final Unit of Work loses atomic ownership.
- Reason not selected: candidates remain non-canonical until one atomic
  execution commit.

### Resolve every candidate against the original snapshot

- Benefits: independent candidate decisions can be parallelized.
- Costs: two candidates in one execution can prepare conflicting mutations or
  duplicate creates for one identity.
- Reason not selected: a deterministic evolving working set preserves
  execution-local consistency.

## Consequences

### Positive

- Core applies memory decisions without domain vocabulary or hidden strength
  policy.
- Prepared mutations are explicit and suitable for future compare-and-swap.
- Multiple candidates in one execution resolve deterministically.
- Retrieval ties and lifecycle boundaries are replayable.
- Policies cannot mutate caller-owned records or candidates.

### Negative

- Policy authors must return explicit resulting strengths and replacement
  data.
- Candidate processing is sequential within one prepare call.
- Determinism of allocated memory IDs depends on the injected generator until
  canonical idempotency exists.
- The public resolution union changes before any reference module implements
  it.

## Compatibility and Migration

No persisted implementation or reference module uses the earlier resolution
shape. ACME-0007 updates the public contract before those consumers exist.
Future changes to decision semantics, record versions or strength ownership
require a new ADR and compatibility review.

## Follow-ups

- The in-memory and SQLite Unit of Work must enforce expected record versions
  and retain candidate decisions for audit.
- Narrative and Research policies must supply explicit resulting strengths.
- Replay tests must use deterministic memory ID generation or replay recorded
  canonical results.

## References

- [ACME specification, memory model](../design/acme-design-and-development-spec.md#12-memory-model)
- [ADR 0003 — SQLite revisioned Unit of Work](0003-sqlite-revisioned-unit-of-work.md)
- [ACME-0007 task charter](../finished/ACME-0007_pure-memory-engine.md)
