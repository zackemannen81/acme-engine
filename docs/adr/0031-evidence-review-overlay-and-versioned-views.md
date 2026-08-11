# ADR 0031 — Evidence reviewer, review overlay and versioned view boundary

Status: Accepted

Date: 2026-08-11

Decision owners: ACME maintainers

## Context

The Evidence Integrity Workbench must prove a real reviewer workflow, not
repackage the Domain Test UI. Domain provenance is indispensable to the
product, while execution records, memory internals, state transitions, quality
evaluations and replay are secondary technical evidence.

Human review creates another boundary. A reviewer may accept a relation or an
assessment for use in the POC, but that decision must not rewrite immutable
Evidence memory, alter an execution digest or turn an assessment into legal
truth. New evidence must also make earlier work visibly due for attention
without erasing or visually invalidating the decision that was valid at its
recorded basis.

Without an explicit decision, product views could expose ACME objects directly,
review status could leak into canonical evidence, and “out of date” behavior
could drift into model-scored relevance.

## Decision

### 1. The Primary Product Rule is normative

> The primary Evidence Integrity Workbench workflow MUST solve the
> evidence-review problem without exposing or requiring ACME execution
> concepts. Source provenance is part of the product workflow. Engine
> provenance and replay are secondary technical evidence. A reviewer MUST be
> able to complete the primary journey while all technical-audit surfaces are
> disabled.

An implementation fails the product proof when its main visible result is an
execution status, test result, quality score or internal state. The Evidence
application does not depend on `apps/test-ui`; a secondary surface may link or
hand off to it.

### 2. Review decisions are an application-owned append-only overlay

`evidence-review-decision/1` is stored in a product repository, never in ACME
core execution evidence. Each decision contains:

- an opaque immutable `reviewDecisionId`;
- workspace id;
- target kind and exact target version id;
- action: `accept`, `reject`, `leave-unresolved`, `request-revision` or
  `reaffirm`;
- configured reviewer reference;
- principal assurance `unauthenticated-local` in V1;
- non-empty rationale;
- decision timestamp from the product clock;
- command idempotency key; and
- for `reaffirm`, the explicit new basis evidence revision.

A decision never targets “current”. Reusing an idempotency key with different
content is refused. Later decisions do not mutate earlier ones; effective
review standing is a deterministic fold ordered by timestamp and then decision
id.

V1 has one configured local reviewer, one reviewer role and no authentication,
login, invitation, session or role matrix. Recording
`unauthenticated-local` prevents a future hosted system from representing
these decisions as authenticated history.

### 3. Approval and shareability are derived

Evidence records and assessment documents do not contain mutable approval
fields. The application combines an exact immutable object version with its
ordered review decisions.

For an assessment version:

- no decision, `leave-unresolved` or `request-revision` is not shareable;
- latest `reject` is not shareable;
- latest `accept` is shareable at the assessment's basis revision; and
- latest valid `reaffirm` remains shareable at the reaffirmed basis revision.

New evidence does not revoke or rewrite acceptance. A shareable assessment may
be “accepted before newer evidence was added”; every view and export states the
effective basis revision and the later evidence delta. A reviewer can then
reaffirm or create and review a new content version.

### 4. Out-of-date status is a deterministic revision comparison

An assessment is due for attention exactly when:

```text
workspace evidence revision > effective assessment basis revision
```

The effective basis is the assessment's own basis revision or the greatest
valid revision on a later `reaffirm` decision. This status is derived and is
never written into the assessment or inferred by a model.

Every notice contains the import-job boundary, prior and current evidence
revision, added artifact versions, added evidence identifiers and standing
changes. One import job creates one batched notice.

Attention tier A applies when new evidence has a non-empty deterministic set
intersection with the assessment's cited artifact-version ids, actor-reference
keys, relation endpoints or temporal bounds that overlap by the published
`evidence-temporal-overlap-1` rule. Tier B applies otherwise. These tiers do
not mean relevant or irrelevant, affected or unaffected, probable or safe.

User-facing text does not use the word “stale”. The accepted version remains
visually intact with a factual basis byline. The notice has unread-level visual
weight; error styling is reserved for actual failures such as a failed import
or broken locator.

### 5. Read models are pure, versioned and classified

Primary views consume Evidence-domain objects, immutable documents and product
review records. They expose neither raw ACME objects nor fields whose meaning
requires ACME knowledge.

| View contract | Class | Reviewer question |
| --- | --- | --- |
| `evidence-primary-work-queue-view/1` | Primary domain | What needs my attention and what changed? |
| `evidence-primary-source-review-view/1` | Primary domain | What does this exact source say, and which proposed observations bind to it? |
| `evidence-primary-observation-ledger-view/1` | Primary domain | Which source-bound observations are accepted, rejected, contested or unresolved? |
| `evidence-primary-account-comparison-view/1` | Primary domain | How do corrected and changed accounts coexist? |
| `evidence-primary-relation-view/1` | Primary domain | Which exact endpoints and scopes support this proposed relation? |
| `evidence-primary-timeline-view/1` | Primary domain | What order and temporal precision do the accepted sources permit? |
| `evidence-primary-open-questions-view/1` | Primary domain | Which gaps or ambiguities remain and which evidence exposed them? |
| `evidence-primary-assessment-view/1` | Primary domain | What does this assessment say, cite and leave uncertain, and how was it reviewed? |
| `evidence-primary-review-history-view/1` | Primary domain | Who made each version-bound review decision and why? |
| `evidence-technical-provenance-view/1` | Secondary technical audit | Which execution and recorded decisions produced a domain object? |
| `evidence-technical-replay-view/1` | Secondary technical audit | Does recorded evidence reproduce the committed operation? |

All builders are pure: validated input to detached immutable output. Product
views may compose a pure Evidence projection with the review overlay, but do
not write either source.

### 6. Product separation has two executable acceptance tests

The later product implementation must provide both:

1. **Domain black-box test.** Start the application with
   `technicalAudit.enabled = false`; technical routes and navigation are
   absent. Exercise the complete source → observation → comparison → relation
   → timeline → open question → assessment → new evidence → re-review journey
   through product APIs and rendered primary views, with no CLI, raw JSON,
   database access or technical identifiers.
2. **Forbidden-vocabulary test.** Tokenize every primary view JSON field path
   and every shipped primary-view user-facing string. Refuse the exact tokens
   `acme`, `engine`, `execution`, `modelCall`, `operationDigest`, `state`,
   `memory`, `scenario`, `qualityScore`, `contractFingerprint`,
   `requestFingerprint` and `replay`, case-insensitively after camel-case and
   punctuation splitting. Secondary view contracts are excluded from this
   scan by explicit registry classification.

The tests are necessary but not sufficient: normal words such as “status” or
“history” remain allowed, so product review must still confirm that the main
visible result is reviewer work rather than infrastructure telemetry.

## Alternatives Considered

### Store review decisions in canonical Evidence memory

- Benefits: one query source and atomic approval with evidence.
- Costs: human workflow mutates the meaning and lifecycle of engine evidence;
  removing the product would lose or reinterpret domain records.
- Reason not selected: review is an application authority over an immutable
  version, not a model/domain observation.

### Put approval fields on assessment documents

- Benefits: simple reads.
- Costs: acceptance, rejection and reaffirmation would rewrite an immutable
  assessment and erase decision history.
- Reason not selected: an append-only overlay preserves both object and review
  provenance.

### Mark every accepted assessment invalid when new evidence arrives

- Benefits: strong warning.
- Costs: misrepresents a decision that was valid at its recorded basis and
  encourages alert fatigue.
- Reason not selected: the product states the evidence delta and asks for a
  new decision without rewriting history.

### Let a model rank whether new evidence matters

- Benefits: fewer notices.
- Costs: silently elevates the model into relevance and decision authority,
  contrary to ADR-0028.
- Reason not selected: V1 uses only revision and identifier/time-set rules.

### Reuse Domain Test UI view contracts

- Benefits: less code.
- Costs: makes execution, state, memory, scenario and quality vocabulary the
  product's center of gravity.
- Reason not selected: the two applications answer different questions.

## Consequences

### Positive

- A reviewer can complete the product journey without knowing ACME internals.
- Human decisions remain attributable without mutating evidence or operation
  digests.
- New evidence behavior is reproducible and cannot drift into inferred
  relevance.
- Primary and secondary surfaces can evolve independently under versioned
  schemas.

### Negative

- Queries must join immutable Evidence projections with a separate review
  store.
- Shareability and attention are folds rather than stored flags, so adapters
  need deterministic ordering and indexes.
- V1 decisions honestly carry unauthenticated principal assurance and cannot
  be retroactively upgraded.

## Compatibility and Migration

No implemented surface changes. These contracts constrain the first product
implementation. Adding authentication, changing decision semantics or
reclassifying a view requires a compatible new schema or a new ADR.

## Follow-ups

- Identity provider and authorization require a separate ADR before the
  hosted shell accepts review commands.
- The local reviewer slice must add a conformance kit for append-only decision
  stores and pure view builders.
- A later hosted slice must prove the same domain black-box journey, not create
  a second product contract.

## References

- [ADR-0012 — Milestone 1 execution identity and replay](0012-milestone-1-execution-identity-and-replay.md)
- [ADR-0019 — Domain Test UI boundary and view contracts](0019-domain-test-ui-boundary-and-view-contracts.md)
- [ADR-0025 — Post-execution quality evaluation](0025-post-execution-quality-evaluation.md)
- [ADR-0028 — First POC: Evidence Integrity Workbench](0028-first-poc-evidence-integrity-workbench.md)
- [ADR-0030 — Evidence V1 identity and canonical placement](0030-evidence-v1-identity-and-canonical-placement.md)
- [Evidence Integrity Workbench technical specification](../design/evidence-integrity-workbench-technical-specification.md)
