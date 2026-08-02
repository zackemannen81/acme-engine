# ADR 0022 — Measurement semantics and the fixture-approval boundary

Status: Accepted

Date: 2026-08-02

Decision owners: ACME maintainers

## Context

Phases 1–4 gave the Domain Test UI seven view contracts, a plan compiler, a
launch path and run history. Every one of those surfaces is a projection: it
shows what the engine, the runner or the registries already recorded.

S8 is different. A measurement is a number that did not exist before the
interface computed it. That collides directly with the rule ADR-0019 fixed —
the interface never computes a verdict — and the collision is not avoidable by
declaration. It has to be resolved by deciding exactly what may be computed.

The specification already draws part of the line: aggregate only against
configured thresholds and baselines; no baseline means no regression claim;
case counts are always stated; live and deterministic series are never mixed
into one deterministic score.

S9 has a different problem. A golden fixture is a pinned expectation. If the
interface could rewrite one, every test that depends on it would silently
change meaning, and the thing that made the test worth having — that a human
decided what the right answer is — would be gone.

## Decision

### 1. Measures are rates over recorded run records, and nothing else

Three measures, each computed from `acme-run-record/1` values the workspace
already holds:

```text
runPassRate     passed runs        / runs
stepPassRate    passed steps       / steps
replayMatchRate passed replay steps / replay steps
```

Each reports its `sampleSize` alongside its value. A reader can always see how
much evidence a number stands on.

No weighting, no composite, no grade, no trend. Those are models, and this
interface is not entitled to invent one. If a project wants a score, the score
belongs wherever its definition is owned — not in a lens.

### 2. A rate over zero samples is unavailable, not a rate

An empty series reports `unavailable` with reason
`MEASUREMENT_SAMPLE_EMPTY`.

Returning `1` because nothing failed is the arithmetic form of the defect
ADR-0019 already rules out for view sections: absence rendered as a value. A
replay match rate of 100 percent across zero replays is not good news, and
displaying it as good news is worse than displaying nothing.

### 3. A threshold outcome exists only where a threshold was configured

A measure with no configured threshold reports its value and `threshold: null`.
It does not pass, and it does not fail; nobody said what passing means.

Where a threshold is configured, the outcome is `met`, `not-met` or
`unavailable` — the last when the sample is empty, because an unmeasurable
series cannot meet or miss a bound.

This keeps the interface's role honest: the threshold is the human's rule, and
the interface reports whether the recorded evidence satisfies it. That is a
comparison, not a verdict about quality.

### 4. With no baseline there is no comparison

A baseline is a stored measurement snapshot, taken deliberately. Comparison
against it yields `improved`, `unchanged` or `regressed` per measure.

With no baseline, the comparison is `unavailable`. It is never "no
regression". A system that has never been measured before has not improved and
has not regressed; it has been measured once.

### 5. Deterministic and live series are partitioned at the source

Run records carry the gateway their run used. Records are partitioned into a
deterministic series (`gateway: mock`) and a live series (anything else), and
the two are measured separately. A live run cannot enter a deterministic
measurement because it is never in that array.

`acme-test-plan/1` currently permits only `gateway: mock`, so the live
partition is always empty today. The partition is built now anyway: phase 6
introduces live runs, and a rule that exists before the data it governs cannot
be forgotten when the data arrives.

### 6. Approving a fixture change writes no fixture

A proposal names a fixture path, the digest currently pinned there and the
digest a run actually produced. Approval records that a human accepted the
change. It does not write the file.

The record produces a described, reviewable change — path, expected digest,
proposed digest, approver, rationale — that a person applies through the
repository like any other change. Silently rewriting the golden would make the
interface the author of the expectation it is supposed to be checking against.

Approval requires a non-empty approver identity and a non-empty rationale.
Both are refused when absent, and there is no auto-accept path at all: no
threshold, no "identical except timestamps", no batch mode.

### 7. Approvals and baselines are ordinary workspace artifacts

They live under the ADR-0021 workspace root as `approvals/<id>.json` and
`baselines/<name>.json`, with the same safe-name rule run records use, and the
same property: deleting them loses interface state and no canonical fact.

## Alternatives Considered

### Alternative A — Compute a composite quality score

- Benefits: one number to watch; matches how benchmark suites usually report.
- Costs: the weighting is a model nobody has specified, and it would hide
  which measure moved. It would also be the interface deciding what quality
  means, which is exactly the boundary ADR-0019 draws.
- Reason not selected: no consumer has asked for a score. The only concrete
  proposal lives in `docs/concepts_sandbox/`, which no charter may cite.

### Alternative B — Treat an empty series as a passing rate

- Benefits: no `unavailable` state to handle; every measure always has a
  number.
- Costs: a green dashboard for a suite that ran nothing.
- Reason not selected: it is the "zero instead of missing" defect in numeric
  form.

### Alternative C — Let approval write the fixture

- Benefits: one click updates the golden; no manual step.
- Costs: the interface becomes the author of the expectation, and a mistaken
  approval silently changes what every dependent test asserts.
- Reason not selected: the specification forbids a silent fixture write, and
  the reason it forbids it is sound.

## Consequences

### Positive

- Every number carries its sample size, so it can be judged.
- An unmeasured series is visibly unmeasured.
- A live run cannot contaminate a deterministic measurement, before live runs
  exist.
- A golden changes only through a reviewable repository change with a named
  approver and a stated reason.

### Negative

- Three measures is a small vocabulary; a project wanting more must extend the
  contract rather than configure it.
- Baselines are manual: nothing promotes one automatically, by decision.
- Applying an approved fixture change is a separate human step.

### Follow-ups

- Phase 6: live evaluation fills the live partition and must keep it separate.
- If more measures are wanted, they are additive fields on
  `acme-view-measurement/1` and need no version bump.
- A command that applies an approved change as a repository edit could be
  chartered later; it would still be a human action, not an interface write.

## Compatibility and Migration

Nothing existing changes. Core, the adapters, the modules, `@acme/testing`,
`acme-scenario/1`, `acme-test-plan/1`, the CLI and the S1–S7 contracts are
untouched.

`acme-measurement-baseline/1` and `acme-fixture-approval/1` are new
interface-owned record formats under the existing workspace root. Both are
read with the same rule as run records: an unknown version is reported as
unreadable rather than skipped, so a format change cannot silently shrink what
a reviewer sees.

## References

- [ADR-0019 Domain Test UI boundary and view contracts](0019-domain-test-ui-boundary-and-view-contracts.md)
- [ADR-0021 Interface workspace and launch boundary](0021-interface-workspace-and-launch-boundary.md)
- [Domain Test UI — Specification](../design/domain-test-ui-specification.md)
- `apps/test-ui/src/run-record.ts` — the recorded series being measured
