# ADR 0032 — Evidence V1 correction occurrence pairing

Status: Accepted

Date: 2026-08-11

Decision owners: ACME maintainers

## Context

ADR-0030 permits supersession only when an explicit corrected artifact version
and its predecessor refer to the same underlying source occurrence. Slice 2
must project the two `EVAL-T01` corrections while proving that the later
`EVAL-T02` account remains separate. The observation model output intentionally
contains no relation or supersession instruction, so the model cannot decide
this transition.

V1 still needs one deterministic way to pair occurrences across the two
adjacent transcript versions. Matching exact quote, actor-reference identity
or exact temporal value cannot work because those values may be precisely what
the corrected transcript changes. Matching only actor identity or semantic
similarity could silently replace a later changed account.

## Decision

### 1. Correction pairing is a pure domain operation

`pairEvidenceCorrectionObservations` owns the V1 rule. Both state projection
and account-comparison views use that operation. Product code and model output
cannot independently declare that one observation supersedes another.

The operation accepts:

- one immutable predecessor `SourceArtifactVersion`;
- one immutable successor `SourceArtifactVersion`;
- the complete validated predecessor observation set; and
- the complete validated successor observation set.

It returns immutable predecessor/successor observation pairs or refuses the
whole correction.

### 2. Artifact lineage is mandatory

The successor must:

- name the predecessor's exact artifact-version id;
- use the same logical artifact id;
- have a greater version ordinal; and
- declare `transcription-correction`.

A different logical artifact is a later or independent account even when its
actor, line positions or wording are similar. It can never enter this pairing
operation successfully.

### 3. V1 occurrence keys are conservative

Within an accepted artifact lineage, an occurrence key contains exactly:

```text
observation kind
one-based start line
one-based end line
source actor label
source actor role
temporal kind
temporal role
```

Exact quote, actor-resolution identity and temporal value are excluded because
a transcription correction may change them. Every successor must match
exactly one predecessor, every predecessor may be used once, and the pairing
must be a complete bijection over both supplied observation sets.

Zero matches, multiple matches, partial pairing or a foreign artifact version
is a hard domain refusal. V1 does not guess after inserted/deleted lines or
ambiguous repeated occurrences.

### 4. State projection remains explicit and atomic

`evidence.observe-artifact@1.0.0` remains an observation-only prompt contract.
After response and source-bound validation, interpretation applies the pure
pairing rule against the recorded predecessor source and observations. Its
typed state intent names each predecessor, exact artifact lineage and
successor observation id.

Post-memory projection commits a correction only when the successor memory is
actually created. The predecessor becomes `superseded` and the successor
becomes `current` in the same Evidence revision. Immutable source and
observation records remain indexed; no content is overwritten or deleted.

### 5. Correction pairs are not the general relation task

The slice-2 `E-R01` and `E-R02` proof labels identify these two mechanical
correction pairs. This decision does not publish or implement
`evidence.relate-observations@1.0.0`, and it does not create contradiction,
qualification, scope-mismatch or unresolved relations. Those remain slice 3.

## Alternatives Considered

### Let the observation model emit a predecessor id

- Benefits: flexible across moved lines.
- Costs: changes the closed `evidence-observe-artifact-output/1` contract and
  grants a candidate generator authority to request supersession.
- Reason not selected: correction authority must remain deterministic and
  source-lineage bound.

### Pair by normalized meaning or vector similarity

- Benefits: tolerant of substantial edits.
- Costs: can merge distinct occurrences or changed accounts and is not
  replay-stable without another versioned semantic authority.
- Reason not selected: V1 prefers an explicit refusal to silent replacement.

### Store pairing only in the product repository

- Benefits: simple reviewer UI.
- Costs: canonical standings and product views could disagree; removing the
  product overlay would lose the correction transition.
- Reason not selected: correction is Evidence-domain meaning under ADR-0030.

## Consequences

### Positive

- State and views share one deterministic correction rule.
- The model cannot supersede evidence.
- Changed accounts remain distinct by construction.
- The fixed evaluation correction is replayable and fails closed on
  ambiguity.

### Negative

- A corrected source that inserts, removes or reorders relevant lines may be
  refused even when a human recognizes the intended pairing.
- V1 requires complete occurrence sets for both versions.

## Compatibility and Migration

The rule is versioned by this ADR and the exported V1 operation. A future
explicit human pairing command or locator-stable mapping requires a new
versioned contract and migration decision; it must not silently broaden this
algorithm. The observation prompt contract and identity algorithms are
unchanged.

## References

- [ADR-0008 — Post-memory domain state projection](0008-post-memory-domain-state-projection.md)
- [ADR-0010 — Input-bound validation and interpretation](0010-input-bound-validation-and-interpretation.md)
- [ADR-0030 — Evidence V1 identity and canonical placement](0030-evidence-v1-identity-and-canonical-placement.md)
- [ADR-0031 — Evidence reviewer overlay and versioned views](0031-evidence-review-overlay-and-versioned-views.md)
- [Evidence Integrity Workbench technical specification](../design/evidence-integrity-workbench-technical-specification.md)
