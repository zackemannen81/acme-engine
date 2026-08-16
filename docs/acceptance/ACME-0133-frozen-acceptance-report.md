# ACME-0133 — POC #1 outcome-blind acceptance report (FROZEN)

Status: Frozen immutable evaluation output
Frozen at: 2026-08-16
Author: Claude
Task: ACME-0133
Phase decision: ADR-0044

This report was frozen before any external source was opened. Nothing below
was written or revised after the sealed source was read.

## Evidence discipline

Every domain statement below is traceable to material imported in this run or
to evidence the product itself recorded. No web search was performed, no
external summary was read, and no prior or latent knowledge of the case was
used for any decision, correction or interpretation.

The imported material identifies itself on its own first lines as a Linköping
District Court file with a case number and an investigation diary number. That
identification is part of the imported evidence, not external input. No lookup
of it was made, and it played no part in any decision in this run.

## Case

| | |
| --- | --- |
| Case id | `evidence-case-b4dfb638313253cce5e804369d6cd3d399febd24c7adac9f7ef0025362feb5cb` |
| Case reference | ACME-0133 |
| Title | POC1 outcome-blind acceptance |
| Data policy | `stage-a-authorized-judicial-text` |
| Workspace | `evidence-workspace-0e644b5a98e1d82ada36032a3fa108b27125243c73c6c6c4d84e9319d631ba5f` |
| Created through | Browser, New case |
| Prior state reused | None. New case, new workspace, no prior execution, observation or accepted evidence. |

## Documents

### source-A.pdf — REFUSED, not imported

| | |
| --- | --- |
| PDF SHA-256 | `ab2b9a5682e459291648833ca61d423d13e118752d27e22acc78fa48762f7a86` |
| PDF bytes | 56,795,817 |
| Pages | 1,915 |
| Canonical text SHA-256 | `d9113164b8dbb352d932f005c76125cbc57ba3b00b6a622e9afa44d1ebb53f2d` |
| Canonical text bytes | 3,521,477 |
| Canonical lines | 74,469 |
| Longest line | 136 scalars |
| Outcome | `HTTP 409 REQUEST_BODY_TOO_LARGE` |

The product refused the import. The request-body bound for text import is
2,200,000 bytes (`apps/evidence-workbench-api/src/index.ts:1317`), and the
canonical text alone is 3,521,477 bytes, so the refusal occurred at transport
before the ingestion validator ran. Had it passed, two further ADR-0038 bounds
would have refused it: 2,097,152 canonical bytes and 20,000 lines.

The document was not split, truncated or reclassified to make it fit. No
provider call was made for it and nothing from it entered the case.

### source-B.pdf — IMPORTED

| | |
| --- | --- |
| PDF SHA-256 | `c1f9a79ba65c63326f368e9b346125493b578a49d999d42ca35cbf695bcccc07` |
| PDF bytes | 33,248,874 |
| Pages | 100 |
| Canonical text SHA-256 | `ba6191f0f87a11a0ac841fdd4ce739a4c0029ea15f017db048386763c3605888` |
| Canonical text bytes | 86,726 |
| Canonical lines | 2,899 |
| Import id | `text-import-8dac9cdf810a25756529fbc5eab35a24b4b099c028fde32ed13d3c4ff6fffbc3` |
| Artifact version | `evidence_artifact_1f746ca63adf6cfa5ec3b9e00554b48cd44a2a3b438e00a5f46913ea394a96d7` |
| Logical artifact | `ART-8DAC9CDF810A25756529FBC5EAB35A24` |
| State | `activated` |
| Outcome | `HTTP 201 Created` |

The server-computed canonical SHA-256 and byte length match the prepared text
exactly, and the original and canonical representations hash identically.

## Executions and measured cost

| | |
| --- | --- |
| Observation execution | `execution_000d4553970c9f41120d5e2ce3d03bf9031a76157bfe6e3750e199a9f7e913f5` — committed |
| Relation execution | `execution_09d75ad30a563eb4bad79ca8c6082059a57188a83895f90202f64aa1ff84aad9` — failed |
| Assessment execution | none — refused before any call |
| Model calls in this run | 2 |
| Calls reporting usage | 2 / 2 |
| Input tokens | 69,150 |
| Output tokens | 2,329 |
| Total tokens | 71,479 |
| Provider-reported cost | **unknown** — 0 of 2 calls carried `estimatedCostMinor` |
| Currency | **null** — no call priced itself |
| Deployment call ceiling | none configured |
| Deployment cost ceiling | none configured |

Per-call usage, read from `acme.model_calls`:

- observation: 66,387 input + 431 output = 66,818 total, `openai` / `gpt-5.6-luna`, status succeeded
- relation: 2,763 input + 1,898 output = 4,661 total, `openai` / `gpt-5.6-luna`, status succeeded

Cost is reported as unknown rather than zero. The provider returned no price
field, and no local price table was applied.

## Live observation — SUCCEEDED

Started from Documents → Analyze source. The product's own default rationale
was left unedited and contains no hint about expected content. Job
`evidence-live-job-1cda7444f7d3e76f6672effc839b352c296d5a082f4d60ad482933c4be7e75ba`
reached `LIVE_OBSERVATION_COMPLETED` with `actualModelCalls: 1`, projecting 8
source-bound observations and advancing the workspace to evidence revision 1.

Every observation binds one exact quote to exactly one canonical source line,
and the reviewer view highlights that line in its surrounding source context.
The eight cited lines were L202, L215, L230, L447, L1226, L1967, L2036 and
L2736. All eight quotes were verbatim from their cited lines.

None of the eight carried an actor label or a temporal bound. All eight
reported actor `null` and time `null`.

## Human review — 7 accepted, 1 rejected

Decision rule applied, stated before reviewing: accept when the quote is
verbatim from its cited line **and** the fragment carries a self-contained
evidentiary statement; reject a heading or a fragment that asserts nothing
verifiable on its own.

| Cited line | Decision | Basis |
| --- | --- | --- |
| L202 | accept | Verbatim; states the knife was examined for DNA and fingerprints |
| L215 | accept | Verbatim; states where a newspaper stand was secured |
| L230 | accept | Verbatim; states a knitted cap lay in that stand |
| L447 | accept | Verbatim; states the knife was handed to the forensic laboratory |
| L1226 | accept | Verbatim; states the seized knife was checked against injuries |
| L1967 | accept | Verbatim; identifies a seizure item |
| L2036 | accept | Verbatim; identifies a biological trace item |
| L2736 | **reject** | `Undersökning och slutsats` — a section heading with no evidentiary content |

Review queue after review: 0 pending. Recorded decisions: 16 accept records and
1 reject record, appended to the immutable review history.

## Live relation analysis — FAILED

Started from Observation ledger → Analyze relationships. The job failed with
`MODEL_INVALID_RESPONSE` after `actualModelCalls: 1`. The provider call itself
succeeded and its usage was recorded; the response was refused by strict schema
validation downstream. Zero relations, zero open questions and zero standing
changes were projected. The failure was preserved and not retried.

## Live assessment — REFUSED, no call

Started from Assessment → Create assessment. The product refused with
`LIVE_ASSESSMENT_ACCEPTED_EVIDENCE_REQUIRED` and made **zero** model calls.
The condition is `observations.length === 0 || relations.length === 0`
(`apps/evidence-workbench-api/src/live-assessment.ts:417`). Seven accepted
observations existed, but zero relations, so the assessment was structurally
blocked by the relation failure above.

## Product surfaces at freeze

| Surface | State |
| --- | --- |
| Case overview | sources 1, pending observations 0, pending relations 0, open questions 0, assessments needing review 0, 17 recent activity records |
| Observations | 8 total, 8 current, 0 contested, 0 superseded |
| Relations | 0 |
| Open questions | 0 |
| Timeline | 0 entries — no observation carried a temporal bound |
| Integrity report | 8 source-bound observations; 0 changed account pairs, 0 scoped contradictions, 0 qualifications, 0 corrections, 0 temporal conflicts; 0 report rows |
| Work queue | 0 pending, most recent action recorded |
| Export policy | enabled `true`, 4 allowed formats, revision 0 |
| Assessment | none produced |
| My review work | reviewed items visible |
| Search | available |
| Compare accounts | no changed-account pairs to compare |
| Documents | 1 imported document, source navigable by exact line |

`GET /api/assessments` answers 404. That route does not exist and the browser
requests it; recorded as a known follow-up in ACME-0131.

## Errors and manual interventions

1. **Duplicate accept submissions (mine).** The review detail pane does not
   re-render after a decision, so a loop that repeatedly selected the first
   pending block submitted `accept` ten times for the observation at L202
   instead of once. All ten were appended to the immutable review history. The
   derived effective state remained one accepted observation and the work
   queue decremented correctly, so no divergent state resulted. This is a
   reviewer-side error by the operator of this run, and a product observability
   weakness that invites it.
2. **source-A transport.** The 3,521,477-byte text could not be placed in the
   browser textarea through the available tooling, so the import was attempted
   against the same endpoint the form posts to, with the exact canonical bytes.
   Server-side validation is identical on both routes. The refusal is the
   product's own.
3. **source-B paste.** The 83,815-character text was placed into the product's
   own textarea by script rather than by simulated keystrokes, then submitted
   with the product's own button. Validation, attestations, CSRF, encryption
   and persistence all ran normally.
4. **PowerShell tooling failure.** The session's PowerShell tool began
   returning exit 1 with no output partway through. Unrelated to the product;
   the run continued under Bash.
5. No database state or projection was edited by hand at any point.

## Data authority observation

The imported document is stamped `HEMLIG` on its first line and contains full
personal names and at least one Swedish personal identity number in plain text.
The Stage A import requires three operator attestations, including that the
source is anonymized. Those attestations were submitted on the operator's
standing instruction to import these two documents and to run the live path;
the operator is their author. On the material's own face, the anonymization
attestation does not appear to hold. This is recorded as a governance finding
for the operator, and it is independent of the POC result below.

## POC result: **FAIL**

The product did not produce a usable domain result from the evidence it was
given.

What worked, and worked well:

- Import integrity is exact. Canonical hashes matched, provenance was retained,
  and the parent PDF was never ingested.
- Source binding is exact. Every observation cites one line, every quote was
  verbatim, and the reviewer can see the cited line in its source context.
- Fail-closed behaviour held everywhere it was tested. An oversized document
  was refused, an invalid model response projected nothing, and the assessment
  refused before spending money rather than after.
- Cost became measurable. Both calls recorded provider, model and token usage,
  and the run's consumption is readable from recorded evidence.
- Case isolation, append-only review history and idempotent decision handling
  behaved correctly, including under ten duplicate submissions.

Why it is nonetheless a FAIL:

1. **Half the material could not enter the product at all.** source-A is 1,915
   pages and was refused outright. A product for investigation material that
   cannot ingest a 1,915-page investigation file has not demonstrated the
   capability the POC is meant to prove.
2. **No relations, so no domain result.** The relation call was paid for and
   returned, but its output failed strict schema validation and nothing was
   projected. This is the same `MODEL_INVALID_RESPONSE` class that ACME-0126
   recorded, on a different contract.
3. **No assessment.** Structurally blocked by the missing relations. The
   product's end deliverable was never produced.
4. **Empty timeline.** No observation carried a temporal bound, so the
   timeline — a core promised surface — is empty even though the source is
   dense with dates.
5. **The eight observations are fragmentary.** Because a quote must lie within
   one canonical line (ADR-0043) and PDF extraction yields lines of roughly 80
   to 136 characters, most sentences are cut at the line boundary. Four of the
   eight quotes end mid-clause and one was a bare section heading. From 100
   pages of forensic material the product surfaced eight single-line fragments
   and no synthesis.

The integrity machinery is sound. The evidence-production path is not yet
capable of turning a real investigation file into a usable, traceable domain
result. On the criterion set for this run — can the product carry a real
evidence workflow end to end — the answer from this run is no.

## Freeze boundary

This report is complete and frozen. The sealed external source has not been
opened. Post-freeze comparison is recorded separately and does not alter
anything above.
