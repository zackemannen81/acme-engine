# Current Task

Task ID: ACME-0190
Parent Task: None
Status: Draft
Owner: ChatGPT (operator)
Created: 2026-09-19
Last updated: 2026-09-19
Charter frozen at: pending ACME-0190 claim merge to `main`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0015-strict-structured-output-schema-lowering.md`
- `packages/adapter-model-openai/src/schema-lower.ts`
- `packages/adapter-model-openai/test/schema-lower.test.ts`

## Task Summary

MCP/JSON Schema legitimately expresses unions such as `boolean | string` with
`oneOf`. ACME currently lowers `oneOf` to the OpenAI strict-output-supported
`anyOf` only for object branches carrying distinct constant discriminators,
although some non-object branch pairs are also provably disjoint. Extend the
provider-adapter lowerer only where it can prove that replacing `oneOf` with
`anyOf` is lossless; preserve fail-closed refusal for every other union.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Support lossless lowering of `oneOf` to `anyOf` for a defined, conservative set
of provably pairwise-disjoint JSON Schema branches, so valid external MCP
schemas such as `boolean | string` do not fail solely because they lack an
object discriminator.

### Primary Deliverable

A deterministic OpenAI strict structured-output lowering rule, with regression
coverage and an ADR update or successor ADR, that converts a `oneOf` only after
proving every pair of branches cannot match the same JSON value.

### In Scope

- Establish the exact supported proof rules and their limits in the ADR
  record; retain ADR-0015's principle that an unproven rewrite is refused.
- Extend `packages/adapter-model-openai/src/schema-lower.ts` with a pure,
  deterministic, pairwise disjointness proof for the approved bounded forms.
- Support distinct JSON primitive categories where JSON Schema values cannot
  overlap (including `string | boolean`, `string | number`, `object | null`
  and `integer | string`).
- Support literal branches with distinct `const` values and finite enum
  branches whose literal value sets are pairwise non-overlapping, subject to
  the documented proof rules.
- Retain and cover the existing shared-property distinct-`const` object
  discriminator proof as a valid lossless case.
- Add focused lowerer regressions for accepted MCP-shaped primitive unions,
  nested positions and each refusal boundary.
- Update current technical/status documentation and record the completed work
  in the journal/archive.

### Out of Scope

- General JSON Schema satisfiability or arbitrary keyword interaction.
- Treating `integer` and `number` as disjoint; they overlap.
- Inferring disjointness from descriptions, examples, formats, patterns,
  ranges, object shape heuristics or unsupported keywords.
- Changing canonical `ModelRequest` identity, response validation, model
  contracts, or provider routing.
- Changes to core, MCP client/server behavior, Chat Completions or external
  provider calls.
- Package publication, version bumps, tags or deployment.

### Definition of Done

- A `oneOf` of `{ "type": "boolean" }` and `{ "type": "string" }` lowers to
  the equivalent `anyOf`, including when nested in an object property.
- Every accepted conversion is justified by an explicit, tested pairwise
  disjointness rule; the lowerer does not silently widen any unproven union.
- Distinct constants and non-overlapping finite enums lower only where their
  JSON value sets prove pairwise disjoint.
- Overlapping or unprovable cases — including `integer | number`, overlapping
  enums, and same-typed unconstrained branches — still fail locally with
  `UNSUPPORTED_CAPABILITY` before transport.
- Existing discriminated-object lowering remains behaviorally stable.
- ADR/current documentation describe the expanded proof boundary accurately.
- Focused tests, relevant adapter conformance/unit checks, typecheck, format,
  lint, boundaries, docs check and diff check pass.

### Minimum Verification Gates

- [ ] Focused `schema-lower` tests covering each accepted and refused proof
  category, nested schema positions and preservation of existing discriminator
  behavior.
- [ ] Relevant OpenAI adapter unit/conformance tests.
- [ ] `pnpm typecheck`.
- [ ] `pnpm test:unit` and `pnpm test:conformance`.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm boundaries` and `pnpm docs:check`.
- [ ] `git diff --check`.
- [ ] Confirm no live provider call, package publication or version change
  occurred.

## References

- `docs/adr/0015-strict-structured-output-schema-lowering.md`
- `packages/adapter-model-openai/src/schema-lower.ts`
- `packages/adapter-model-openai/test/schema-lower.test.ts`
- JSON Schema `oneOf` semantics: exactly one matching branch.
- OpenAI strict structured-output subset: `anyOf` accepted where `oneOf` is
  not.

## Checklist

- [x] Inspect current task, workflow, ADR-0015 and lowerer/test behavior.
- [x] Confirm the existing refusal of primitive `oneOf` despite disjoint types.
- [x] Supersede and archive the unrelated frozen ACME-0189 charter.
- [ ] Claim ACME-0190 and merge the claim to `main`.
- [ ] Finalize and freeze this charter at `Ready` after the claim is merged.
- [ ] Specify the bounded pairwise-disjointness rules and ADR impact.
- [ ] Implement the lossless proof and lowering.
- [ ] Add accepted/refused regression coverage.
- [ ] Run all verification gates.
- [ ] Update current documentation, journal and archive the completed task.

## Decisions and Notes

- `oneOf → anyOf` is valid only when no JSON value can validate against more
  than one branch. The proof must be structural and conservative.
- The lowerer is a provider-dialect adapter boundary; provider restrictions do
  not enter core or caller-owned JSON Schema.
- Distinct schema names or textual differences are not evidence of
  disjointness.
- The exact rule set must be limited to what tests and ADR wording can state
  precisely; anything outside it remains a typed preflight refusal.

## Charter Amendment Log

-none

## Verification

- Charter evidence: the current lowerer accepts only `discriminators(branches)`
  before converting `oneOf` to `anyOf`, and its current test explicitly expects
  `{ type: "string" } | { type: "number" }` to be refused.
- No implementation or live provider call has occurred.

## Documentation Updates

- [ ] `docs/adr/0015-strict-structured-output-schema-lowering.md` or a
  successor ADR for the expanded proof rule.
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md` only if the maintained package description changes.
- [ ] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: chartered as Draft; ID claim must be merged before it may move
  to `Ready` or implementation may begin.
- Next recommended step: reconcile the ACME-0190 claim against canonical
  `main`, then freeze the charter and define the exact disjointness algorithm.
- Blockers: no merged ACME-0190 ID claim yet.
- Child tasks: none.
- Resume condition: the ID claim has landed on `main`.
- Open questions: whether an additive ADR is preferred over a narrowly scoped
  amendment to ADR-0015; resolve before implementation.
