# Current Task

Task ID: ACME-0029
Parent Task: None
Status: Draft
Owner: Claude
Created: 2026-08-01
Last updated: 2026-08-01
Charter frozen at:

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0010-input-bound-validation-and-interpretation.md`
- `docs/adr/0012-milestone-1-execution-identity-and-replay.md`
- `docs/adr/0014-live-provider-boundary-and-transport-port.md`
- `docs/backlog/strict-structured-output-schema-subset.md`
- `docs/finished/ACME-0028_first-live-provider-calls.md`

## Task Summary

A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

ACME-0028 made two real provider calls and neither reached a success response.
Both were rejected at schema validation, for two different reasons, and
together they exposed a defect narrower than either symptom: the adapter
translates every field of a model request except the one that most needs
translating. `buildResponsesBody` passes the canonical JSON Schema to the
provider verbatim.

ACME already forbids provider format from leaking into core. This task applies
the same rule in the other direction. The canonical Zod contracts stay the
domain's truth, and the adapter learns to lower them into the dialect the
provider accepts, refusing locally when it cannot do so without changing
meaning. Strict structured output is retained, not worked around: Milestone 1
fixes `maxRepairCalls: 0`, so a schema-violating response is terminal after
tokens are already spent, and constrained decoding is what prevents that.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Let ACME's existing canonical contracts reach a provider success response
under strict structured output, without changing domain semantics to suit a
provider.

### Primary Deliverable

A deterministic schema lowering in `@acme/adapter-model-openai` that
translates a canonical JSON Schema into the provider's strict structured-output
subset, refuses locally when a construct cannot be lowered without loss, and is
proven by a live success response.

### In Scope

- A lowering from canonical JSON Schema to the provider subset, covering at
  minimum the two rules ACME-0028 observed against real provider responses:
  every key in `properties` must appear in `required`, and `oneOf` is not
  permitted.
- Optional fields expressed as required-and-nullable.
- `oneOf` lowered to nested `anyOf` only when the branches are provably
  mutually exclusive. For `z.discriminatedUnion` that follows from distinct
  constant discriminators. A plain `z.union` must be refused, not guessed at.
- Empirical confirmation that the provider accepts the lowered form, including
  nested `anyOf`. ACME-0028's second call disproved an assumption of exactly
  this kind, so this task asks the provider rather than trusting a claim.
- A local preflight that rejects an unlowerable schema before any network call,
  with a typed error rather than a message.
- Un-lowering of the provider response, so a lowered `null` becomes the absent
  optional field the canonical contract expects, without violating ADR-0010's
  rule that core performs no parsed-value transformation and without doctoring
  the recorded model-call evidence.
- A `providerWireSchemaHash` recorded alongside the canonical
  `acme-model-request-hash-1`, so exactly what was sent stays reproducible
  while canonical contract identity is untouched.
- Determinism: the same canonical schema lowers to the same wire schema
  byte-for-byte, proven by test.
- A live success response through `pnpm test:live`, confirming
  `OpenAiResponseSchema`, the `hash-only` retention behavior and the
  `unavailable` replay verdict that ACME-0028 could not reach.
- Documentation updates, plus ADR-0014's limitation section once the
  success-path fixtures are confirmed or corrected.

### Out of Scope

- Turning off strict structured output. It moves enforcement to post-hoc
  validation, where a wrong structure costs tokens and, with no repair loop, is
  terminal.
- Changing the canonical Zod contracts to please a provider, which is the thing
  this task exists to avoid. The `.optional()` versus `.nullish()` question
  below is the one possible exception, and it is a domain question if it is
  raised at all.
- Changing `ExecutionEngine`, `ExecutionRepository`, the shared conformance
  suites or the reference domains to accommodate the provider.
- A repair or retry loop. Milestone 1 permits exactly one model call.
- A second provider, routing, caching or cost optimization.
- Re-pinning goldens for their own sake. If canonical identity moves, that is a
  finding to stop and examine, not a chore to work through.

### Definition of Done

- A live call using a real reference-domain contract reaches a provider success
  response through `pnpm test:live`.
- `OpenAiResponseSchema` is confirmed against that real response, or corrected
  to match it, with the difference recorded.
- The live execution commits, persists no payload under `hash-only`, and
  `replayVerify()` reports `unavailable`.
- An unlowerable schema is rejected locally with a typed error and no network
  call, proven by test.
- The lowering is deterministic, proven by test.
- `acme-model-request-hash-1` is unchanged for every existing contract, proven
  by the existing pinned goldens still passing untouched.
- Both reference domains still pass the unchanged shared conformance suites.
- No credential appears in any committed file, fixture, log, ledger or recorded
  evidence.
- All frozen verification gates pass, or every skipped check is recorded with
  its reason.

### Minimum Verification Gates

- [ ] `pnpm docs:check`
- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm boundaries`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:conformance`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:scenario`
- [ ] `pnpm build`
- [ ] `pnpm test:live` reaching a success response
- [ ] `git diff --check`

## References

- `docs/backlog/strict-structured-output-schema-subset.md`
- `packages/adapter-model-openai/src/request.ts`
- `packages/adapter-model-openai/src/wire.ts`
- `packages/adapter-model-openai/src/gateway.ts`
- `packages/core/src/model-request-hash.ts`
- `tests/live/openai-responses.test.ts`
- <https://community.openai.com/t/oneof-allof-usage-has-problems-with-strict-mode/966047/2>

## Checklist

- [ ] Read the required documents and ACME-0028's recorded evidence.
- [ ] Settle the two open questions below and freeze the charter.
- [ ] Implement the lowering and its determinism test.
- [ ] Implement the local preflight refusal.
- [ ] Prove the lowered form against the provider, including nested `anyOf`.
- [ ] Implement un-lowering per the decision taken.
- [ ] Record `providerWireSchemaHash` alongside the canonical hash.
- [ ] Reach a live success response and confirm or correct the fixtures.
- [ ] Verify hash-only retention and the `unavailable` replay verdict.
- [ ] Run every frozen verification gate and record evidence and spend.
- [ ] Update the long-lived documentation, ADR-0014 and the journal.
- [ ] Archive ACME-0029 and restore or repopulate `docs/CURRENT_TASK.md`.

## Decisions and Notes

- A checkpoint after each step or substep is required. Checklist is therefore
  updated along the work and `CURRENT_STATUS.md` is always updated when changes
  affect the behavior.
- A checkpoint before each paid call is also required. A rejected schema never
  reaches token generation, so probing the provider's subset costs close to
  nothing; spending begins only once the schema is accepted.
- The lowering belongs to the adapter, not to core and not to the modules. That
  is the same boundary ACME already enforces in the other direction, and the
  defect ACME-0028 found is precisely that the adapter skipped it.
- `oneOf` to `anyOf` is sound only under provable disjointness. If every branch
  fixes a distinct constant discriminator then at most one branch can match, so
  "at least one" and "exactly one" coincide. `z.discriminatedUnion` guarantees
  this by construction; `z.union` does not, and must be refused.
- `additionalProperties: false` needs no work. `z.toJSONSchema` already emits
  it, verified directly during ACME-0028.
- Do not assume the provider accepts nested `anyOf`. A claim about a provider's
  supported subset is exactly what the second live call disproved, and the same
  evidence standard applies here.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [ ] Prove the lowering is deterministic byte-for-byte.
- [ ] Prove an unlowerable schema is refused locally with no network call.
- [ ] Prove nested `anyOf` is accepted by the provider, empirically.
- [ ] Prove every existing `acme-model-request-hash-1` golden is unchanged.
- [ ] Prove the live execution commits, persists no payload and replays as
      `unavailable`.
- [ ] Record exact test counts for every gate, and actual spend.
- [ ] Document skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADR-0014's limitation section, once the success-path fixtures are
      confirmed or corrected.
- [ ] A new ADR if the lowering, its refusal contract or the second schema
      identity constrains future providers, which it probably does.

## Handoff and Follow-ups

- Current state: Charter drafted. The two questions below are design decisions
  worth settling explicitly before the charter is frozen.
- Next recommended step: Settle the questions, freeze, then build the lowering
  and probe the provider before spending anything.
- Blockers: The open questions below.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions:
  - Where un-lowering happens. Two existing rules collide. ADR-0010 says core
    performs no parsed-value transformation, so it cannot live in the response
    pipeline. `responseHash` covers the recorded model call, so if the adapter
    rewrites the model's text the evidence no longer matches what the provider
    sent, and replay would verify against a doctored payload. A third option
    avoids the transform entirely: let the canonical contracts use `.nullish()`
    rather than `.optional()`, making `null` domain-legal. That changes the
    canonical schemas, which this task otherwise refuses to do, but "absent or
    explicitly unknown" is arguably a more honest domain statement than
    "absent".
  - Which error a local refusal raises. `UNSUPPORTED_CAPABILITY` already exists
    and means the provider cannot express this, which fits and touches no core
    contract. A new `UNSUPPORTED_PROVIDER_SCHEMA` would be more precise but
    adds a code to the taxonomy in `packages/core`.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
