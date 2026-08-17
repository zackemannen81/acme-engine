# ADR 0048 — Evidence V2 Observe Contract

Status: Accepted
Date: 2026-08-16
Decision owners: ACME maintainers

## Context

[ADR-0047](0047-evidence-application-model-reset.md) §7 requires the replacement
application to decide its own contracts at first export rather than inheriting
ADR-0041, ADR-0042 or ADR-0043 implicitly. ACME-0154 is that first export: the
V2 model needs an observe contract before it can produce an
`ObservationOccurrence`.

Two measured failures constrain the decision.

**The model was asked to enumerate.** The frozen contract sent a coverage window
of up to 64 citable segments and required the response to account for every one
of them exactly once. A real window failed
`EVIDENCE_COVERAGE_WINDOW_INCOMPLETE` after a consumed repair call, because the
model missed a single segment out of 64. Nothing evidential depended on that
enumeration: the product chose the segments and already knew what it had sent.

**A failed window destroyed committed work.** Projection ran only after a whole
job succeeded, so two runs committed one and six windows to the engine and
projected nothing. The engine had the evidence; the product never saw it.

A third constraint is older and still binding: the product definition's
authority ladder puts model output at L2, a candidate. Model prose must never
become the canonical record of what a source says.

## Decision

### 1. `evidence-v2-observe/1`

One execution observes one **window**: an ordered set of citable units drawn
from a single source part of a single chain instance.

Input carries the artifact version, the part, the window's units — each with its
unit id, line range and exact quote — and nothing else. No prior instance, no
other actor's statement, no constructed roster, and no neighbour context
(ADR-0046 §4). Extraction stays Pass 1.

### 2. The model selects and classifies; it never writes evidence text

For each unit it judges evidential, the response returns:

- `sourceUnitId` — one id from the window;
- `kind` — `statement-occurrence` or `exhibit-assertion`;
- `statedTime` — the time span the unit itself states, as `from` and optional
  `to`, or `null`;
- `actorReference` — `null` unless a roster was supplied, and no roster is
  supplied by this version.

The occurrence's **quote and locator are taken from the cited unit**, never from
the response. The model cannot author, paraphrase or trim the evidence text, so
no wording it invents can enter the record. That is ADR-0043's runtime-derived
quote principle restated for a model whose citable units already exist and are
already proven uniquely bindable by
`evidence-v2-source-structure/1`.

No summary, rationale or proposition field is stored. Any prose the model
produces is confined to the retained request/response payload, which is
evidence about the execution rather than about the source.

**The model does not type the time.** It reports the span the unit states; the
product derives the typed kind from it — `exact` when a point with a time of day
is stated, `range` when a span or a bare date is, and no bound at all when
nothing is stated. This mirrors how `ChainInstance` already derives its typed
instance time from document metadata (ACME-0151), and it removes a refusal class
the same way §3 removes the enumeration obligation: an untyped bound becomes
unrepresentable rather than refusable.

Clarified 2026-08-16, after the first live run. The response originally carried a
model-typed `temporalBound`, and the first live extraction was refused twice —
primary and bounded repair — with `EVIDENCE_V2_TEMPORAL_BOUND_UNTYPED` because
the model returned a known kind with no value. Refusing more politely would have
been tuning; removing the obligation is the decision. Nothing else in this ADR
changes, and no committed evidence existed to migrate.

**A stated time is a calendar value or nothing.** `from` and `to` must match a
year, a year and month, a date, or a date with a time of day. The constraint is
in the output schema, so it reaches the provider on the wire, and it is repeated
in the record's own bound type.

Clarified 2026-08-17, after the run that recorded this task. The model returned
the Swedish word `då` — "then" — as a stated time for one unit, and the product
typed it into a temporal bound. A word is not a time: a bound whose `from` is
`då` would be ordered on a timeline as though it were a date, which is exactly
the vague-to-precise conversion the product definition forbids. Prose already
told the model not to do it; prose was not enough. The shape is now
unrepresentable rather than merely discouraged, on the same reasoning as §3 —
and a vague reference becomes `null`, which loses nothing, because the unit's
own words are retained verbatim and remain the evidence.

### 3. Coverage is derived, never demanded

The response says nothing about units it did not select. The product knows which
units it sent and which were cited, so coverage — which units carry an
occurrence and which do not — is computed from stored rows.

An empty response is valid. A window may legitimately contain no evidential
statement, and refusing that would force the model to invent one.

### 4. Windows are small enough to answer reliably

A window carries at most **24 citable units** and targets at most **800 words**
of quoted text. The frozen 64-unit window is not narrowed arbitrarily: the
enumeration obligation that made 64 fatal is gone under §3, and the remaining
bound exists so one request stays small, one response stays short, and a refusal
costs one small call rather than a large one.

### 5. Refusals are named and local

A response is refused when it cites a unit outside the window, cites the same
unit twice, supplies a non-null actor with no roster, or states a time span whose
`to` precedes its `from`. A stated time that is not a calendar value is refused
by the output schema itself rather than by a named refusal, because a value that
cannot be represented never reaches semantic validation. One bounded repair may
be attempted; after that the **window** fails closed.

A failed window fails alone. It does not invalidate other windows, the part, the
instance, the artifact or the case.

### 6. Every window commits on its own

A window's occurrences are persisted when that window's execution commits, not
when the job ends. A later failure therefore leaves earlier occurrences valid,
visible and unchanged, and the extraction is reported as partially complete with
the failed window named.

### 7. Window identity makes resume deterministic

A window's execution identity is derived from the artifact version, the part,
the window ordinal and the contract version. Re-running an instance's extraction
executes only windows with no committed execution, so nothing already paid for
is re-sent and nothing is duplicated.

### 8. The engine is used unchanged

Execution identity, the bounded response pipeline, repair budgeting, encrypted
payload retention and replay come from `packages/core` as they are. The V2
module supplies a namespace, a state, a delta, a reducer, invariants and one
task. If this contract had required a change inside the engine, that would be
ADR-0047 §9's proof obligation failing and would be recorded as a finding.

## Alternatives Considered

### Keep the enumeration obligation and shrink the window

- Benefits: coverage arrives in one response; no product-side derivation.
- Costs: the obligation still fails, just less often, and every failure still
  costs a call plus a repair. It also asks the model to be a bookkeeper for
  facts the product already holds.
- Reason not selected: the enumeration carried no evidential value. Removing it
  removes a failure mode instead of reducing its frequency.

### Let the model return the quote

- Benefits: simpler contract; the model can trim to the evidential fragment.
- Costs: model text becomes the canonical record; every quote needs verbatim
  re-verification; a paraphrase that validates is indistinguishable from a
  citation.
- Reason not selected: L1 must be source-derived. The structure layer already
  guarantees each unit binds uniquely, so there is nothing to gain and an
  authority boundary to lose.

### Continue past a failed window

- Benefits: one run extracts everything extractable.
- Costs: a systematic contract or prompt fault burns every remaining window
  before anyone looks at the first failure.
- Reason not selected: fail-closed is kept. Resume under §7 recovers the useful
  half of continuing without the cost of ignoring a fault.

## Consequences

### Positive

- The failure that killed the frozen extractor is designed out rather than
  tuned down.
- A paid window is never paid for twice.
- Model prose cannot become evidence.
- Coverage is a product fact, so "which units have nothing" is answerable
  without asking a model.

### Negative

- The product must compute and display coverage itself.
- A window that legitimately contains nothing looks identical to a window whose
  model call was unhelpful. Distinguishing them needs the retained payload.
- Without neighbour context, a unit whose referent lives in the previous
  sentence may yield a weaker classification. That is accepted for `/1` and is
  the first candidate for an additive `/2`.

### Follow-ups

- Review and standing over occurrences are a separate task; this ADR decides
  nothing about acceptance.
- Neighbour context, actor rosters and Pass 2 relations each require their own
  additive contract version or ADR.

## Compatibility and Migration

- Nothing existing changes. This is a first export: no stored V2 record, no
  frozen contract and no historical request hash is touched.
- Frozen observe contracts `@1.0.0`–`@1.11.0` remain registered and byte-exact
  in the frozen application, and this ADR does not amend ADR-0041, ADR-0042,
  ADR-0043 or ADR-0046.
- A later contract version is additive and re-derives nothing already committed.

## References

- [ADR-0047](0047-evidence-application-model-reset.md) §6, §7, §9
- [ADR-0043](0043-runtime-derived-observation-quotes.md) — the principle this
  restates for the V2 unit model
- [ADR-0046](0046-source-chronology-and-claim-projection.md) §4 — Pass 1 only
- [ADR-0044](0044-poc1-live-product-acceptance-phase.md) — execution bounding
- [V2 domain specification](../design/evidence-workbench-v2-domain-specification.md)
  §2.3, §5, §9 (R-04, R-05, R-09)
- [Product definition](../design/evidence-integrity-workbench-product-definition.md)
  — authority ladder and statement/truth separation
