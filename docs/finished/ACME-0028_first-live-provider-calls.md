# Current Task

Task ID: ACME-0028
Parent Task: None
Status: Complete
Owner: Claude
Created: 2026-07-31
Last updated: 2026-07-31
Charter frozen at: 2026-07-31

## Read First

- `AGENTS.md`, in particular Safety and External Effects
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `docs/backlog/encrypted-payload-retention.md`
- `docs/design/acme-design-and-development-spec.md` section 18.3
- `docs/finished/ACME-0025_openai-responses-provider-boundary.md`
- `packages/adapter-model-openai/src/`

## Task Summary

ACME has never made a real provider call. ACME-0025 built the entire OpenAI
Responses mapping behind an injected transport port and proved it offline, but
recorded the limitation plainly: the fixtures are hand-written from our
understanding of the wire format, not captured from a live call. They prove the
adapter is internally consistent, not that the understanding is correct.

This task supplies the one missing piece, a network transport, and spends a
small bounded amount of real money to find out whether that understanding
holds. Confirming or falsifying the fixtures is the point; the cost is the
price of the answer.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Determine whether ACME's hand-written understanding of the OpenAI Responses
wire format is correct, by making one bounded real call through the existing
`ModelGateway` and `ExecutionEngine`.

### Primary Deliverable

A `fetch`-based `ProviderTransport`, published from a separate entry point so
the default adapter surface stays network-free, plus an opt-in `pnpm test:live`
gate that performs one real call and reports what the provider actually
returned against what the fixtures claim.

### In Scope

- A `fetch`-based transport implementing `ProviderTransport`, mapping real
  network outcomes onto ADR-0014's `delivery` contract, including the honest
  `unknown` default when it cannot prove non-delivery.
- A separate package entry point for the transport, so importing the adapter
  does not pull in network-capable code.
- Structural exclusion of the live gate from `pnpm test` and CI. A live test
  must not be reachable from `test:unit`, which today matches every
  `tests/**/*.test.ts`.
- A `pnpm test:live` script that refuses to run without an explicit
  environment opt-in and an explicit budget, and that reads its credential
  only from the environment.
- One live execution of a real reference-domain contract through the real
  `ExecutionEngine`, with a policy that bounds the call count and output
  tokens. See the amendment log: the contract was `narrative.observe-document`
  when the charter was frozen and is `research.observe-evidence` after the
  first call.
- Comparison of the observed response against the committed fixtures: the
  live body must satisfy the same wire schema, and any field the fixtures got
  wrong must be reported rather than quietly accommodated.
- Confirmation that `retention: 'hash-only'` persists no payload and that
  `replayVerify()` reports `unavailable` for the live execution.
- Correction of the fixtures if the live call falsifies them, and a matching
  correction to ADR-0014's stated limitation.
- Documentation updates to `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`,
  `docs/FILESTRUCTURE.md` and `docs/JOURNAL.md`.

### Out of Scope

- Any credential in the repository, in a fixture, in a log, in the ledger or
  in a commit. The transport reads the environment; nothing else does.
- Adding the live gate to CI, or to any script CI runs.
- Retries, fallback, routing, streaming, hosted tools and cost optimization.
- Implementing encrypted retention. ADR-0014 mandates `hash-only` for live
  executions; closing that gap stays in `docs/backlog/`.
- Reconciling an ambiguous call against provider history.
- Changing the error taxonomy, `ModelGateway`, `ExecutionEngine` or the
  conformance suites to accommodate what the provider does. If the provider
  cannot be expressed through the existing contract, that is the finding, and
  it pauses this task rather than reshaping core.
- Any second provider, model comparison or quality evaluation.

### Definition of Done

- One real call completes through `ExecutionEngine` and commits, or fails with
  a classified ACME error that ADR-0014's table predicts.
- The live response body satisfies the committed wire schema, or the
  discrepancy is written down and the fixtures are corrected.
- The live gate cannot run without explicit opt-in, and cannot be reached from
  `pnpm test`, `pnpm test:unit` or any CI step, proven by running the default
  suite with no credential present.
- No credential appears in the repository, the ledger, the report or any test
  output.
- `replayVerify()` reports `unavailable` for the live execution and no payload
  is persisted, verified by inspecting the durable record.
- Actual spend is recorded in `docs/JOURNAL.md` against the budget.
- All frozen verification gates pass offline, or every skipped check is
  recorded with its reason.
- The task is archived under `docs/finished/` and `docs/CURRENT_TASK.md` is
  restored or repopulated.

### Minimum Verification Gates

- [x] `pnpm docs:check`
- [x] `pnpm format:check`
- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm boundaries`
- [x] `pnpm test:unit`
- [x] `pnpm test:conformance`
- [x] `pnpm test:integration`
- [x] `pnpm test:scenario`
- [x] `pnpm build`
- [x] `pnpm test` with no credential present, proving the live gate is not
      reachable
- [x] `git diff --check`

## References

- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `packages/adapter-model-openai/src/transport.ts`
- `packages/adapter-model-openai/src/wire.ts`
- `packages/adapter-model-openai/test/fixtures.ts`
- `vitest.config.ts` and the root `test` scripts

## Checklist

- [x] Read the required documents and ADR-0014's classification table.
- [x] Settle the open questions and freeze the charter.
- [x] Implement the `fetch` transport and its delivery classification.
- [x] Publish it from a separate entry point and prove the default surface
      stays network-free.
- [x] Exclude the live gate structurally and prove the default suite ignores
      it.
- [x] Implement the opt-in and budget refusal.
- [x] Make the first call against `narrative.observe-document`. It returned
      HTTP 400 `invalid_json_schema`, which ADR-0014's table predicted as
      `INVALID_REQUEST`.
- [x] Make the call against `research.observe-evidence`. It returned HTTP 400
      `invalid_json_schema` for a different rule than the first call.
- [x] Compare against the fixtures. The error-body schema is confirmed. The
      success-body schema was never reached, so it stays unconfirmed and is
      not corrected on speculation.
- [ ] Verify hash-only retention and unavailable replay. **Not done.** Both
      require a committed live execution, and no call reached a `200`. This
      transfers to the schema-lowering task.
- [x] Run every frozen verification gate and record evidence and spend.
- [x] Update the long-lived documentation and add the signed journal entry.
- [x] Archive ACME-0028 and restore or repopulate `docs/CURRENT_TASK.md`.

## Decisions and Notes

- A checkpoint before the first paid call is required. Everything that can be
  proven without spending must be proven first: the transport's delivery
  classification, the opt-in refusal and the structural exclusion.
- The default `test:unit` include matches every `tests/**/*.test.ts`, so a
  live test placed there would join the default suite. Exclusion must be
  structural, not a convention about which script to run.
- ADR-0014 is not reopened by this task. Its classification table, ambiguity
  rule and `hash-only` mandate are inputs. What this task may change is the
  ADR's recorded limitation about unconfirmed fixtures, once they are
  confirmed or corrected.
- A falsified fixture is a successful outcome, not a failure. It is the
  specific thing this task exists to discover, and discovering it cheaply is
  why the mapping was built offline first.
- Data handling: the live call sends a small synthetic fixture written for
  this purpose. No personal data, no repository content and no credential
  reaches the provider beyond the authorization header.
- Contract decision, 2026-07-31: the live call exercises the real
  `narrative.observe-document` contract rather than a throwaway one. It proves
  more of the stack in a single paid call: projection, request construction,
  the provider mapping, response normalization, the response pipeline, domain
  interpretation, memory, state and commit.
- Model decision, 2026-07-31: the call uses the model identifier
  `gpt-5.6-terra`, supplied by the account owner. I have not verified that this
  model exists or what it costs; the adapter passes the identifier through
  unchanged. If it is wrong the provider answers `400` or `404`, which
  ADR-0014 classifies as `INVALID_REQUEST` and which is itself a clean,
  informative outcome rather than an error in ACME.
- Budget decision, 2026-07-31: 30 SEK is the ceiling. It is a task-level stop
  rule enforced by the operator, not by the engine, and the charter says so
  rather than implying an automatic guard that does not exist. See the
  enforcement note below.
- Budget enforcement, 2026-07-31: `ExecutionPolicy.maxEstimatedCostMinor`
  only fires when a response reports `estimatedCostMinor`, and the OpenAI
  adapter never sets it because the Responses payload reports tokens rather
  than money. A currency ceiling is therefore not machine-enforceable today.
  What is enforceable is the Milestone 1 limit of exactly one model call per
  execution and an explicit `maxOutputTokens`. Those are the guards this task
  relies on; 30 SEK bounds the task, not a single request. Making cost
  machine-enforceable needs provider price data and belongs to its own task.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- 2026-07-31. The live call exercises `research.observe-evidence` instead of
  `narrative.observe-document`.

  Reason: the first live call was rejected with HTTP 400,
  `invalid_json_schema`, because the Narrative output schema compiles a
  `z.discriminatedUnion` to `oneOf` and OpenAI's strict structured-output
  subset does not permit it. The Research contract emits no `oneOf`, verified
  directly, so it can answer this task's actual question. Fixing the Narrative
  schema changes its request hash and would break pinned goldens in ACME-0018,
  the Narrative Phase 5 scenario and the scenario file digest, so it is a
  separate task and is recorded in `docs/backlog/`.

  The Goal and the Definition of Done are unchanged. Neither names a contract;
  both ask whether the hand-written understanding of the Responses wire format
  is correct. The contract is the means, and the first call proved the chosen
  means could not reach the success path.

## Verification

- [x] Prove the default suite passes with no credential present.
- [x] Prove the live gate refuses to run without explicit opt-in.
- [x] Prove the observed response satisfies the committed wire schema, or
      record exactly how it differed. The error body satisfies
      `OpenAiErrorBodySchema`. The success body was never observed.
- [ ] Prove no payload was persisted and replay reports `unavailable`.
      **Not done**, and not skippable by choice: no live execution committed,
      so neither code path ran.
- [x] Prove no credential appears in any committed file or recorded evidence.
- [x] Record actual token usage and the spend it implies against the 30 SEK
      ceiling, stating how the figure was obtained.
- [x] Record exact test counts for every gate.
- [x] Document skipped checks and reasons.

Verification completed on 2026-08-01:

- `pnpm docs:check` passed for 68 Markdown files after archival.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` and `pnpm build` passed.
- `pnpm boundaries` passed.
- `pnpm test:unit` passed 320 tests in 38 files, `pnpm test:conformance` 46 in
  7, `pnpm test:integration` 13 in 2 and `pnpm test:scenario` 19 in 3.
- The default suite cannot reach `tests/live`. It is excluded in
  `vitest.config.ts` rather than merely uncalled, so no CI step can reach it.
- The live gate refuses with an explicit message when `ACME_LIVE_TEST` or the
  credential is absent, rather than skipping quietly.
- `git diff --check` passed. No credential appears in any committed file.

### Definition of Done: what was and was not met

Met:

- A real call failed with a classified ACME error that ADR-0014's table
  predicted, twice, which the Definition of Done accepts as an outcome.
- The live gate is unreachable from `pnpm test`, `pnpm test:unit` and CI, and
  refuses without opt-in.
- No credential appears anywhere.
- Spend is recorded: two calls, both rejected before token generation, against
  a 30 SEK ceiling. Effectively zero.

Not met, and recorded as unmet rather than reinterpreted:

- The live response body was never observed on the success path, so
  `OpenAiResponseSchema` remains unconfirmed. The fixtures were not corrected,
  because correcting them without evidence would replace one unverified belief
  with another.
- `replayVerify()` was never exercised on a live execution and no live payload
  was ever written, so the `hash-only` behavior is unproven in practice.

Both unmet conditions require a live success response, which requires the
schema lowering. They transfer to that task, which needs the same evidence as
its own acceptance criterion and will use the gate this task built.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [ ] ADR-0014's limitation section. **Deliberately unchanged.** The
      limitation says the success-path fixtures are unconfirmed, and after two
      live calls that is still exactly true. Editing it now would overstate
      what was learned.

## Handoff and Follow-ups

- Current state: ACME-0028 is complete as a falsification. The transport, the
  opt-in gate and the structural exclusion are built and proven. Two live
  calls confirmed ADR-0014's failure classification and the provider
  error-body schema against real data, and falsified the assumption that
  ACME's contracts are usable with strict structured output. The success path
  remains unconfirmed and is recorded as such.
- Next recommended step: The provider schema lowering. It owns the live
  success response as its own acceptance criterion, using this task's gate,
  and it must prove nested `anyOf` against the provider rather than assume it.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None. The three were settled before the charter was
  frozen: the real `narrative.observe-document` contract, the model
  `gpt-5.6-terra`, and a 30 SEK operator-enforced ceiling.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
