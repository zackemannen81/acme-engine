# Current Task

Task ID: ACME-0190
Parent Task: None
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-19
Last updated: 2026-09-19
Charter frozen at: 2026-09-19; ACME-0190 claim verified merged to canonical `main` by operator

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

- [x] Focused `schema-lower` tests covering each accepted and refused proof
  category, nested schema positions and preservation of existing discriminator
  behavior.
- [x] Relevant OpenAI adapter unit/conformance tests.
- [x] `pnpm typecheck`.
- [x] `pnpm test:unit` and `pnpm test:conformance`.
- [x] `pnpm format:check`, `pnpm lint`, `pnpm boundaries` and `pnpm docs:check`.
- [x] `git diff --check`.
- [x] Confirm no live provider call, package publication or version change
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
- [x] Claim ACME-0190 and merge the claim to `main`.
- [x] Finalize and freeze this charter at `Ready` after the claim is merged.
- [x] Specify the bounded pairwise-disjointness rules and ADR impact.
- [x] Implement the lossless proof and lowering.
- [x] Add accepted/refused regression coverage.
- [x] Run all verification gates.
- [x] Update current documentation, journal and archive the completed task.

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

- Focused lowerer and gateway regressions: 64/64 passed.
- `pnpm typecheck` passed.
- `pnpm test:unit`: 161 files / 1090 tests passed.
- `pnpm test:conformance`: 13 files / 86 tests passed.
- `pnpm format:check`, `pnpm lint`, `pnpm boundaries`, `pnpm docs:check` and
  `git diff --check` passed. `docs:check` emitted 34 pre-existing, non-gating
  historical-path warnings.
- No live provider call, package publication, version change, tag or deployment
  occurred.

## Documentation Updates

- [x] `docs/adr/0015-strict-structured-output-schema-lowering.md` or a
  successor ADR for the expanded proof rule.
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/FILESTRUCTURE.md` only if the maintained package description changes (no structure change).
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: complete. The pairwise proof is bounded to distinct simple
  types (excluding `integer`/`number`), disjoint finite literal sets, and the
  existing object-discriminator rule.
- Next recommended step: none.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.
