# ADR 0045 — Real-Material Scale and Recovery

Status: Accepted
Date: 2026-08-16
Decision owners: ACME maintainers

## Context

ACME-0133 ran the first outcome-blind acceptance of POC #1 against two real
investigation documents. The integrity machinery held everywhere it was tested:
exact canonical hashes, exact source binding, atomic projection, idempotent
review, fail-closed refusals, measured cost. The product still produced no
usable domain result, and the reasons were not defects. They were the product's
own configured bounds.

- `EVIDENCE_OBSERVATION_CANDIDATE_BATCH_MAX = 8` is enforced in both the prompt
  and the output schema. The model returned exactly eight candidates from a
  100-page forensic report because a ninth was forbidden. The prompt also
  instructs the model not to claim full-source coverage, so the contract
  describes its own output as a non-exhaustive sample.
- ADR-0038's ingest bounds — 2,097,152 canonical bytes and 20,000 lines, with a
  2,200,000-byte request body — refused a 1,915-page document outright at
  3,521,477 bytes. Half the supplied material never entered the product.
- The live assessment requires at least one relation, so a single refused
  relation response removed the product's end deliverable entirely.
- The relation response failed semantic validation with two open questions
  citing rationale codes absent from the same output. The pipeline classified
  it `repairable: true`. Nothing repaired it: the live jobs set
  `maxRepairCalls: 0`, and the execution engine never consumes that budget at
  all. `maxRepairCalls` is declared in the policy and in execution identity,
  and the only occurrence in the engine reports `repairable` on the error.

Every one of those numbers is comfortable for the seven-artifact synthetic
corpus the product was built against, and hostile to a real investigation file.
The fixture did not merely fail to catch these; it set them. ADR-0044 retired
the phase controls that governed *whether* the product could run live. This
decision retires the phase controls that govern *how much* it can express.

A second pattern is visible across ADR-0041, ADR-0042 and ADR-0043. Each was a
correct response to a real binding failure, and each bought integrity by
removing expressive power: bounded batches, then model-authored locators
removed, then quote text removed. The endpoint is a product that can prove
everything it states and can state very little. Integrity is not negotiable;
the trade against expressiveness is, and it has been resolved in one direction
every time.

## Decision

### 1. Bounds are sized for the material, not for the fixture

A limit that exists because the synthetic corpus was small is a phase control
and is retired. A limit that exists because the product would otherwise be
incorrect, unsafe or unbounded stays.

Retired as fixture-calibrated:

- the eight-candidate observation batch ceiling;
- ingest bounds that cannot admit a real investigation file;
- the request-body bound derived from them.

Retained because they protect correctness:

- one quote binds to exactly one immutable source segment (ADR-0043);
- runtime derives quote, locator and identity, never the model;
- strict schema and semantic validation with fail-closed refusal;
- per-execution model-call bounding;
- every ADR-0044 §2 guardrail.

### 2. Observation batches are bounded by the response, not by a fixture

The active observation contract raises the candidate ceiling to a value chosen
from the response budget rather than from the corpus. The ceiling remains
explicit and machine-checked in both prompt and schema, because an unbounded
array invites truncation, and truncated JSON is a refusal rather than a result.

The batch remains explicitly non-exhaustive. Raising the ceiling increases how
much one call may return; it does not establish full-source coverage, which
§5 addresses separately.

Historical observation contract versions remain registered byte-exact for
replay. The change is additive and produces a new active version.

### 3. Ingest admits real investigation files

Canonical text bounds are raised to admit documents of the size the product
exists to serve, with the request-body bound raised to match. Line-scalar
bounds are unchanged, because a single enormous line is a malformed extraction
rather than a large document.

Admitting a document is not a claim that one model call can analyse it. A
document may now be imported, versioned, redacted, cited and navigated at a
size no single call can process, and that separation is intentional.

### 4. Assessment depends on accepted evidence, not on relations

The live assessment requires accepted, source-complete observations. It no
longer requires at least one relation. A case with observations and no
relations is an ordinary state — the product should assess what it has and say
what is missing, rather than refuse.

Relations remain a first-class input when present. Their absence is reported to
the reviewer, never silently ignored.

### 5. Recoverable work is repaired, not discarded

The execution engine must implement the repair budget it already declares. When
the response pipeline classifies a failure `repairable` and the policy allows a
repair call, the engine issues one bounded repair call carrying the validation
issues, under its own call key and attempt number, before failing the
execution.

Live jobs configure a non-zero repair budget. A call that produced structurally
coherent output with a correctable defect must not be paid for and thrown away.

Repair remains bounded and recorded: it consumes explicit budget, appears in
recorded evidence as its own model call with its own usage, and never loops.
An execution that exhausts its repair budget fails exactly as before.

### 6. Full-source coverage is deferred and named

Neither a larger batch nor a larger document bound gives a document-complete
result. A 100-page report analysed by one call returning a bounded
non-exhaustive batch is still a sample. Document coverage requires iteration
over segments with explicit accounting of what was and was not examined, and it
is a workflow rather than a constant.

That workflow is deliberately out of scope here and is recorded as the next
dependency. Until it exists, the product must not present a batch as complete
coverage, and its own prompt continues to forbid that claim.

## Alternatives Considered

### Leave the ceilings and iterate more

- Benefits: no contract change, no new versions.
- Costs: eight fragments per call is a sampling floor no amount of iteration
  fixes efficiently, and the 1,915-page document still cannot enter.
- Reason not selected: the bounds are the binding constraint, not the cadence.

### Remove all bounds

- Benefits: simplest to state.
- Costs: unbounded arrays truncate against the output budget, and truncated
  JSON refuses. Unbounded documents make a single call impossible rather than
  merely large.
- Reason not selected: bounds derived from the response budget and from real
  material are engineering; bounds derived from a fixture are not.

### Repair by retrying the whole execution

- Benefits: no engine change.
- Costs: a full retry re-sends the entire source, doubles input cost, and
  produces a new execution identity, losing the resume and replay properties.
- Reason not selected: repair exists in the policy precisely to avoid this.

## Consequences

### Positive

- One call can return substantially more evidence, and a real file can be
  imported at all.
- A correctable model response is corrected instead of paid for and discarded.
- An assessment is reachable from observations alone.

### Negative

- Larger documents mean larger encrypted objects, larger request bodies and
  more memory per import.
- A raised batch ceiling increases output tokens per call and therefore cost
  per call.
- Repair adds a second call to some executions. It is bounded and recorded, and
  it is cheaper than discarding the first.

### Risks

- A raised ceiling that approaches the output budget reintroduces truncation.
  The ceiling must stay provably inside the response budget.
- Importing documents that no single call can analyse makes the missing
  coverage workflow more visible, not less. Section 6 names it rather than
  hiding it behind a bound.
