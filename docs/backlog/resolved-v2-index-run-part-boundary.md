# V2 structure: split parts at index-run transitions

Status: Resolved/not applicable. Not activated. Discovered during ACME-0151.
POC #1 - accepted as is.
## Discovery context

`evidence-v2-source-structure/1` classifies content character per part, and
part boundaries come from document headers or a 400-line size cap. Neither
reacts to a transition between substantive text and a run of index rows.

A fixture built while implementing the chain layer exposed the consequence: a
short document immediately followed by a large contents block lands in one
400-line part whose dot-leader density is 0.97, so the part classifies as
`index-or-front-matter` and the document inside it is never chained. Reduced
to its essentials:

```text
part-000001  L1-400  index-or-front-matter   12 interview lines + 388 index rows
```

## Proposed outcome

A transition into or out of a run of consecutive index-like lines is a part
boundary, so an index block and the document beside it become separate parts
and each is classified on its own content. The rule stays deterministic and
model-free.

This would change `EVIDENCE_V2_SOURCE_STRUCTURE_RULE_VERSION`, and therefore
every derived part and unit identity, so it belongs in its own task with its
own recorded run over real material.

## Why it is outside the ACME-0151 charter

ACME-0151's Out of Scope says: "Changing `evidence-v2-source-structure/1` or its
rule version. If the chain layer appears to need a structure change, stop and
charter it separately." This is that case, and the chain layer does not need it
to be correct — it needs it only to be complete at one boundary.

## Impact assessment

Not observed on the real `source-A` binder. Its contents pages occupy roughly
1,400 lines at the front and its documents follow, so every measured index part
is wholly index: 944 of 944 dot-leader lines fall inside parts classified
`index-or-front-matter`, and 351 chains were proposed with only 5 unassigned
parts. The defect is reachable, not currently reached.

## Dependencies

- None. It is a self-contained change to the structure rules.

## Suggested verification

- A fixture with a short document adjacent to a large index block yields two
  parts, classified separately, and the document is chained.
- A recorded run over the real binder, comparing part, unit and chain counts
  before and after, since identities change with the rule version.
- The existing unique-binding, total-coverage and determinism gates.
