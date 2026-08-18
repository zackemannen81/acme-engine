# ADR 0049 — Evidence V2 surface set for the 2.0 interface

Status: Accepted
Date: 2026-08-18
Decision owners: ACME maintainers

## Context

[The V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
§6 fixes six surfaces plus two global ones and forbids dashboards, charts,
graph visualisation and report generation in V1. It was written to stop the
frozen application's failure mode: surfaces that asserted more than the
evidence carried, and that disagreed with each other about the same case
(R-07).

The approved
[Evidence Workbench 2.0 interface plan](../design/evidence-workbench-v2-interface-plan.md)
asks for three things that §6 does not name: a global chronological timeline,
a case-status surface, and a relations surface showing connections between
people, evidence and events.

Two of those are less an expansion than an omission being closed. The
specification's own acceptance journey P3 requires that "the same immutable
occurrences participate in the temporal projection", and §6 lists a case
overview under its global surfaces — but neither is named as a surface a person
navigates to. The third, relations, is genuinely a boundary question: relations
are L3 domain objects that §2 already fixes, while §6 forbids the graph the
request implies and §7 forbids the actor roster that "persons" implies.

A surface list is not a cosmetic decision. Every surface added is a place where
a projection can disagree with another projection, and every visual encoding
added is a place where the interface can assert something the evidence does
not. That is why this is an ADR and not a task note.

## Decision

### 1. `Global: Timeline` is a named surface

The surface set of §6 gains one entry:

| Surface | Does |
| --- | --- |
| Global: Timeline | case-scoped chronological projection over occurrences and claims at an explicit case revision |

Binding properties:

- It is a **projection**, never a record. It stores nothing and is
  deterministically recomputable, exactly as `ConsensusProjection` is.
- Typed time is preserved as typed. An `approximate` bound renders as
  approximate, a `range` as a range.
- Items with unknown time sort last and are **visibly unordered**, never
  silently placed. This is §2.2's instance-ordinal rule applied to the
  projection.
- Every row opens its exact source (§6 UI rule).
- It is bounded and paged (R-08). A case with 30,000 occurrences renders a
  page, not a page-height.
- It states the case revision it was computed at, and never requires equality
  between engine and product revisions (R-06).

### 2. The case-status surface is the §6 case overview

No new surface. The existing "Global: Case overview — counts and where to
resume" is what the request calls a status view, and it is implemented as:

- counts of artifacts, parts, chains, instances, occurrences and, once they
  exist, claims and relations;
- outstanding work: instances with no committed extraction, occurrences with no
  standing, windows that failed;
- where to resume.

Explicitly refused, restating §7 rather than weakening it: charts, graphs,
gauges, progress bars that imply completeness of *evidence* rather than of
*work*, scores, weights, rankings, credibility indicators and any aggregate
that no underlying row states.

A count is a fact about the workspace. It is never a finding.

### 3. The relations surface is a bounded list, not a graph

Relations render as a bounded, case-scoped list or table. Each row shows the
relation type, its rationale, its provenance, its standing, and both endpoints
resolved to their exact sources.

Graph visualisation stays out of V1, as §6 states. The reason is recorded so a
later decision can weigh it rather than rediscover it: in a graph, a thicker
edge, a more central node or a tighter cluster all read as claims about
importance, and no `Relation` in this model states importance. A list carries
the same information and asserts nothing extra. The deferred proposal is in
[the backlog](../backlog/v2-interface-deferred-features.md).

### 4. Persons are chain subjects, not roster entries

The relations surface represents people through the `Chain` subject label,
which §2.2 already derives from the document body's own labelled fields with
its own provenance.

This changes nothing about actors: ADR-0046 §4's null-actor rule stands, an
occurrence's actor field stays `null` when the source supplies none, and §7's
exclusion of "cross-case entity resolution and roster management beyond
null-actor Pass 1" is unchanged. A Pass 2 roster remains a backlog proposal.

The consequence is worth stating plainly, because it is a limitation and not a
feature: two chains for the same human being are two subjects, and the product
will not assert they are the same person. That is correct for V1 — asserting
identity across documents is an evidentiary claim, and nothing here is
authorized to make it.

### 5. Nothing else in §6 moves

The six core surfaces, the search surface, the four UI rules that may not be
broken, and every §7 exclusion are unchanged. In particular: no report
generator, no export, no assessment document, no scoring.

## Consequences

- The specification's §6 surface table is amended by §1 and §2 of this
  decision, and constrained by §3 and §4. The specification remains the
  normative document; this ADR is its authority for the change.
- ACME-0157 (shell and case status), ACME-0161 (relations) and ACME-0162
  (timeline and consensus) can freeze charters.
- Three surfaces now project over the same objects, so R-07 gains surface area:
  a projection gap must be one explicit named state on all of them, and each
  charter carries that as a verification gate rather than an intention.
- The timeline is pure. It adds no persistence, no migration and no model
  spend, and it can be recomputed from stored rows after any restart.
- Implementation is not activated by this decision. It follows the normal
  workflow: one explicitly approved task at a time, each with a frozen charter.

## References

- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
- [Evidence Workbench 2.0 interface plan](../design/evidence-workbench-v2-interface-plan.md)
- [ADR-0046](0046-source-chronology-and-claim-projection.md)
- [ADR-0047](0047-evidence-application-model-reset.md)
- [Product definition](../design/evidence-integrity-workbench-product-definition.md)
- [Deferred features](../backlog/v2-interface-deferred-features.md)
