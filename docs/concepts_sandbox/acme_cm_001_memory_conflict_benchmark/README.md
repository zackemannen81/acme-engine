date: 2026-08-01
updated at: 2026-00-01
owner: mrWhite (Rickard Zakrisson)
Status: Idébank och framtidsbild. Inte beslutad arkitektur, inte roadmap och inte underlag för nuvarande scope.

# ACME-CM-001 — Memory Conflict Benchmark

This package contains a synthetic cognitive-science manuscript designed to test conflict handling, provenance, supersession, replay, and scope-sensitive merging in ACME.

Nothing in the manuscript represents a real completed study. The literature references are real; the manuscript authors, institution, participants, methods execution, and result data are fictional.

## Files

- `acme_cm_001_paper.md` — realistic research-paper text containing distributed contradictions, stale statements, corrections, scoped facts, and compatible interpretations.
- `acme_cm_001_ground_truth.json` — canonical facts, conflict classes, non-conflicts, and expected query answers.
- `acme_cm_001_stream.jsonl` — an event stream with provenance, effective timestamps, reliability hints, expected ACME operations, and expected state after each event.

## Recommended test modes

### 1. Plain-document ingestion

Chunk the paper by headings or paragraphs and ingest it in document order.

Verify that ACME:

- retains claims and their provenance;
- updates the final sample from 186 to 184;
- rejects the reversed Table 2 label;
- preserves the sample lifecycle 192 → 186 → 184;
- distinguishes planned 48 hours from implemented 24 hours;
- does not collapse Room 214 and Room 318 into an unresolved contradiction;
- keeps source-monitoring and reconsolidation as compatible alternatives;
- answers the evaluation queries using the highest-priority evidence.

### 2. Adversarial stream replay

Ingest `acme_cm_001_stream.jsonl` in `ingest_order`.

The stream intentionally includes stale claims that arrive after newer corrections. Use `effective_at`, source type, provenance, and version priority rather than arrival order alone.

A deterministic implementation should produce the same final canonical state and decision log after replay.

### 3. Operation-level assertions

The stream uses ACME-style expected operations:

- `create`
- `reinforce`
- `merge`
- `contest`
- `supersede`
- `reject`
- `ignore`

Treat these as benchmark expectations rather than mandatory internal implementation names. Equivalent semantics are acceptable.

## Important semantic traps

1. **Different predicates:** recruited N, pre-audit analyzed N, and final N are not interchangeable.
2. **Different scope:** two rooms belong to different cohorts.
3. **Planned versus implemented:** 48 hours and 24 hours are both true under different qualifiers.
4. **Coding versus perception:** red and orange-red can coexist; blue is misinformation.
5. **Theory versus fact:** source monitoring and reconsolidation are interpretations, not mutually exclusive event facts.
6. **Late stale arrival:** a lower-priority old manuscript statement must not overwrite a newer audit correction.
7. **Numerical typo:** `.081` and `.018` require provenance-sensitive resolution, not averaging.
8. **Strength of conclusion:** “eliminated” is not supported by the nonsignificant interaction and is explicitly corrected to “attenuated.”

## Suggested scoring

Award one point for each of the 12 evaluation queries in the ground-truth file.

Add:

- 2 points for preserving provenance for every superseded or rejected claim;
- 2 points for deterministic replay;
- 2 points for retaining all five non-conflict structures without false contradiction resolution;
- 2 points for preventing stale-arrival overwrite;
- 2 points for producing an auditable operation trace.

Maximum suggested score: **22 points**.

## Suggested hard assertions

```text
final_sample_size == 184
recruited_sample_size == 192
pre_audit_analyzed_sample_size == 186

high_reliability_source == "forensic video analyst"
left_handedness_used_as_exclusion == false
planned_contrast_p == 0.018
repetition_effect_conclusion == "attenuated but not eliminated"

planned_retention_interval_hours == 48
implemented_retention_interval_hours_approx == 24

critical_item_count == 8
filler_item_count == 2

room_by_cohort.A == "Room 214"
room_by_cohort.B == "Room 318"
```

## Replay invariant

After any complete replay that preserves source metadata and effective timestamps, the canonical facts should equal `canonical_facts` in `acme_cm_001_ground_truth.json`, regardless of whether stale manuscript chunks are delivered before or after author corrections.
