# @acme/module-evidence

Pure Evidence Integrity Workbench domain contracts for ACME.

Slice 0 exports strict Evidence V1 schemas, content-derived identities, source
binding validation, compact state/delta contracts, reducer and invariants,
memory policy, and the task catalogue. Slice 1 implements and registers
`evidence.observe-artifact@1.0.0`.

The observation task accepts one immutable source artifact version and an
explicit actor roster. Its prompt contract requires strict structured output;
semantic validation binds every exact quote to its one-based line range,
keeps ambiguous actors unresolved, refuses ungrounded clock values and blocks
credibility, guilt and legal-authority conclusions. Interpretation derives the
locator, actor-reference and observation identities, and state projection
indexes only memory decisions that were actually applied.

The package depends only on public core contracts and Zod. It owns no corpus
files, product workflow, review state, database, provider or UI behavior.
