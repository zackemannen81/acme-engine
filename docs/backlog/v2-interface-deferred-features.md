# V2 interface: features deferred from the 2.0 request

Status: Resolved / not applicable Not activated. Recorded 2026-08-18 while planning
POC #1 - accepted as is.
[the Evidence Workbench 2.0 interface](../design/evidence-workbench-v2-interface-plan.md).

## Discovery context

The requested Evidence Workbench 2.0 feature list contains three items that the
[V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
§6 and §7 place outside the V1 boundary. They are recorded here rather than
absorbed into the plan's charters, so nothing from the request is silently
dropped and nothing crosses a frozen boundary by implication.

## 1. Samlad analysrapport (combined analysis report)

The requested process model ends with "Skapa samlad tidslinje och
analysrapport". The timeline half is planned as ACME-0162. The report half is
explicitly excluded by §7: "Assessment documents (L4) and any generated report"
and "Export formats, export policy and export audit release".

**Proposed outcome.** A citation-complete assessment document returns under its
own charter after the consensus projection has proven itself, exactly as §7
states: "Assessment returns after consensus has proven itself, under its own
charter."

**Why it is outside the plan.** The frozen application already learned that a
report built over unreviewed or unprojected material reads as authority the
evidence does not carry. Consensus is the input a report needs; it does not
exist yet.

**Dependencies.** ACME-0159 (standing), ACME-0160 (claims), ACME-0161
(relations), ACME-0162 (consensus). The frozen application's Stage 8 export
machinery is a diagnostic reference only and must not be reused across the
ADR-0047 boundary.

**Suggested verification.** Every reference resolves to an exact artifact
version, locator and quote; byte-deterministic rendering; no assertion of
credibility, guilt or legal sufficiency.

## 2. Person-level relations and an actor roster

The requested relations view shows "kopplingar mellan personer, bevis eller
händelser". Evidence and events are representable today. Persons are not:
§7 excludes "Cross-case entity resolution and roster management beyond
null-actor Pass 1", and ADR-0046 §4 fixes an empty roster as null actors.

**Proposed outcome.** A Pass 2 actor roster, case-scoped, proposed
deterministically where the document body labels a participant and reviewed by
a human before any occurrence gains an actor reference.

**Why it is outside the plan.** The interim answer is adequate and costs
nothing: a chain's subject label is already derived from document body fields,
so a chain *is* a person's longitudinal thread. The relations surface can name
people through chain subjects without inventing an entity-resolution layer.

**Dependencies.** ACME-0161. An occurrence's actor field already exists and
stays null; adding a roster must not change existing occurrence identities.

**Suggested verification.** A run over the real binder comparing proposed
actors against chain subjects; no occurrence identity changes; null stays null
where the source supplies nothing.

## 3. Graph visualisation of relations

§6 excludes "graph visualisation" from V1, alongside dashboards, charts,
scoring, weighting and ranking.

**Proposed outcome.** A bounded, case-scoped graph rendering of reviewed
relations, where every node and edge opens its exact source and no layout
implies weight, centrality or importance.

**Why it is outside the plan.** A graph is the surface most likely to be read
as an assertion the evidence does not make: an edge drawn thicker, a node drawn
central, a cluster drawn together all suggest conclusions no relation states.
The bounded list planned in ACME-0161 carries the same information without
that risk, and is the honest first version.

**Dependencies.** ACME-0161. Also R-08: a graph is an unbounded list wearing a
different shape unless it is bounded deliberately.

**Suggested verification.** Node and edge counts bounded and stated; every
element resolving to its exact source; no visual encoding of quantity.
