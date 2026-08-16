# ACME-0136 — POC #1 outcome-blind acceptance report (FROZEN)

Status: Frozen immutable evaluation output
Frozen at: 2026-08-16
Author: Claude
Task: ACME-0136
Phase decision: ADR-0044

This report was frozen before any external source was opened. Nothing below
was written or revised after the sealed source was read.

## Evidence discipline

Every domain statement below is traceable to material imported in this run or
to evidence the product itself recorded. No web search was performed, no
external summary was read, and no prior or latent knowledge of the case was
used for any decision, correction or interpretation.

## Case

| | |
| --- | --- |
| Case id | `evidence-case-4421bda17996e791ef4d8c1957a16130e3cabc8d2d1f716f993dd3d27d04cb1e` |
| Case reference | ACME-0136 |
| Title | POC1 outcome-blind acceptance ACME-0136 |
| Data policy | `stage-a-authorized-judicial-text` |
| Workspace | `evidence-workspace-d32a2a135831358b745968ec26922692436c38041d70a863de7b63a399da5d4a` |
| Created through | Product New-case command (same route as the browser form) |
| Substrate | Isolated PostgreSQL database `acme0136` and MinIO bucket `evidence-private-0136` |
| Prior state reused | None on this substrate. New case, new workspace, no prior execution, observation or accepted evidence. |

## Documents

### source-A.pdf — IMPORTED

| | |
| --- | --- |
| PDF SHA-256 | `ab2b9a5682e459291648833ca61d423d13e118752d27e22acc78fa48762f7a86` |
| PDF bytes | 56,795,817 |
| Pages | 1,915 |
| Canonical text SHA-256 | `d9113164b8dbb352d932f005c76125cbc57ba3b00b6a622e9afa44d1ebb53f2d` |
| Canonical text bytes | 3,521,477 |
| Canonical lines | 74,469 |
| Longest line | 136 scalars |
| Import id | `text-import-82b13ab463d69c3e48a99e8738b1c678bf56dce81a497b255ecd10d6f3936188` |
| Artifact version | `evidence_artifact_528b43d2212449f62a3da5b2bccd6239486e497e894d913e3b44cdef32ac5d80` |
| Logical artifact | `ART-82B13AB463D69C3E48A99E8738B1C678` |
| State | `activated` |
| Outcome | `HTTP 201 Created` |

The server-computed canonical SHA-256 and byte length match the prepared text
exactly. ACME-0133 refused this document at 2,200,000 bytes. It now enters.

### source-B.pdf — IMPORTED

| | |
| --- | --- |
| PDF SHA-256 | `c1f9a79ba65c63326f368e9b346125493b578a49d999d42ca35cbf695bcccc07` |
| PDF bytes | 33,248,874 |
| Pages | 100 |
| Canonical text SHA-256 | `ba6191f0f87a11a0ac841fdd4ce739a4c0029ea15f017db048386763c3605888` |
| Canonical text bytes | 86,726 |
| Canonical lines | 2,899 |
| Import id | `text-import-e74bcee18fcbe769d13f74199ec4ff4dafcf11a76e066c73063ad4c50cc8bff4` |
| Artifact version | `evidence_artifact_09fde67de031471d898d562aa0bba6d93b9038381e9743d3ea78a43ff066a5c5` |
| Logical artifact | `ART-E74BCEE18FCBE769D13F74199EC4FF4D` |
| State | `activated` |
| Outcome | `HTTP 201 Created` |

The server-computed canonical SHA-256 matches the prepared text exactly.

## Executions and measured cost

| | |
| --- | --- |
| Observation B | `execution_b3440c7a024dbe1565975761be3eb7c5e1787d92712b3fef50fb96cff6bd3022` — committed |
| Observation A | `execution_91d67670da5e01f389e79c5d632f42d057c13f3ba273fbda6978512447fe9db0` — failed (`INVALID_REQUEST`) |
| Relation | `execution_14cb00b5180d6357d6e2014ee2ff59729de2346847048fabc55ae9163ee7704c` — failed (`MODEL_INVALID_RESPONSE`) after one repair |
| Assessment | `execution_ec4cda94a0acb160a136e78dca53934b5d3fd679bdd322b9bfd70186daa03d4e` — failed (`DOMAIN_INVALID_RESULT`) after one repair |
| Model calls in this run | 6 |
| Calls reporting usage | 5 / 6 |
| Input tokens | 94,064 |
| Output tokens | 13,861 |
| Total tokens | 107,925 |
| Provider-reported cost | **unknown** — 0 of 6 calls carried `estimatedCostMinor` |
| Currency | **null** |
| Deployment call ceiling | none configured |
| Deployment cost ceiling | none configured |

Per-call usage, read from `acme.model_calls` on `acme0136`:

- observation B: 66,375 input + 1,192 output = 67,567 total, `openai` / `gpt-5.6-luna`, `primary`, succeeded
- observation A: usage **null**, provider **null**, model **null**, `primary`, failed
- relation primary: 6,907 input + 3,951 output = 10,858 total, succeeded
- relation repair: 7,207 input + 1,945 output = 9,152 total, `repair:1`, succeeded at the provider, then refused
- assessment primary: 6,749 input + 4,096 output = 10,845 total, succeeded
- assessment repair: 6,826 input + 2,677 output = 9,503 total, `repair:1`, succeeded at the provider, then refused

Cost is reported as unknown rather than zero. The provider returned no price
field, and no local price table was applied. The failed observation-A call is
counted and its usage is unknown, not zero.

## Live observation B — SUCCEEDED

Job `evidence-live-job-01a6dd2be15c992de65e0ac2bc49f16ea9c3585ce3ab0787698101ba19f0b830`
reached `LIVE_OBSERVATION_COMPLETED` with `actualModelCalls: 1` and projected
24 source-bound observations. The product default rationale was left unedited.

Cited lines: L191, L197, L202, L215, L223, L230, L300, L307, L317, L418, L447,
L745, L831, L926, L1196, L1226, L1637, L1664, L1972, L1983, L2313, L2521,
L2726, L2739.

None of the 24 carried an actor label or a temporal bound.

## Live observation A — FAILED

Job `evidence-live-job-9070b0b6c86ec405349f559fec04d8ad7ff1f073d2816b17a572835e18168782`
failed with `INVALID_REQUEST` after `actualModelCalls: 1`. The provider row
has no model, no provider and no usage. Zero observations were projected from
source-A. The failure was preserved and not retried.

## Human review — 24 accepted, 0 rejected

Decision rule, stated before reviewing: accept when the quote is verbatim from
its cited line and the fragment carries a self-contained evidentiary statement;
reject a heading or a fragment that asserts nothing verifiable on its own.

All 24 quotes were verbatim on their cited line. None matched the heading
rule. Review queue after review: 0 pending.

## Live relation analysis — FAILED after repair

Job `evidence-live-relation-job-b94bbccf48649c239a7d71233c17f0f1a9a8228aef7064da46d9055bc1c88f6c`
failed with `MODEL_INVALID_RESPONSE` after `actualModelCalls: 2`. Both the
primary and the repair provider calls succeeded and recorded usage. The
repaired response was still refused by the pipeline. Zero relations and zero
open questions were projected. The failure was preserved and not retried.

## Live assessment — STARTED, then FAILED after repair

The assessment was no longer refused for missing relations. It received the 24
accepted observations and an empty relation set, and it made provider calls.

Job `evidence-live-assessment-job-1fc1b7892c5d4f2c2ba24e2e524ca008d89882e3f008bb07b7e4408615438a34`
failed with `DOMAIN_INVALID_RESULT` after `actualModelCalls: 2`. Both provider
calls succeeded and recorded usage. The repaired output still failed
interpretation. No assessment document was produced. The failure was preserved
and not retried.

## Product surfaces at freeze

| Surface | State |
| --- | --- |
| Case overview | sources 2, pending observations 0, pending relations 0, open questions 0, assessments needing review 0 |
| Observation ledger `GET /api/observations` | **HTTP 409** — workspace evidence revision does not match the Evidence projection |
| Relations `GET /api/relations` | **HTTP 409** — same revision mismatch |
| Open questions `GET /api/open-questions` | **HTTP 409** — same revision mismatch |
| Timeline | 0 entries — no observation carried a temporal bound |
| Integrity report | 24 source-bound observations; 0 changed-account pairs, contradictions, qualifications, corrections, temporal conflicts; 0 report rows |
| Work queue | 0 pending after review |
| Export policy | enabled `true`, 4 allowed formats, revision 0 |
| Assessment `GET /api/assessments/latest` | **HTTP 404** — none produced |
| Documents | 2 imported documents |

## Errors and manual interventions

1. **First probe case discarded.** A first case on the shared `acme` database
   imported both documents, then live observation collided with
   `EVIDENCE_PRODUCT_COMMAND_COLLISION` after one paid call. Two imports had
   advanced the product workspace revision ahead of the engine; the worker
   treated any inequality as divergence. That case is not this run. The guard
   was corrected to refuse only when the engine is *ahead* of the product, the
   worker was rebuilt, and this run uses a new database, bucket and case.
2. **Shared-volume restart failure.** Restarting the workbench against the
   previous PostgreSQL/MinIO volume failed closed on artifact reconciliation
   (`1 integrity failure`). The acceptance substrate was moved to `acme0136`
   / `evidence-private-0136` rather than repaired in place.
3. **source-A and source-B paste.** Canonical text was submitted to the same
   `/api/text-imports` route the browser form posts to. Server-side
   validation, attestations, CSRF, encryption and persistence all ran.
4. **Review loop.** The 24 accept decisions were submitted through
   `/api/reviews`, the same command the reviewer buttons post.
5. No database state or projection was edited by hand on the acceptance case.

## POC result: **FAIL**

The product did not produce a usable domain result from the evidence it was
given.

What improved since ACME-0133, and is real:

- source-A now imports. Canonical hashes match. The previous ingest refusal
  is gone.
- One observation call returned 24 candidates, not eight.
- Repair ran. Relation and assessment each made a recorded `repair:1` call
  instead of discarding the first response unseen.
- Assessment is no longer structurally blocked by missing relations.
- Cost is measurable for five of six calls.

Why it is nonetheless a FAIL:

1. **source-A still cannot be analysed.** The 1,915-page document enters and
   then dies as `INVALID_REQUEST` with no usage. Half the material is present
   as an artifact and absent as evidence.
2. **No relations.** Primary plus repair both returned; both were refused.
   Zero relations, zero open questions.
3. **No assessment.** The path opened, spent two calls, and failed
   interpretation. The end deliverable was not produced.
4. **Empty timeline.** All 24 observations have `actor: null` and `time: null`.
5. **Core reviewer surfaces 409.** After a successful observation projection,
   the observation ledger, relations and open-question views refuse because
   the product workspace revision and the engine projection disagree. Overview,
   work queue, integrity report, timeline and export policy still answer.
6. **The 24 observations remain single-line fragments from one 100-page
   document.** ADR-0045 §6 (full-source coverage) is still absent.

The integrity machinery still holds on the surfaces that answer. The
evidence-production path still cannot turn the supplied investigation file
into a traceable, usable domain result. On the criterion set for this run —
can the product carry a real evidence workflow end to end — the answer from
this run is no.

## Freeze boundary

This report is complete and frozen. The sealed external source has not been
opened. Post-freeze comparison is recorded separately and does not alter
anything above.
