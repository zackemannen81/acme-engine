# Current Task

Task ID: ACME-0029
Parent Task: None
Status: Ready
Owner: Claude
Created: 2026-08-01
Last updated: 2026-08-01
Charter frozen at: 2026-08-01

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
  raising `UNSUPPORTED_CAPABILITY` with `details` naming the construct that was
  refused and where it appeared.
- A canonical contract change from `.optional()` to `.nullish()` on the
  output-facing schemas, so no un-lowering step is needed and the value that is
  validated, hashed, persisted and replayed is the value the model actually
  produced. Scoped so that only the model boundary moves: state, delta and
  memory schemas keep `.optional()`, because `acme-cjson-1` distinguishes
  `null` from absent and their identity must not shift.
- Splitting the two narrative schemas that are shared between the output path
  and the state path, so the output variant can be nullable without dragging
  `null` into deltas or memory values.
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
- Changing canonical domain semantics to please a provider. The `.nullish()`
  change is deliberately not an instance of this: it is adopted as a domain
  statement, that an output field is "absent or explicitly unknown", and it is
  kept off the state and memory schemas entirely.
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
- The pinned `acme-model-request-hash-1` values for the two changed contracts
  move exactly once, as a deliberate consequence of the `.nullish()` change,
  and each new value is re-pinned in the same commit that changes the schema so
  the movement is reviewable rather than incidental. The algorithm itself is
  untouched.
- `acme-operation-digest-1`, `acme-transition-id-1` and every memory identity
  key are unchanged, proven by their existing pinned goldens still passing
  untouched. If any of them moves, `null` has reached state and the scoping
  failed.
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
- [x] Settle the open questions and freeze the charter.
- [x] Split the two shared narrative schemas and apply `.nullish()` to the
      output-facing schemas only.
- [x] Re-pin the moved request-derived goldens in the same commit, and prove
      the state and memory goldens did not move.
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
- **Decided:** un-lowering is replaced by an explicit contract change to
  `.nullish()`. ADR-0012 does not forbid adapter normalization, but such a
  normalization would make a semantic un-lowering part of what ACME claims the
  model said. An explicit contract change is better than quietly dropping
  `null` in the adapter, because then the value that is validated, hashed,
  persisted and replayed is the same value the model actually produced.
- **Consequence of that decision, measured rather than assumed:** the affected
  optionals are not confined to the output path. In narrative,
  `NarrativeSceneSchema` and `NarrativeCorrectionEvidenceSchema` carry internal
  optionals and are reachable from both `NarrativeContractOutputSchema` and
  `NarrativeDeltaSchema` / `NarrativeCharacterFactMemoryValueSchema`. Making
  them nullable wholesale would let `null` into deltas and memory values, and
  since `acme-cjson-1` distinguishes `null` from absent, that would move
  `acme-operation-digest-1`, `acme-transition-id-1` and memory identity. The
  two schemas are therefore split into an output-facing nullable variant and an
  unchanged state-facing variant. Research needs no split:
  `ResearchContractClaimSchema` is reachable only from the output schema, and
  `ResearchClaimEvidenceSchema` is a separate declaration that merely repeats
  similar fields.
- The remaining output-only optionals are changed at the use site, where they
  affect nothing else: `NarrativeContractOutputSchema.outlineProgress`,
  `NarrativeCharacterFactObservationSchema.correction`, and
  `ResearchContractClaimSchema.evidenceQuote` and `.sourceLocator`.
- Where the domain still wants "unknown" not to reach state, the module drops
  it during interpretation. That is a domain rule applied in the domain layer,
  not a transport workaround in the adapter, and it is the module's existing
  job to turn a validated observation into a delta.
- **Measured on 2026-08-01, after the schema split.** The scenario tests pin
  six identities side by side, which made the tripwire readable directly.
  Moved: `modelRequestHash` and `requestFingerprint` in both domains, plus the
  narrative contract fingerprint. Unchanged: `executionId`,
  `modelResponseHash`, `operationDigest` and `stateHash` in both domains, and
  every memory identity key. `null` therefore never reached state, which is
  what the split was for.
- The narrowing is proven behaviorally, not just by the goldens standing
  still. Both domains now have a test asserting that an output reporting
  `null` and an output omitting the field produce an identical interpretation,
  and that the result contains no `null` anywhere. Research additionally
  asserts that a null-reported claim still trips `RESEARCH_DUPLICATE_CLAIM`
  against an omitted one, because claim identity folds `sourceLocator` into
  its preimage and the two forms must reduce to one.
- **Decided:** a local refusal raises the existing `UNSUPPORTED_CAPABILITY`.
  The condition is exactly what that code already means, the provider cannot
  express this, and adding a provider-specific code to the core taxonomy would
  pull provider vocabulary into the kernel, which is the same leakage this task
  exists to stop. `details` carries which construct was refused.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

- 2026-08-01, non-semantic. The Definition of Done says "the two changed
  contracts' pinned hashes". Seven pinned values actually moved, not two: a
  request hash and a contract fingerprint in the narrative contract test, a
  request hash in the research contract test, and a model-request hash plus a
  request fingerprint in each of the two scenario tests. The intent is
  unchanged and was met: every value that moved is derived from the request,
  and nothing derived from state moved. Only the count was wrong.

## Verification

- [ ] Prove the lowering is deterministic byte-for-byte.
- [ ] Prove an unlowerable schema is refused locally with no network call.
- [ ] Prove nested `anyOf` is accepted by the provider, empirically.
- [x] Prove the moved goldens moved once and only for the contracts whose
      output schema changed.
- [x] Prove no operation digest, transition id or memory identity key moved.
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

- Current state: Charter frozen as `Ready` on 2026-08-01. Both design questions
  are decided and recorded above. The canonical contracts now carry the
  `.nullish()` output shapes, the two shared narrative schemas are split, the
  narrowing is implemented in both modules and proven behaviorally, and the
  identity tripwire has been read: only request-derived values moved. The
  adapter is untouched, so the provider still receives the canonical schema
  verbatim and a live call would still be rejected.
- Next recommended step: Build the lowering and the preflight refusal, then
  probe the provider's subset, including nested `anyOf`, before spending
  anything. A rejected schema never reaches token generation.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: None.

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
