# ADR 0047 — Evidence Application-Model Reset and Legacy Workbench Freeze

Status: Accepted
Date: 2026-08-16
Decision owners: ACME maintainers

## Context

ADR-0028 accepted the Evidence Integrity Workbench as POC #1. ADR-0046 then
reorganized its surface into three modes over one observation card, and
ACME-0139 through ACME-0148 delivered that surface. ADR-0044 moved POC
acceptance from "does the code behave as specified" to "can the product carry a
real evidence workflow".

Three acceptance attempts against real Stage A material have now run:
[ACME-0133](../acceptance/ACME-0133-frozen-acceptance-report.md),
[ACME-0136](../acceptance/ACME-0136-frozen-acceptance-report.md) and an
unfrozen 2026-08-16 run over the complete 1,915-page `source-A` binder. They did
not fail on infrastructure. They failed on the application's model of its own
domain:

- **A document part is not a document.** Deterministic slicing of the complete
  binder produced 246 parts but only 101 distinct titled units. One interview
  occupied up to ten consecutive parts. The application had no object for "the
  document", so a reviewer could not open one.
- **A longitudinal subject is not a document structure.** One person appeared
  as five separate interviews across 2004–2007. Recognising that those five
  belong together is a semantic conclusion, not a slicing outcome, and the
  application had no place to record it, review it or correct it.
- **The index is indistinguishable from the substance.** The first 280 pages of
  the binder are its table of contents. Slicing produced 23 parts titled
  "Förhör med …" that contain no interview, and a prior run extracted 41
  observations that quote index lines verbatim. Every one of them is formally
  valid evidence.
- **A part's title can name a different document than its body.** Verified on
  five consecutive parts: the header line that opens a part belongs to the
  preceding document, so the displayed interview date is systematically wrong
  while the line-level provenance stays exact.
- **A citable unit can be valid and still unbindable.** 259 of 92,141 derived
  segments (0.28 %) resolve to text that occurs more than once inside their own
  locator range — degenerate one-word segments such as `"Kamel"` and
  `"Hussein"` produced by sentence splitting across hard-wrapped lines. Because
  one such unit fails the whole job non-retryably, 126 of 246 parts (51 %) could
  not be analysed at all.
- **Failure blast radius is the whole job.** Observations project only after
  every coverage window succeeds. Two runs committed one and six windows
  respectively to the engine and projected nothing.
- **Two different counters are compared as one.** The product workspace
  `evidenceRevision` counts imports; the engine `EvidenceState.evidenceRevision`
  counts canonical-evidence deltas. Five reviewer views require them to be
  equal and the projection guard requires the engine not to exceed the product.
  Verified on two substrates: `acme0136` at engine 3 / product 2, and the
  2026-08-16 case at engine 13 / product 3. Any case with more analysed windows
  than imports is unreadable, and the surfaces disagree about it — the overview
  reports 40 pending observations while the source stream reports zero.

None of these are engine defects. Execution identity, replay, revisioned state,
provenance, fail-closed model interaction, encrypted payload retention, case
isolation, authorization and the artifact foundation all behaved as designed
while the application above them modelled the wrong things.

Continuing to refactor the delivered surface would migrate a domain model that
real material has already invalidated, and would keep two product visions alive
in one codebase.

## Decision

### 1. The application domain model is replaced

The Evidence application is re-founded on ten domain objects:

`Case`, `Artifact`, `SourcePart`, `Chain`, `ChainInstance`,
`ObservationOccurrence`, `Claim`, `Relation`, `Review`/`Standing`,
`ConsensusProjection`.

Everything else in the application is a view, a job or an implementation
detail. The normative model, invariants, supported flow and V1 boundary are
specified in
[`../design/evidence-workbench-v2-domain-specification.md`](../design/evidence-workbench-v2-domain-specification.md).

### 2. Source structure and domain organization are different layers

```text
Artifact
  ↓ deterministic, system-owned, replayable
SourcePart
  ↓ proposed and human-resolved
Chain → ChainInstance
  ↓ bounded live extraction per instance
ObservationOccurrence
```

Slicing answers "where does this document begin and end". Chain resolution
answers "these five parts are the same subject over time". The first is
deterministic and may not involve a model. The second is a semantic conclusion,
is allowed to be proposed rather than derived, and must be reviewable and
correctable.

Correcting a chain membership appends a decision. It never mutates a source
part, an occurrence or a prior decision.

### 3. Claims do not own occurrences, and consensus is not truth

An `ObservationOccurrence` is immutable and source-bound. A `Claim` is a
grouping projection over occurrences and never merges or absorbs them. A
`Relation` is a typed statement about occurrences or claims and never deletes
its endpoints.

A `ConsensusProjection` is a derived read model at an explicit case revision
that reports what the currently reviewed evidence supports, contests, qualifies
or leaves unresolved. It is not a majority vote, not a truth verdict, and
absence of supporting material is reported as insufficient material, never as
refutation. The ADR-0028 authority ladder and its L5 exclusion apply unchanged.

### 4. The delivered workbench is frozen as a diagnostic reference

The freeze follows the old domain model, not the word "evidence" in a package
name. Frozen, because they carry the replaced application model:

- `apps/evidence-workbench-api`
- `apps/evidence-workbench-web`
- `apps/evidence-workbench-worker`
- `packages/module-evidence`
- `packages/evidence-views`
- `packages/evidence-product-contracts`
- `packages/adapter-evidence-product-file`
- `packages/adapter-evidence-product-postgres`
- `packages/evidence-testing`

Shared infrastructure, which is not frozen and which the new application links
against directly:

- `packages/evidence-artifacts` and its file/S3 adapters — immutable
  representations, encryption and object storage
- `packages/evidence-auth` and its memory/postgres/supabase adapters —
  principal, session, membership and deny-by-default authorization
- `packages/live-safety`, `packages/adapter-model-openai`,
  `packages/adapter-postgres` and everything in `packages/core`

No feature development, UX refactoring or domain migration is performed in the
frozen set. Changes there are permitted only where required to preserve its
diagnostic value against existing cases, chartered separately, and never
bundled with new-model work.

Shared infrastructure may change under its own charter when the new application
needs it, provided the frozen application keeps building and running unchanged.

The wedged 2026-08-16 acceptance case is retained as failure evidence and is
not repaired.

Clarified 2026-08-16, same day as acceptance: the original wording froze
"supporting evidence packages" without naming them, which contradicted §6's
carry-forward of the artifact and authorization foundations. The lists above
state the boundary that §6 already implied. The decision is unchanged.

### 5. The new composition lives in new packages

The new application model is implemented in new packages and apps rather than
by mutating the frozen ones, so that "frozen" is structurally true and both can
be built and run side by side. Package naming is fixed in §10 of the
specification and is revisited when the frozen application is removed, not
before.

### 6. What is carried forward unchanged

- `packages/core` and the whole engine: execution identity, replay, revisioned
  state, bounded execution, response pipeline, memory and state engines.
- Persistence platform (ADR-0033), artifact security foundation (ADR-0037),
  bounded text ingestion (ADR-0038), authenticated principal and authorization
  (ADR-0035), case management and isolation (ADR-0036).
- Live model boundary (ADR-0039) as amended by the acceptance phase (ADR-0044)
  and the live-call policy in `AGENTS.md`.
- Data authority (ADR-0040): Stage A anonymized judicial text remains the only
  authorized non-synthetic class. Stage B stays closed. This decision changes
  application composition and representation only. It widens no data authority.
- The product definition (ADR-0028) including the authority ladder, the
  statement/truth separation, typed time, scoped relations and the immutable V1
  boundaries.
- ADR-0046's principles: two graphs over one immutable object, deterministic
  document-native segmentation, three distinct clocks, and extraction as Pass 1
  only. Its three-mode surface decision is what this ADR replaces.

### 7. Disposition of surface-scoped decisions

No historical ADR is edited, superseded or marked obsolete by this decision.
ADR-0031, ADR-0032, ADR-0041, ADR-0042, ADR-0043, ADR-0045 and ADR-0046 remain
authoritative for the frozen application. Where the new model needs an
equivalent contract, it decides it in its own ADR at first export rather than
inheriting or amending those decisions implicitly.

### 8. No data migration

Existing cases stay in the frozen application. The new application starts from
fresh cases on fresh substrate. Nothing is rewritten to fit the new model.

### 9. Proof obligation, not an earned claim

This decision states one proof obligation for ACME itself:

> Materially redefining the application domain did not require materially
> redefining the engine.

It is claimed only when the new application reaches its V1 acceptance, and only
with the diff as evidence: the change set that delivers the new domain model
must contain no change to `packages/core` motivated by the new model. If the
engine does require change, that is the finding and it is recorded, not
suppressed.

## Alternatives Considered

### Refactor the delivered workbench into the new model

- Benefits: no duplicated composition; keeps one application.
- Costs: migrates a domain model that real material invalidated; keeps two
  product visions in one codebase; every new-model contract has to be reconciled
  with committed evidence and historical replay from the old one.
- Reason not selected: the cost is paid on the assumption that the first model
  was nearly right, and the acceptance evidence says it was not.

### Rewrite the whole system including the engine

- Benefits: no legacy constraints anywhere.
- Costs: discards proven execution identity, replay, provenance, persistence,
  security and authorization; makes the POC restart rather than converge.
- Reason not selected: the acceptance runs located every failure above the
  engine boundary. Replacing the engine would destroy the evidence that the
  boundary is in the right place.

### Keep patching defects as they surface in the delivered surface

- Benefits: each fix is small and the acceptance run continues sooner.
- Costs: the missing objects — document, chain, instance, consensus — cannot be
  introduced by defect fixes, so the run keeps discovering consequences of the
  same absence.
- Reason not selected: the defect list converges on a modelling gap, not on a
  set of independent bugs.

## Consequences

### Positive

- The application gains the objects real material requires: a document, a
  longitudinal chain, an ordered instance and a reviewable membership.
- A human correction to chain resolution costs one appended decision instead of
  a re-extraction.
- The frozen workbench remains a working instrument for inspecting existing
  cases while the new surface is built.
- Every failure found so far becomes a binding regression requirement instead of
  tacit knowledge.

### Negative

- Two applications exist in the repository, and the frozen one will drift out of
  date relative to the new model's vocabulary.
- Work already delivered in ACME-0139 through ACME-0148 does not carry forward
  as code, only as knowledge and as reusable deterministic components.
- The V1 finish line moves. The new model has to re-prove journeys the old
  surface had partially demonstrated.

### Follow-ups

- Fix the package and app naming at the specification's activation gate.
- Decide the new model's observe and relate contract versions in their own ADR
  at first export, per §7.
- Record the §9 proof obligation outcome in `docs/JOURNAL.md` and
  `docs/CURRENT_STATUS.md` at V1 acceptance.

## Compatibility and Migration

- No schema, contract or stored record belonging to the frozen application is
  altered. Historical replay and request hashes stay byte-exact.
- No case data is migrated. The frozen application keeps serving existing cases,
  including the retained wedged case.
- The new application provisions its own persistence objects on its own
  substrate. Both use the same PostgreSQL, object-store and secret conventions.
- Rollback is to stop developing the new application. The frozen one continues
  to run unchanged.

## References

- [ADR-0028](0028-first-poc-evidence-integrity-workbench.md)
- [ADR-0035](0035-evidence-authenticated-principal-and-authorization.md)
- [ADR-0036](0036-evidence-case-management-and-isolation.md)
- [ADR-0037](0037-evidence-secure-artifact-foundation.md)
- [ADR-0038](0038-bounded-text-ingestion-and-immutable-redaction.md)
- [ADR-0040](0040-poc-1-live-product-applicability.md)
- [ADR-0044](0044-poc1-live-product-acceptance-phase.md)
- [ADR-0046](0046-source-chronology-and-claim-projection.md)
- [Evidence Workbench V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
- [Product definition](../design/evidence-integrity-workbench-product-definition.md)
- [ACME-0136 frozen acceptance report](../acceptance/ACME-0136-frozen-acceptance-report.md)
