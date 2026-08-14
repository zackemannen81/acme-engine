# ADR 0040 — POC #1 Live Product Applicability

Status: Accepted
Date: 2026-08-15
Decision owners: ACME maintainers

## Context

ADR-0028 accepted the Evidence Integrity Workbench as ACME's first real product
POC while deliberately limiting its first implementation phase to a fixed
synthetic corpus. ADR-0038 later added one synthetic UTF-8 plain-text import
class without authorizing arbitrary or non-synthetic data. Those limits made
the early product safe and reproducible, but they were phase controls rather
than the enduring definition of the product.

Slices 0–8 now provide the required evidence contracts, human-review overlay,
case isolation, authenticated server-derived principals, encrypted artifact
storage, PostgreSQL repositories, assessment output and export audit. ADR-0039
also accepts a bounded live-model job runtime, although it is not yet
implemented. POC #1 can therefore advance to a narrow Stage A live proof using
anonymized real judicial source documents already under operator control.

The repository currently uses `synthetic-only` as both a real composition
guard and, in places, a universal product description. Leaving that ambiguity
would permit two failures: a live deployment could silently retain mock,
in-memory or fixture components, or implementation could incorrectly treat a
historical phase restriction as a permanent prohibition. Historical ADRs must
remain intact, so the change needs an explicit applicability decision.

## Decision

### 1. Permanent invariants

The following rules apply to every Evidence Integrity Workbench profile,
including synthetic/test, POC #1 live and any later production profile:

- model output is an untrusted candidate until runtime validation, domain
  validation and the required human review complete;
- canonical source representations and provenance are immutable; changed
  accounts, corrections, review decisions and assessment revisions coexist
  rather than overwriting history;
- every observation and assessment claim names its exact source object,
  representation version and bounded locator;
- relations, conflicts, temporal precision and uncertainty are typed domain
  state, not inferred from rationale prose;
- new accepted evidence that affects an assessment creates visible review
  attention and cannot silently preserve a current verdict;
- case isolation, authenticated server-derived principals, deny-by-default
  authorization, content-free security audit and encrypted artifact controls
  remain mandatory;
- the primary reviewer journey works without technical-audit, CLI, JSON or
  direct-database access;
- evidence assessment remains a persistent product-domain concept. Generic
  post-execution quality evaluation is supplementary and never substitutes for
  it;
- the product does not decide credibility, guilt, legal sufficiency or any
  other excluded L5 conclusion.

### 2. Profile-local controls

The fixed corpus, sealed fixture hashes, scripted model responses,
`synthetic-only` data policy, synthetic authority attestation and synthetic
export restrictions remain mandatory for the existing synthetic/test profile.
They are not universal product invariants after this decision.

Deterministic fixtures and model mocks remain the default for unit,
conformance, integration and offline scenario gates. A test or developer
composition cannot become live through ambient credentials alone.

### 3. Stage A source class

POC #1 Stage A accepts exactly one additional data class:

`stage-a-anonymized-judicial-text/1`

An object in that class must be:

- a real judicial source document, not an ACME fixture or generated substitute;
- already anonymized or redacted before it crosses the ACME import boundary;
- authorized by the operator for this bounded POC and for transmission to the
  configured live provider;
- strict UTF-8 plain text within the existing ADR-0038 size, canonicalization
  and non-newline-spanning redaction boundaries;
- accompanied by external-source provenance that identifies the source kind,
  stable operator-supplied source reference, acquisition time and, when the
  text was prepared from an excluded container such as PDF, that container's
  digest plus the named extraction method/version, without placing source
  content in logs or audit metadata.

The exact original bytes, canonical representation and redacted derivatives
use the ADR-0037 encrypted artifact boundary. Anonymization is not treated as
proof that the document is harmless; authorization, case membership, audit,
retention and export policy still apply.

Stage A does not authorize PDF, DOCX, OCR, images, audio, video, arbitrary
binary input, bulk ingestion or direct collection from an external system.
Operator-prepared text may be derived outside ACME from an excluded container;
the product imports only the verified text and records the parent provenance.

### 4. Stage B remains separate

FUP or equivalent preliminary-investigation material is Stage B. It is not a
prerequisite for Stage A and is not authorized by this ADR. Adding it requires
a new data-class decision covering authority, sensitivity, provider handling,
retention, export and operational controls. The product contracts must allow
that future class to be added without changing Stage A evidence identities or
review history.

### 5. Fail-closed live composition

The implementation must expose a versioned live profile named
`evidence-poc1-live/1`. Startup and every model-job enqueue must fail closed
unless all four properties are proven by typed, machine-checked composition
metadata:

1. `persistence = durable-postgresql`;
2. `modelGateway = live-provider`;
3. `sourceOrigin = authorized-external`, with the source object carrying
   `stage-a-anonymized-judicial-text/1` rather than a fixture origin; and
4. `executionAuthority = authorized-live`, derived from the authenticated
   server request and explicit operator configuration, never from ambient API
   credentials alone.

The tuple is conjunctive. A live provider with an in-memory/file repository, a
PostgreSQL deployment with a scripted gateway, a fixture presented as an
external source, or a background job without live execution authority is not
POC #1 live and must be refused. A response header, UI label or environment
name is not sufficient proof.

The live profile uses environment-only provider credentials and the durable
encrypted-payload retention mode required by ADR-0039 so interrupted work can
resume from recorded model-call evidence without a second provider call.
Content-free operation audit must record the profile, source class, case,
principal, job and outcome.

### 6. Reviewer-facing completion rule

A technical endpoint or isolated live provider call does not satisfy this
decision. The live profile is complete only when the primary browser journey
can import an authorized Stage A document, run the bounded evidence tasks,
review candidates, preserve accepted/rejected history, view relations,
conflicts, temporal uncertainty and open questions, review a persistent
assessment, become stale when later evidence changes its basis, and reproduce
the reviewed case after process restart using PostgreSQL-backed state.

### 7. Applicability of earlier decisions

- ADR-0028 remains the product-definition decision. Its synthetic-corpus and
  synthetic-only statements govern the initial/synthetic profile, not the
  newly authorized POC #1 live Stage A profile.
- ADR-0038 remains the import and redaction decision for its synthetic class.
  Stage A reuses its bounded text mechanics but has a distinct data class,
  authority attestation and source provenance.
- ADR-0035, ADR-0036 and ADR-0037 apply unchanged to both profiles.
- ADR-0039 supplies the model-job runtime and retention boundary; this ADR adds
  the live composition and source-authority conditions around it.

No historical ADR is edited or marked obsolete by this decision.

## Alternatives Considered

### Keep all non-synthetic data blocked until a broad launch programme exists

- Benefits: preserves the simplest reading of the prior synthetic-only phase.
- Costs: prevents the POC from testing its central product claim even though
  the required Stage A material and core controls exist.
- Reason not selected: a bounded source class and fail-closed profile isolate
  the real proof without granting general ingestion authority.

### Replace synthetic mode with live mode everywhere

- Benefits: one apparent composition path.
- Costs: destroys deterministic offline verification and makes credentials or
  provider availability part of ordinary development.
- Reason not selected: synthetic/test and live-product profiles have different
  authorities and both are required.

### Treat live readiness as deployment documentation only

- Benefits: minimal code and configuration work.
- Costs: cannot prevent mixed mock/in-memory/fixture compositions and cannot
  prove the user's requested POC path.
- Reason not selected: the live tuple is a product safety invariant and must be
  enforced in runtime types and tests.

### Admit Stage A and Stage B together

- Benefits: fewer named phases.
- Costs: couples a bounded court-document proof to materially more sensitive
  investigative material and its unresolved controls.
- Reason not selected: Stage B is unnecessary for the Stage A proof and must
  not block it.

## Consequences

### Positive

- POC #1 gains a precise path from synthetic validation to a real reviewer
  proof without weakening provenance or human authority.
- The live claim becomes falsifiable: mixed compositions are rejected rather
  than described away.
- Offline tests stay deterministic and safe.
- Stage B can be evaluated independently after Stage A has produced evidence.

### Negative

- Data-policy, import, repository and API contracts need versioned evolution
  instead of replacing their synthetic literals.
- Hosted startup, job enqueue and provider retention require new integration
  gates.
- Existing documentation that uses synthetic-only as a universal product
  statement must be updated with profile-specific wording.

### Follow-ups

- Implement ADR-0039 and the `evidence-poc1-live/1` invariant before any real
  provider execution.
- Add the Stage A data class and external-source provenance to case-first
  import, encrypted storage, export policy and audit contracts.
- Connect import to bounded observation, relation, timeline and assessment jobs
  through the primary reviewer UI.
- Add PostgreSQL restart, late-evidence/stale-assessment and primary browser
  acceptance proofs using operator-provided Stage A material.
- Reclassify the Slice 9 backlog against this decision; Stage B and arbitrary
  ingestion remain closed.

## Compatibility and Migration

Existing `synthetic-only` cases, imports, fixtures, exports and review records
remain valid and require no migration. The new data class and profile are
additive and versioned. A deployment that does not explicitly select and
satisfy `evidence-poc1-live/1` continues to operate under the synthetic/test
rules and cannot ingest Stage A data or enqueue live evidence jobs.

Rollback disables the live profile and leaves its encrypted source,
provenance, model-call and review records immutable and readable only through
the authorized maintenance/export rules; it never relabels them as synthetic.

## References

- ADR-0028 — First POC: Evidence Integrity Workbench
- ADR-0035 — Evidence authenticated principal and authorization
- ADR-0036 — Evidence case management and isolation
- ADR-0037 — Evidence secure artifact foundation
- ADR-0038 — Bounded text ingestion and immutable redaction
- ADR-0039 — Evidence Workbench live model boundary
- `docs/design/evidence-integrity-workbench-product-definition.md`
- `docs/design/evidence-integrity-workbench-technical-specification.md`
- `docs/design/evidence-integrity-workbench-product-completion-plan.md`
- `docs/backlog/slice-9-prerequisite-checklist.md`
