# ADR 0011 — Narrative knowledge and context ownership

Status: Accepted

Date: 2026-07-30

Decision owners: ACME maintainers

## Context

The pre-implementation Narrative baseline placed character facts,
relationships and world rules in memory while also placing character
attributes, relationships and world rules in canonical state. That creates
competing representations of knowledge that may be reinforced, merged,
contested or superseded.

The Narrative prompt also needs short-range continuity without allowing a
large state window to become an informal replacement for memory retrieval.
The existing baseline called the window configurable and did not define how
the exact ending of the previous document reaches the prompt.

Both boundaries must be immutable before
`narrative.observe-document@1.0.0` and the first Narrative state schema are
implemented.

## Decision

### Knowledge belongs to memory

Narrative memory is the sole canonical owner of:

- character facts
- relationships
- world rules
- contradictions and correction evidence
- reinforcement, merge, contest and supersession outcomes

These values do not appear as complete competing facts in Narrative state.
The v1 state does not retain relationship or world-rule collections, and a
state character entry does not retain fact attributes.

Narrative state owns the current revisioned working position:

- the character/entity registry and display names
- canonical normalized alias authority
- current scene
- versioned bounded narrative window
- outline progress

An observed label and resolved entity key remain in the memory candidate and
record as required by ADR-0009. `projectState()` may add an entity and alias
only from an applied memory decision. A future alias merge or rename remains
an explicit state task.

The v1 state does not cache relationship or world-rule memory IDs. A future
read-optimized projection requires a concrete consumer, a new state schema
version and explicit rules that keep every memory lifecycle path
transactionally consistent.

The ownership rule is:

> Knowledge that can be reinforced, contested, merged or superseded belongs
> to memory. The current revisioned working position belongs to state.

### Fixed v1 summary window

The first state and contract use the immutable policy literal
`narrative-window-1`.

- The window contains at most two `{ documentKey, summary }` entries.
- Entries are ordered oldest to newest.
- The reducer appends the accepted current entry and retains the last two.
- State invariants reject more than two entries.
- `project()` preserves the validated state order and does not silently repair
  an oversized window.
- The projected contract input includes the policy literal.

Changing the limit, ordering or semantic purpose requires a new prompt
contract version and a new Narrative state schema version. It is not ordinary
runtime configuration.

### Exact previous-document tail

The projected contract input contains a separate previous-document handoff:

```ts
type PreviousDocumentTail =
  | {
      algorithm: "previous-document-tail-1";
      source: "initial";
      text: "";
    }
  | {
      algorithm: "previous-document-tail-1";
      source: "document-content";
      documentKey: string;
      sourceContentHash: string;
      text: string;
      truncated: boolean;
    };
```

`initial` is used only when no preceding source document exists. For every
later document, `project()` resolves the newest window entry's `documentKey`
to the corresponding loaded immutable `narrative.source` document. Missing,
ambiguous, wrong-kind or hash-invalid source evidence is a deterministic
projection failure. There is no summary fallback in v1.

`previous-document-tail-1` applies this exact procedure to the validated
source document text:

1. Replace every non-empty run of Unicode `White_Space` code points with one
   ASCII space and trim leading and trailing whitespace. No other character,
   normalization form, punctuation or word is changed.
2. Scan Unicode code points from left to right. A sentence boundary consists
   of a non-empty run of `.`, `!`, `?` or `…`, followed by zero or more of
   `"`, `'`, `”`, `’`, `»`, `)`, `]` or `}`, followed by an ASCII space or
   end of input. The terminal and closing characters belong to the preceding
   sentence.
3. Treat a final non-empty fragment without such a terminal as a sentence.
4. Discard empty segments and select the last at most two sentences.
5. Join selected sentences with one ASCII space.
6. If the result exceeds 320 Unicode code points, retain the last 320 code
   points and trim only leading whitespace introduced at the cut boundary.
   Set `truncated` to `true`; otherwise set it to `false`.

The document's stored `contentHash` is copied to `sourceContentHash`. The
algorithm does not use locale-sensitive segmentation, a model, a store lookup
beyond the supplied read context, wall-clock time, environment data or
configuration.

The implementation must golden-test at least:

- initial context
- one sentence and an unterminated final fragment
- more than two sentences
- terminal punctuation followed by closing quotation marks
- Unicode whitespace normalization
- a result exceeding 320 Unicode code points
- missing and mismatched source evidence

The previous tail is projected context, not canonical state and not memory.
The source document remains the sole canonical owner of the raw content.

### Context layers

The v1 prompt receives three intentionally separate continuity layers:

1. `previous-document-tail-1` for the exact local handoff
2. `narrative-window-1` for at most two interpreted summaries
3. relevant memory retrieval for long-term facts, relationships and world
   rules

The small fixed window is part of the domain-neutrality proof: short-range
context cannot mask missing or incorrect memory retrieval behavior.

## Alternatives Considered

### Keep relationships and world rules in both state and memory

- Benefits: direct state reads are convenient.
- Costs: two canonical values may diverge after merge, contest, supersession
  or lifecycle changes.
- Reason not selected: convenience does not justify competing truth.

### Store only memory IDs in v1 state

- Benefits: state can point to settled relationship and world-rule records.
- Costs: every memory lifecycle path must maintain referential consistency,
  while StateEngine cannot validate records it does not receive.
- Reason not selected: no v1 consumer requires the added projection.

### Make the narrative window configurable

- Benefits: applications can tune prompt context without a release.
- Costs: execution semantics and request hashes vary under one contract/state
  version, and a large window can substitute for memory.
- Reason not selected: context policy is part of the versioned domain
  contract.

### Fall back to the previous summary when source content is unavailable

- Benefits: projection can continue with incomplete document reads.
- Costs: an interpreted summary would be mislabeled as an exact source tail
  and could hide an orchestration or evidence defect.
- Reason not selected: v1 fails explicitly when required source evidence is
  absent.

### Persist the tail in state

- Benefits: projection does not need the previous source document.
- Costs: raw content gains a second persisted representation and provenance
  may drift.
- Reason not selected: the latest window key already identifies the source;
  deterministic projection derives the tail from the loaded document.

## Consequences

### Positive

- Narrative knowledge has one canonical, auditable lifecycle in memory.
- State remains a compact revisioned working position.
- Long-term continuity must be supplied by memory retrieval rather than prompt
  accumulation.
- The exact local handoff is source-backed, bounded and replayable.
- Window and tail behavior are contract-fingerprint and golden-test inputs.

### Negative

- Prompt projection must receive the previous source document when one exists.
- The deliberately simple sentence algorithm does not attempt linguistic
  abbreviation or locale handling.
- Changing context limits or segmentation requires explicit version
  migration.
- Consumers needing read-optimized relationship or world-rule views must
  derive them from memory or propose a later versioned projection.

## Compatibility and Migration

No Narrative package, immutable v1 contract or persisted Narrative state
exists. This decision corrects the pre-implementation baseline without data
migration.

`narrative-window-1` and `previous-document-tail-1` are immutable. Any change
to their literals, input source, whitespace handling, sentence segmentation,
ordering, limits, provenance fields or failure behavior requires new
algorithm/policy identifiers, a new prompt contract version, a new Narrative
state schema version where applicable and compatibility review.

ADR-0011 refines ADR-0009's Narrative state sketch without changing its
identity normalization, alias authority, correction evidence or golden
vector.

## Follow-ups

- ACME-0017 implements the schemas, algorithms and golden fixtures.
- The Narrative reducer and invariants enforce `narrative-window-1`.
- Module conformance fixtures load the exact previous source document.
- Future ExecutionEngine context loading must treat missing required previous
  document evidence as a deterministic pre-call failure.

## References

- [ACME project brief](../PROJECT_BRIEF.md)
- [ACME specification, NarrativeModule](../design/acme-design-and-development-spec.md#16-reference-vertical-slice-narrativemodule)
- [NarrativeModule build and test plan](../design/narrative-module-build-and-test-plan.md)
- [ADR 0008 — Post-memory domain state projection](0008-post-memory-domain-state-projection.md)
- [ADR 0009 — Reference-domain identity and provenance](0009-reference-domain-identity-and-provenance.md)
- [ADR 0010 — Input-bound validation and interpretation](0010-input-bound-validation-and-interpretation.md)
- [ACME-0017 task charter](../CURRENT_TASK.md)
