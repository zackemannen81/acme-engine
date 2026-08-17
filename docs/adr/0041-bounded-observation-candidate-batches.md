# ADR 0041 — Bounded observation candidate batches

Status: Accepted

Date: 2026-08-15

Decision owners: ACME maintainers

## Context

ADR-0039 permits one bounded `observe-artifact` provider operation, and
ADR-0040 admits one authorized Stage A judicial-text class. ACME-0107
implemented that operation with the active source-neutral
`evidence.observe-artifact@1.1.0` prompt contract. The output document contained
an unconstrained observation array and the request allowed 2,048 output tokens.

ACME-0111 exercised the exact hosted product path with a 52-page authorized
source. OpenAI accepted the request but returned `incomplete/max_output_tokens`
after 2,048 output tokens. The encrypted candidate began as a JSON object and
ended before its closing delimiter. ACME correctly refused it at the strict
JSON parse boundary, committed no engine transaction and projected no product
observation.

The failure exposed two meanings that had been conflated. An observation call
is a bounded candidate-generation operation, but the unconstrained array
suggested exhaustive full-source extraction. Increasing only the token limit
would still leave output cardinality and cost unbounded. Silently truncating or
salvaging invalid JSON would weaken the trust pipeline.

## Decision

### 1. One operation returns one bounded reviewer batch

The active `observe-artifact` prompt contract returns between one and eight
materially distinct observation candidates. Eight is the maximum cardinality
of one operation, not a statement about how many observations the source
contains.

The prompt must call the result a non-exhaustive reviewer candidate batch and
must not claim full-source coverage. Product and reviewer semantics remain
unchanged: every returned candidate still requires exact source binding,
runtime/semantic validation and human review before it gains reviewed standing.

### 2. Contract versioning preserves replay

The change is additive:

- `evidence.observe-artifact@1.0.0` remains the historical synthetic-worded,
  unbounded, 2,048-output-token contract;
- `evidence.observe-artifact@1.1.0` remains the historical source-neutral,
  unbounded, 2,048-output-token contract; and
- `evidence.observe-artifact@1.2.0` becomes active with one-to-eight candidates,
  explicit non-exhaustive wording and an 8,192-output-token request.

All three remain registered in every composition that may replay existing
executions. Existing output document version `/1`, stored candidates, evidence
identities and human-review records do not change. The new prompt-contract
version owns the narrower generation/validation boundary.

### 3. The provider wire carries the cardinality bound

The active output schema carries `minItems: 1` and `maxItems: 8`; strict-schema
lowering must preserve both on the provider wire. The runtime parser applies
the same schema, so a ninth item refuses even if a provider ignores the wire
constraint.

The active request uses `maxOutputTokens: 8192`, matching the live gateway's
already declared maximum output capability. This is a provider output-token
bound, independent of ADR-0039's model-call and monetary ceilings. A configured
monetary value such as 20,000 minor SEK units means 200 SEK; it is never treated
as a token count.

### 4. Completeness remains a separate workflow problem

A successful batch proves only that its returned candidates are valid and
source-bound. It does not prove that the full source was exhaustively analyzed
or that omitted evidence does not exist.

Exhaustive or coverage-oriented work requires a separately decided workflow:
for example deterministic source segmentation, stable segment identities,
per-segment execution evidence, deduplication and a reviewer-visible coverage
projection. The single-task ExecutionEngine remains unchanged, and this ADR
does not simulate completeness by repeated hidden calls.

## Alternatives Considered

### Raise only `maxOutputTokens`

- Benefits: smallest code change.
- Costs: observation count, output cost and completion remain unbounded; a long
  source can still hit any finite limit.
- Reason not selected: it treats the symptom without defining operation
  semantics.

### Salvage the complete prefix of truncated JSON

- Benefits: might recover some candidates without another provider call.
- Costs: accepts a document the contract did not produce, bypasses strict JSON
  validation and can silently discard a partially emitted candidate.
- Reason not selected: model output must never become canonical state through
  best-effort repair outside the bounded response pipeline.

### Make one call exhaustive for every admitted source

- Benefits: simple reviewer story if it could be guaranteed.
- Costs: impossible to guarantee under bounded context/output/cost, and it
  couples source-size authority to model-specific limits.
- Reason not selected: completeness needs explicit coverage state and workflow
  evidence, not a prompt assertion.

### Add automatic multi-call chunking now

- Benefits: creates a path toward systematic coverage.
- Costs: changes operation identity, workflow scheduling, call budgets,
  deduplication, review UX and restart semantics beyond the observed defect.
- Reason not selected: it is an independently valuable workflow deliverable
  and outside ACME-0112.

## Consequences

### Positive

- One provider operation has explicit cardinality, token and call bounds.
- Strict structured output can complete without relying on invalid-response
  salvage.
- Historical encrypted responses remain resolvable by their original prompt
  contracts.
- Reviewers are not told that a bounded candidate batch is exhaustive.

### Negative

- A large source may require a later coverage workflow before reviewers can
  claim systematic analysis.
- Active deterministic request hashes change and must be re-pinned; historical
  hashes remain unchanged.
- The larger output-token allowance can cost more per call, while still staying
  below the independent monetary and one-call gates.

## Compatibility and Migration

No stored product or execution record is migrated. Composition registries add
`@1.2.0` and retain both earlier versions. New executions resolve the active
catalogue version; replay resolves the version recorded on the original
execution. Rollback selects `@1.1.0` for new work without deleting any `@1.2.0`
evidence.

## Verification

- Assert active request output budget and non-exhaustive wording.
- Assert active schema accepts one/eight candidates and refuses nine.
- Assert strict provider lowering preserves `minItems` and `maxItems`.
- Pin active request hashes and retain exact `@1.0.0`/`@1.1.0` hashes.
- Prove all three versions resolve in live, local and restart-capable
  compositions.
- Run canonical offline and PostgreSQL gates before another live acceptance.

## References

- ADR-0011 — Prompt contracts and contract registry
- ADR-0039 — Evidence Workbench live model boundary
- ADR-0040 — POC #1 live product applicability
- ACME-0107 — Stage A live observation job
- ACME-0111 — superseded real-provider acceptance
