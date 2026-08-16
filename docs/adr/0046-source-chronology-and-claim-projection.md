# ADR 0046 — Source Chronology and Claim Projection

Status: Accepted
Date: 2026-08-16
Decision owners: ACME maintainers

## Context

POC #1 can already prove source binding, fail-closed validation, append-only
review and replay. After ACME-0137/0138 the extractor may return zero or many
atomic observations per coverage window. The product still does not *feel*
like ACME at the surface.

Three problems are now visible at once:

1. **The UI is an inventory of types.** Twelve navigation buttons each show
   one stored kind. A reviewer does not ask “show me the ledger”; they ask
   where a statement came from, what else overlaps it, and what they can
   stand behind now.
2. **Segmentation follows lines, not documents.** Runtime segments are
   single non-empty lines of at most 500 code points. A 1,915-page source
   becomes more than a thousand windows. Attribution (`han`) dies at a
   line break. Timeline-first segmentation would be worse: it would interpret
   the source before extraction exists.
3. **Pass 1 is already doing Pass 2.** Live `1.9.0` jobs fail
   `EVIDENCE_ACTOR_CANDIDATES_MISMATCH` because the extractor invents
   unresolved roster keys against an empty Stage A roster. That is entity
   resolution leaking into source-bound extraction.

The product definition (ADR-0028) already distinguishes a source-bound
observation, the proposition it expresses, a reviewable relation, and a
legal conclusion. This decision makes that distinction the *navigation and
pipeline* of the workbench, not only a glossary entry.

## Decision

### 1. Two graphs, one immutable object

An observation is an **occurrence**: something said, measured or reserved in
a concrete source at a concrete time. It always carries origin. It is never
rewritten into “the fact”.

Cross-source comparison is a **projection** over occurrences (relations,
groupings, timelines). Comparison must not detach or merge the occurrence.

```text
SOURCE CHRONOLOGY                 CLAIM PROJECTION
when did this enter,              what can be set against what
where is it written

Artifact → Block → Segment        Occurrence ──relation──► Occurrence
       → Observation 0..N                   │
                                            ▼
                                    event / knowledge views
```

### 2. Segmentation follows the document

Source structure is deterministic and model-free:

```text
Artifact → SourceBlock → SourceSegment → Observation 0..N
```

A block follows the document’s own units: Q+A, paragraph, headed
subsection, table row, list item, seizure post, message. Adjacent units
combine to a bounded readable size. A sentence, a question and its answer,
a table row, and a heading plus the text it governs are never split.

A coverage window is a set of those segments, optionally with
**non-evidential neighbour context** used only for reference resolution.
An observation may cite only a segment that was marked for extraction.

The model must not choose how the source is cut. Segment identity is
stable for the life of the artifact version. Later analysis must not
change what segment `N` means.

Do not segment by event timeline. Timeline is a projection after
extraction.

### 3. Three clocks stay distinct

| Clock | Meaning |
| --- | --- |
| Source time | When the utterance or record was made |
| Asserted event time | When the source claims something happened |
| Knowledge time | What the investigation could have known then (`ingestedAt` plus prior accepted occurrences) |

They must never be collapsed into one `temporalBound`.

### 4. Extraction is Pass 1 only

The observe contract answers: what is in *this* window of *this* source?

It does not receive prior interviews, other actors’ statements, or a
constructed roster unless the operator supplied one. An empty roster means
actor fields stay `null`. Unresolved candidates require a real roster.

Statement continuity, information exposure (`prompted_by`,
`exposed_to_before`) and event timeline are later operations over frozen
occurrences.

### 5. The surface is three jobs, not twelve types

The primary reviewer surface is three modes over the same observation
card:

1. **Case / source stream** — material in ingest/source order; open a
   source as a document with observations in their blocks.
2. **Claim** — group occurrences that overlap a theme; never merge them;
   show source time and exposure beside overlap.
3. **Stance** — review queue, integrity findings and assessment. Every
   row opens the same card and its citation.

Timeline is a sort switch inside Case or Claim (event / source /
knowledge), not a fourth home.

A legal or credibility conclusion remains outside the product.

### 6. Delivery is additive and stoppable

Each implementation child is a complete, replay-safe increment. Historical
contracts and existing occurrences stay byte-exact. A child may add views,
additive schemas and new default navigation; it must not require rewriting
committed evidence. Work may stop after any completed child.

The sequence and migration rules are normative in
[`../design/evidence-workbench-source-and-claim-surfaces.md`](../design/evidence-workbench-source-and-claim-surfaces.md).

## Alternatives Considered

### Make the claim the stored primary object

- Benefits: easier “all red Volvos” queries.
- Costs: origin becomes metadata; three independent utterances collapse;
  information exposure disappears; replay of “what did X say on 2 Jan”
  requires reconstruction.
- Reason not selected: ACME’s authority is the occurrence, not the theme.

### Segment by event timeline first

- Benefits: observations arrive pre-sorted for a chronology view.
- Costs: circular (interpret time to cut text to extract time); one
  interview turn can sit on three clocks at once.
- Reason not selected: timeline follows observations.

### Keep the twelve-button inventory and only restyle it

- Benefits: no information architecture work.
- Costs: the dual graph never becomes the user’s model; ACME remains an
  engine with a type browser.
- Reason not selected: the surface is the product.

### Give the extractor prior interviews for “better” actors

- Benefits: fewer unresolved labels.
- Costs: later statements absorb earlier ones; leading-question
  contamination is invisible; Pass 1 stops being source-bound.
- Reason not selected: continuity is Pass 2.

## Consequences

### Positive

- Origin and comparison stay orthogonal, which is the product thesis.
- Extraction stays fail-closed and replayable.
- The UI can show investigation-as-append-only-knowledge without a new
  core engine.
- Large sources become a coverage workflow over stable segments, not one
  impossible call.

### Negative

- Structural segmentation is a new deterministic pipeline and will
  mis-cut some real layouts; those cuts stay inspectable and versioned.
- Three modes replace familiar type names; migration must keep old
  routes until the new home is default.
- Pass 2/3 relations are a larger ontology than today’s
  `contradicts` / `qualifies`.

### Follow-ups

- Named child tasks in the surfaces specification. Do not expand this
  ADR when a child is activated.
- Date-only temporal bounds remain a separate normalized-kind decision.
- The 409 engine/product revision mismatch on some read views remains a
  separate defect.

## Compatibility and Migration

- `@1.9.0` and historical observe contracts remain registered.
- Existing line-segment observations stay valid. Structural segments are
  an additive derivation of the same canonical text; locators remain
  line-range until a later additive locator scheme is decided.
- Existing relation and assessment records stay valid. New relation
  families are additive codes, not a rewrite of stored rationale.
- Browser routes stay until a child explicitly switches the default
  entry. Old `?view=` values keep working.

## References

- [ADR-0028](0028-first-poc-evidence-integrity-workbench.md)
- [ADR-0030](0030-evidence-v1-identity-and-canonical-placement.md)
- [ADR-0031](0031-evidence-review-overlay-and-versioned-views.md)
- [ADR-0043](0043-runtime-derived-observation-quotes.md)
- [ADR-0045](0045-real-material-scale-and-recovery.md)
- [Evidence Integrity Workbench product definition](../design/evidence-integrity-workbench-product-definition.md)
- [Source and claim surfaces specification](../design/evidence-workbench-source-and-claim-surfaces.md)
- ACME-0137, ACME-0138
