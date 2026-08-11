# ADR 0030 — Evidence V1 identity and canonical placement

Status: Accepted

Date: 2026-08-11

Decision owners: ACME maintainers

## Context

ADR-0028 accepts the Evidence Integrity Workbench as ACME's first real product
POC. Its product definition separates immutable source material, source-bound
observations, candidates, relations, assessments and excluded legal authority,
but deliberately leaves exact schemas, identities and persistence placement to
the technical specification.

Those details cannot remain implicit when implementation starts. In
particular, a changed account must never acquire the same identity as a
correction, source text must not be copied into mutable state, and a model's
normalized proposition must not determine the identity of the statement that
was actually made. The rules also need to fit ACME's existing state, memory,
document and execution boundaries without adding Evidence vocabulary to core.

## Decision

### 1. V1 publishes one Evidence module contract family

The domain namespace is `evidence`. The first model-backed task and its prompt
contract are both `evidence.observe-artifact@1.0.0`.

The following public schema identifiers are immutable once implemented:

- `evidence-source-artifact-version/1`
- `evidence-locator/1`
- `evidence-actor-reference/1`
- `evidence-temporal-bound/1`
- `evidence-statement-occurrence/1`
- `evidence-exhibit-assertion/1`
- `evidence-proposition/1`
- `evidence-event-occurrence/1`
- `evidence-relation/1`
- `evidence-open-question/1`
- `evidence-assessment/1`
- `evidence-state/1`
- `evidence-delta/1`
- `evidence-observe-artifact-input/1`
- `evidence-observe-artifact-output/1`

Later tasks may add versions without changing the meaning of these identifiers.
Relation, timeline and assessment tasks remain later slices; they are not
silently folded into observation extraction.

### 2. Domain identities use named canonical preimages

Every content-derived Evidence identity uses the same mechanical sequence as
the reference-domain identities in ADR-0009:

1. validate the complete preimage;
2. serialize it with `acme-cjson-1`;
3. hash its UTF-8 bytes with SHA-256; and
4. prefix the lowercase digest with the object kind.

The algorithm name is part of the contract. A change to a preimage requires a
new algorithm identifier and a migration plan.

| Object | Algorithm | Canonical preimage |
| --- | --- | --- |
| Source artifact version | `evidence-artifact-version-id-1` | corpus id, logical artifact id, version ordinal, artifact kind, canonical content SHA-256, locator scheme and predecessor version id or `null` |
| Locator | `evidence-locator-id-1` | artifact version id, one-based inclusive start line and end line |
| Source-bound observation | `evidence-observation-id-1` | observation kind, artifact version id, locator id, exact quote, source actor-reference value or `null`, temporal-bound value or `null` |
| Accepted proposition | `evidence-proposition-id-1` | observation ids in sorted order plus the complete accepted normalized proposition |
| Event occurrence | `evidence-event-id-1` | supporting observation ids in sorted order, actor-reference keys in sorted order and complete temporal-bound value |
| Relation version | `evidence-relation-id-1` | relation kind, sorted endpoint descriptors, exact comparable scope, rationale, predecessor relation id or `null` |
| Open question | `evidence-open-question-id-1` | triggering evidence ids in sorted order, question code and complete question text |
| Assessment version | `evidence-assessment-id-1` | workspace id, assessment sequence, basis evidence revision and canonical assessment content hash |

`ActorReference` and `TemporalBound` are immutable embedded values rather than
independent registers. An actor-reference key is derived with
`evidence-actor-reference-key-1` from artifact version id, locator id, exact
source label and source role. A temporal bound has no global id; its complete
typed value participates in the identities that contain it.

An exact quoted observation is valid only when the quote occurs exactly once
as a substring of its addressed canonical line range. A wider or ambiguous
range is rejected. This avoids character offsets while keeping identity and
quote validation deterministic.

### 3. Artifact identity is content-bound and corrections are lineage-bound

V1 canonicalizes source text as UTF-8, LF line endings and Unicode NFC, with no
other transformation. The content hash is over those canonical bytes.

A corrected transcript is a new `SourceArtifactVersion` with the same logical
artifact id, the next version ordinal and an explicit predecessor version id.
It never changes the predecessor's bytes or metadata. A correction relation may
supersede the current standing of an observation only when both observations
belong to that explicit artifact-version lineage and refer to the same
underlying source occurrence.

A later interview is a different logical artifact even when the same actor is
involved. Its observations receive new identities, remain current and may be
connected by scoped relations. They can never supersede the earlier account.

Re-importing an identical artifact version addresses the same version id.
Re-running an identical observation extraction addresses the same observation
identities. A divergent reuse of any identity is a collision and is refused.

### 4. Placement follows authority and lifecycle

| Concept | Owner | Canonical placement |
| --- | --- | --- |
| Case workspace, import job and configured reviewer | Product application | Product repository |
| Source artifact version and locator index | Product-side immutable source-document repository behind a domain-facing port | Immutable document written before execution |
| Statement occurrence and exhibit assertion | Evidence domain | Domain memory |
| Accepted proposition and event occurrence | Evidence domain | Domain memory |
| Actor resolution | Evidence domain, after deterministic or human decision | Domain memory; source `ActorReference` stays embedded |
| Evidence relation version | Evidence domain | Domain memory; predecessor versions remain |
| Open question | Evidence domain | Domain memory |
| Assessment version | Evidence domain | ACME immutable document committed with its producing execution |
| Review decision and shareability overlay | Product application | Append-only product repository |
| Current evidence revision and object standings | Evidence domain | Compact canonical state |

The product writes the imported source document before a model call through an
immutable source-document port. The first Evidence execution receives that
exact artifact version as task input, so ADR-0010 source-bound validation uses
the recorded input. The source write is not an ExecutionEngine task: if later
processing fails, the durable imported source remains pending and may be
retried. A successful observation commit adds the source document id to the
Evidence state index. Assessment documents, by contrast, are produced and
committed as ACME candidate documents with their canonical state pointers.

Canonical state contains identifiers and standings only. It does not copy
source text, exact quotes, complete observations, relation rationales,
assessment prose, review decisions or execution evidence. A standing is one of
`current`, `contested`, `superseded` or `rejected`; no standing deletes the
referenced immutable record.

### 5. Authority transitions are explicit

The Evidence authority ladder is implemented as these transitions:

| From | To | Required transition |
| --- | --- | --- |
| Unregistered text | L0 source artifact version | Product import validates canonicalization, hash, manifest identity, type and line bounds, then appends an immutable document. |
| L0 | L1 source-bound observation | Structured candidate passes runtime schema validation, exact locator/quote validation, actor/time validation and Evidence policy; MemoryEngine applies an explicit decision. |
| L1 | L2 accepted proposition, actor resolution, event or time meaning | Candidate is accepted by deterministic Evidence policy or an explicit version-bound human decision; unresolved candidates remain unresolved and do not merge identities. |
| L1/L2 | L3 relation | A separately versioned relation task or deterministic builder preserves every endpoint and comparable scope; product review disposition is an overlay. |
| L1-L3 | L4 assessment version | A new immutable assessment document cites accepted identifiers, records its evidence revision and passes provenance and uncertainty gates. |
| L4 proposed | L4 shareable | A version-bound human `accept` decision exists; acceptance does not elevate the content to legal truth. |
| Any level | L5 | No transition exists. Credibility, guilt, liability, admissibility, privilege, evidentiary weight and legal sufficiency are rejected outputs. |

Model output is never one of these transitions by itself. The existing runtime
validation, domain interpretation, MemoryEngine, post-memory state projection
and expected-revision commit remain the trust path.

### 6. Evidence revision is monotonic and content-based

`evidence-state/1` contains a non-negative integer `evidenceRevision`. It
increments once for each committed Evidence aggregate operation that changes
the set or standing of canonical L0-L3 evidence. Duplicate/idempotent work and
rejected candidates do not increment it. Assessment documents and product
review decisions do not increment it.

Every state delta declares the exact added identifiers, predecessor/current
standing changes and expected next evidence revision. The reducer is pure and
invariants refuse missing references, decreasing revisions, illegal
supersession and source-text copies.

## Alternatives Considered

### Use normalized proposition text as statement identity

- Benefits: easy semantic grouping.
- Costs: a changed model normalization could rename the historical occurrence,
  and two distinct utterances could collapse.
- Reason not selected: V1 canonically records what a source contains, not the
  model's preferred world proposition.

### Store the whole evidence graph in canonical state

- Benefits: one object to query.
- Costs: source and relation content would be duplicated, state deltas would be
  large, and revision changes could silently rewrite immutable evidence.
- Reason not selected: state is the current index; documents and memory retain
  the evidence.

### Treat a later changed account as superseding the earlier one

- Benefits: fewer active records.
- Costs: destroys the platform proof and confuses correction with history.
- Reason not selected: ADR-0028 requires changed accounts to coexist.

### Make actor references and temporal bounds independent mutable entities

- Benefits: direct update APIs.
- Costs: a later edit could retroactively change an observation's meaning.
- Reason not selected: embedded immutable values plus versioned resolutions
  preserve the source record.

## Consequences

### Positive

- Every accepted observation and assessment terminates in an immutable source
  artifact version and line locator.
- Correction, changed-account and duplicate behavior are mechanically
  distinguishable.
- Evidence meaning stays in the domain module while core remains unchanged.
- State remains compact and revision-safe; history lives in immutable records.

### Negative

- A correction creates new source and observation records even where much of
  the text is unchanged.
- Actor and semantic equivalence resolution require explicit versioned records
  rather than convenient in-place edits.
- Implementations must preserve several named identity algorithms and reject
  ambiguous quote ranges.

## Compatibility and Migration

No implemented package or database changes. This decision constrains the first
Evidence implementation. Any later identity preimage, schema meaning or
placement change requires a new version and a migration ADR before code.

## Follow-ups

- The foundation slice must author the schemas, identity golden vectors and
  conformance tests described here.
- PostgreSQL tables, transaction boundaries and migrations require a separate
  ADR before the hosted adapter slice.
- Object-store/database consistency requires a separate ADR before artifact
  bytes leave the text-only V1 repository.

## References

- [ADR-0008 — Post-memory domain state projection](0008-post-memory-domain-state-projection.md)
- [ADR-0009 — Reference-domain identity and provenance](0009-reference-domain-identity-and-provenance.md)
- [ADR-0010 — Input-bound validation and interpretation](0010-input-bound-validation-and-interpretation.md)
- [ADR-0028 — First POC: Evidence Integrity Workbench](0028-first-poc-evidence-integrity-workbench.md)
- [Evidence Integrity Workbench product definition](../design/evidence-integrity-workbench-product-definition.md)
- [Evidence Integrity Workbench technical specification](../design/evidence-integrity-workbench-technical-specification.md)
