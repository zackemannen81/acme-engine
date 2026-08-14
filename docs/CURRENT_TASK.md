# Current Task

Task ID: ACME-0102
Parent Task: None
Status: Ready
Owner: unassigned
Created: 2026-08-14
Last updated: 2026-08-14
Charter frozen at: 2026-08-14

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/adr/0023-live-evaluation-gate.md` — the existing live gate to extend
- `docs/adr/0016-encrypted-payload-retention.md` — retention choices
- `docs/adr/0035-evidence-authenticated-principal-and-authorization.md`
- `docs/adr/0037-evidence-secure-artifact-foundation.md`
- `docs/backlog/slice-9-prerequisite-checklist.md`

## Task Summary

Decide, as an ADR, how the Evidence Integrity Workbench may call a live model
provider. Today the product composes `createScriptedModelGateway` only, with
responses pinned to exact request hashes of the seven fixed synthetic
artifacts, and `POST /api/text-imports` runs no model at all. Any document
outside the sealed corpus therefore produces zero observations, which makes the
entire analysis path unreachable for new material — synthetic or otherwise.

This is a decision task. The implementation follows as a separate frozen task.

**This charter does not touch the data policy.** Live model and non-synthetic
data are independent gates. Everything here stays `synthetic-only`; Slice 9 is
untouched and cannot activate by implication.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

One accepted ADR that fixes how, and under what gate, budget, credential
handling, retention and audit the product may perform live model calls —
without widening data authority.

### Primary Deliverable

`docs/adr/00NN-evidence-workbench-live-model-boundary.md`, accepted, indexed,
and with its consequences and required implementation gates written down.

### In Scope

- Gateway selection in the product composition: scripted mock stays the
  default; live is opt-in and never reachable by accident.
- A new versioned `evidence-live-confirmation/1` for the product surface,
  binding `caseId` and omitting any caller-supplied actor, with ADR-0023's pure
  primitives shared rather than duplicated.
- Credential handling: environment only, never from a browser payload, command
  body, confirmation document or stored record.
- Budget expressed per confirmed run and hard-capped by a deployment maximum:
  where each is enforced, what happens when either is exceeded mid-run, and who
  may raise them.
- `encrypted-payload` retention for product live executions under ADR-0016,
  including the hosted durable-key consequence and the Slice 9 revisit.
- Audit: which live-call events are recorded, with what content-free fields,
  in the existing security-audit vocabulary.
- Failure semantics: provider errors, timeouts and partial runs inside the
  existing job/progress/cancel path.
- All three evidence tasks permitted live in the first increment
  (`observe-artifact`, `relate-observations`, `propose-assessment`).
- The refusal matrix the implementation must prove.

### Out of Scope

- Any non-synthetic data class. Slice 9 stays closed and this ADR must say so.
- Real preliminary-investigation material of any kind.
- Measuring model output against known real-world case outcomes. That is a
  separate evaluation charter — see Decisions and Notes.
- New task types, PDF/DOCX/OCR/media, and any change to the fixed corpus.
- Changing the mock default, the Primary Product Rule, source-binding
  invariants or the L5 prohibition.
- Implementation. This task produces a decision, not code.

### Definition of Done

- The ADR is accepted and indexed, and states its own consequences.
- It fixes gate, credentials, budget, retention, audit, failure semantics and
  the permitted task set, each unambiguously enough to test.
- It states explicitly that it grants no data authority and that Slice 9 is
  unaffected.
- It names the executable gates the implementation task must pass.
- Documentation-only: no behavior, contract or dependency changes.

### Minimum Verification Gates

- [ ] Markdown link and fence checks (`pnpm docs:check`).
- [ ] `git diff --check`.
- [ ] ADR indexed in `docs/adr/README.md` and referenced from `SYSTEMDOC.md`.
- [ ] No code, schema or dependency change in the diff.

## References

- `apps/evidence-workbench-api/src/local.ts` — `fixtureGateway`, the only
  gateway the product composes today.
- `apps/test-ui/src/live-gate.ts` — `acme-live-confirmation/1`, typed refusal
  reasons, forbidden credential keys, budget assertion. The pattern to extend.
- `apps/test-ui/src/local/live-launch.ts` — how process opt-in, confirmation
  and environment credentials combine before a gateway is built.
- `packages/adapter-model-openai` — `createOpenAiResponsesGateway` and the
  `fetch` transport, already proven live.
- `tests/integration/scenario-live-offline.test.ts` — the injected-transport
  pattern that proves live wiring without a provider.
- Technical specification, deferred decisions: "Live model and budget |
  Deferred to a gated slice; mocks remain default."

## Checklist

- [x] Confirm the goal, scope and gates below, then freeze the charter.
- [ ] Survey the existing live gate and record what transfers unchanged.
- [ ] Specify `evidence-live-confirmation/1` and the shared pure primitives.
- [ ] Specify credential, budget, retention, audit and failure semantics.
- [ ] Write the refusal matrix the implementation must prove.
- [ ] Draft, index and cross-reference the ADR.
- [ ] Run documentation verification.
- [ ] Synchronize docs and journal; archive.

## Decisions and Notes

- A checkpoint after each step or substep is required, and `CURRENT_STATUS.md`
  is updated when changes affect behavior.
- **Why an ADR rather than straight implementation.** `AGENTS.md` requires an
  ADR for decisions constraining multiple packages, public contracts,
  persistence, compatibility or security. This constrains all five, and the
  technical specification already lists live model and budget as a deferred
  decision. The repository has settled this shape four times — ACME-0090/0091,
  0092/0093, 0094/0095, 0096/0097 — decision first, implementation second.
- **Live model and real data are independent.** Running live against the
  synthetic corpus is valuable on its own: it proves the extraction path works
  against a real provider rather than canned fixtures, and it is the honest
  prerequisite for anything later. Nothing here needs Slice 9.
- **On measuring against real outcomes.** The strongest argument for real
  material is measurability: a contradiction the workbench surfaces that a real
  case actually turned on demonstrates value directly, and cases dismissed for
  lack of intent on the strength of witness testimony are exactly where an
  evidence-integrity tool should show its worth. That argument is sound, and it
  is a *third* task, not this one. The machinery already exists — `@acme/
  evaluation` provides immutable post-execution assessments with versioned
  scores, findings and verdicts; ScenarioRunner v2 runs and asserts them
  offline; the quality store persists them; `acme quality list|inspect|judge`
  reads them. What is missing is the evaluator definitions and the ground-truth
  encoding, not the harness. Chartering that separately keeps the measurement
  design honest and stops it from smuggling a data-class decision into a
  gateway decision.
- **Sequencing.** This ADR and its implementation are independent of the Slice 9
  legal track and can run in parallel with it. They are not independent of the
  operational debt in the Slice 9 checklist section D5.

### Answers to the four pre-freeze questions

Settled before freezing, at the owner's instruction, with reasoning recorded so
the ADR can argue against them rather than inherit them silently.

- **A new versioned product confirmation, `evidence-live-confirmation/1`, not
  `acme-live-confirmation/1` unchanged.** Reuse would quietly weaken two
  implemented boundaries. ADR-0023's document carries a free-text `confirmer`,
  and ADR-0035 exists precisely so that a browser payload cannot choose the
  actor — the principal must stay server-derived, so the field is dropped
  rather than trusted. Its `caseCount` also means "test-plan cases", which
  collides with the product's `caseId`; carrying that name into a case-first
  product is an ambiguity trap. The new document binds `caseId` explicitly, so
  a live authorization cannot escape the ADR-0036 case boundary. The *pure
  primitives* are shared, not duplicated: the forbidden-credential-key scan,
  the budget assertion and the typed refusal reasons move to a common place and
  both surfaces use them.
- **Budget per confirmed run, hard-capped by a deployment maximum.** The
  confirmation declares `maxModelCalls` and `costCeilingMinor` for one run;
  configuration supplies an absolute maximum that a confirmation may not
  exceed, and a confirmation exceeding it is refused before the first call. Two
  ceilings because one is not enough: the run ceiling makes intent explicit and
  auditable, the deployment ceiling means a careless confirmation cannot drain
  the account. Cumulative per-principal accounting was considered and rejected
  for the first increment — it needs durable accumulation, a reset window and
  contention handling, which is a persistence design rather than a gateway
  decision. It is a named follow-up, and case binding already gives attribution
  in the meantime.
- **`encrypted-payload` retention for product live executions.** `hash-only`
  would degrade `replayVerify` to `unavailable` and forfeit ADR-0017 resume —
  an interrupted execution would have to call the provider again, which costs
  money and breaks a proof the product already asserts in its own blackbox
  test. Both matter more with a live provider than with a mock. The cost is
  that payloads become durable records, which is acceptable while everything is
  `synthetic-only` and is exactly what `PayloadEncryptor` and ADR-0037 exist
  for. Two consequences the ADR must state: the choice is revisited per data
  class at Slice 9, and the local composition's ephemeral key
  (`keyId: 'ephemeral-local-session'`, regenerated per process) means a hosted
  deployment needs a durable key or it silently loses replay after restart.
- **All three evidence tasks may run live in the first increment.** Restricting
  to `observe-artifact` would buy no safety, because the trust pipeline is
  gateway-independent: prompt output is an untrusted candidate whichever
  gateway produced it, and the same runtime and semantic validation, the same
  prohibited-authority refusals and the same source-binding gates run before
  anything becomes canonical. What a narrow task set would cost is the whole
  point of the boundary — observations alone give no relations, no timeline and
  no assessment, so nothing beyond extraction could be demonstrated on new
  material. The real risk that changes with a live provider is cost, and that
  is what the budget handles.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- none

## Verification

- [ ] `pnpm docs:check`
- [ ] `git diff --check`
- [ ] Confirm the diff contains no `.ts`, schema or `package.json` change.

## Documentation Updates

- [ ] `docs/adr/` — the new ADR
- [ ] `docs/adr/README.md` — index entry
- [ ] `docs/SYSTEMDOC.md` — decided boundary
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/JOURNAL.md`
- [ ] Technical specification deferred-decision table — mark decided

## Handoff and Follow-ups

- Current state: draft. Stages 1–8 of the product completion plan are
  delivered; ACME-0101 repaired the browser shell parse failure.
- Successor task, to be chartered separately once this ADR is accepted:
  implement the live boundary in the product composition. Expected shape —
  gateway selection with mock default; the confirmation gate applied at the
  product surface; environment-only credentials; budget enforced before the
  first call and between calls; live executions running through the existing
  job worker with progress and cooperative cancel; content-free audit per live
  call; an offline injected-transport proof plus a refusal matrix; and one
  opt-in test under `tests/live/` excluded from default CI.
- Second successor, separately chartered: model-quality evaluation against
  encoded ground truth, on `@acme/evaluation`.
- Blockers: none for this decision task.
- Open questions: none outstanding. The four pre-freeze questions were settled
  at the owner's instruction and are recorded with their reasoning under
  Decisions and Notes. The ADR may argue against any of them, but must do so
  explicitly rather than by omission.
- Named follow-up, not in this charter: cumulative per-principal budget
  accounting across runs.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Populate `docs/CURRENT_TASK.md` with the implementation task or the template.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
