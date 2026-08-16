# Current Task

Task ID: ACME-0133
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-08-16
Last updated: 2026-08-16
Charter frozen at: 2026-08-16

## Task Summary

Ran the POC #1 outcome-blind, closed-evidence acceptance of the Evidence
Integrity Workbench through the browser against one new case built from two
previously unused source documents.

## Result

**FAIL.** The frozen, immutable evaluation output is
[`docs/acceptance/ACME-0133-frozen-acceptance-report.md`](../acceptance/ACME-0133-frozen-acceptance-report.md)
and is the authoritative record of this task. It was frozen before any external
source was opened and has not been altered since.

Summary of the frozen findings:

- `source-A.pdf`, 1,915 pages and 3,521,477 canonical bytes, was refused at
  ingest with `REQUEST_BODY_TOO_LARGE`. It was not split, truncated or
  reclassified. Half the supplied material never entered the product.
- `source-B.pdf` imported cleanly with exact canonical hash agreement.
- One live observation call produced 8 source-bound observations, every quote
  verbatim against its cited line. Seven were accepted and one rejected as a
  bare section heading.
- The live relation call was paid for and returned, then failed semantic
  validation with two open questions citing rationale codes absent from the
  same output. The pipeline classified it `repairable: true`; nothing repaired
  it. Zero relations projected.
- The live assessment refused with `LIVE_ASSESSMENT_ACCEPTED_EVIDENCE_REQUIRED`
  and zero model calls, structurally blocked by the missing relations.
- 2 model calls, 2/2 reporting usage, 69,150 input and 2,329 output tokens.
  Provider-reported cost unknown; no call priced itself.
- The timeline was empty because no observation carried a temporal bound.

## Attribution of the failure

- **ACME core: passed.** Atomic commit, no partial projection on failure,
  idempotency under ten duplicate decisions, case isolation, exact hashes,
  encrypted payload, usage evidence and fail-closed refusal all held under real
  load. One real gap: `maxRepairCalls` is declared in the policy and in
  execution identity, the pipeline computes `repairable`, and the engine never
  consumes either. Repair is contract surface with no implementation.
- **Evidence domain contracts: this is where the failure lives.** The
  eight-candidate ceiling, the ADR-0038 ingest bounds, the single-line quote
  constraint and the assessment's relation precondition were each calibrated
  against the seven-artifact synthetic corpus.
- **Extraction pipeline: a real secondary problem, deliberately unowned.**
  ADR-0040 placed extraction outside ACME, so the product's quality ceiling is
  set by a step it neither owns nor evaluates.
- **The model: not the problem in this run.** It returned the contract maximum
  on observation and a single correctable cross-reference error on relation.

## Consequences

- ADR-0045 accepts that bounds are sized for the material, not the fixture.
- ACME-0134 implements ADR-0045 §2 to §4.
- ADR-0045 §5 (repair) and §6 (full-source coverage) are the next two tasks.

## Process note

This charter was overwritten in `docs/CURRENT_TASK.md` by the successor task
before being archived. It is reconstructed here from the frozen report and the
recorded run rather than from the original file. The frozen report itself was
never modified.

## Verification

- Every listed product surface was inspected and captured through the browser.
- The report was frozen before any external source was opened.
- The sealed external source was left unopened by operator decision; the
  post-freeze comparison was judged unnecessary given zero relations and no
  assessment to compare.

## Handoff and Follow-ups

- The `POC1 outcome-blind acceptance` case remains in the local PostgreSQL as
  recorded evidence of this run.
- Operator governance finding: the imported document is stamped `HEMLIG` and
  contains full personal names and a personal identity number in plain text,
  which is inconsistent with the Stage A anonymization attestation the import
  required. The operator authored those attestations.
- Source PDFs and the sealed source are ignored by Git and must stay out of the
  repository.
