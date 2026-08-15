# @acme/module-evidence

Pure Evidence Integrity Workbench domain contracts for ACME.

Slice 0 exports strict Evidence V1 schemas, content-derived identities, source
binding validation, compact state/delta contracts, reducer and invariants,
memory policy, and the task catalogue. Slice 1 implements and registers
`evidence.observe-artifact@1.0.0`; slice 2 adds the ADR-0032 pure V1 correction
occurrence-pairing rule and projects correction standings through that same
task without changing its closed model contract. Slice 3 implements the active
`evidence.relate-observations@1.1.0`, which proposes scoped relations and open
questions over accepted observations and contests only the endpoints that
scoped `contradicts` relations require. Its prompt requires every set-like
identifier/rationale array to be unique and lexicographically sorted and every
relation endpoint array to be distinct and sorted by kind then id. Historical
`@1.0.0` remains registered byte-exact for replay. Slice 4 adds pure timeline ordering
via `evidence.build-timeline@1.0.0` and `evidence-temporal-overlap-1`. Slice 5
adds `evidence.propose-assessment@1.0.0`, immutable reviewed-evidence assessment
versions, strict change-set records and pure tier-A/tier-B re-review attention
classification. Product review decisions, ZIP rendering and UI remain outside
this domain package.

The observation task accepts one immutable source artifact version and an
explicit actor roster. Its prompt contract requires strict structured output;
semantic validation binds every exact quote to its one-based line range,
keeps ambiguous actors unresolved, refuses ungrounded clock values and blocks
credibility, guilt and legal-authority conclusions. Interpretation derives the
locator, actor-reference and observation identities, and state projection
indexes only memory decisions that were actually applied.

For an explicit adjacent `transcription-correction`, the domain pairs complete
predecessor/successor observation sets by kind, exact line range, source actor
label/role and temporal kind/role. Every pair must be unique and complete.
The predecessor becomes `superseded` only when its successor becomes `current`
in the same revision. A different logical artifact is a changed account and is
never paired or superseded by this path.

The package depends only on public core contracts and Zod. It owns no corpus
files, product workflow, review state, database, provider or UI behavior.
