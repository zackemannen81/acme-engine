# ADR 0015 — Strict structured-output schema lowering

Status: Accepted

Date: 2026-08-01

Decision owners: ACME maintainers

## Context

ACME keeps provider-neutral contracts in core and modules. Prompt-contract
output schemas are emitted as canonical JSON Schema via `z.toJSONSchema` and
hashed under `acme-model-request-hash-1`. The OpenAI Responses adapter must
send that schema under `text.format` with `strict: true`.

ACME-0028 made two real calls. Both were rejected at provider schema
validation before token generation:

1. `oneOf` is not permitted (narrative discriminated union).
2. every key in `properties` must appear in `required` (no optional fields).

The adapter translated every other request field and passed the schema
verbatim. That is the same direction of leakage ACME already forbids in
reverse: provider vocabulary must not enter core, and core vocabulary must not
be assumed to be a provider dialect.

Strict structured output is retained. Milestone 1 fixes `maxRepairCalls: 0`, so
a schema-violating model response is terminal after tokens are spent.
Constrained decoding is what prevents that cost.

## Decision

### Lowering lives in the provider adapter

`@acme/adapter-model-openai` owns a pure, deterministic lowering from
canonical JSON Schema to the provider's strict structured-output subset:

- discriminated `oneOf` (distinct constant discriminators on a shared property)
  becomes nested `anyOf`
- every object property is required; a property that was optional becomes
  required-and-nullable
- `$schema` and similar metadata are stripped
- constructs that cannot be rewritten without changing meaning
  (`$ref`, plain non-discriminated `oneOf`, open `additionalProperties`, …)
  raise `UNSUPPORTED_CAPABILITY` at `calling-model` with `details` naming the
  construct and path, before any network call

Canonical request identity is unchanged: `acme-model-request-hash-1` still
digests the un-lowered `ModelRequest`. A second digest,
`providerWireSchemaHash` under algorithm
`acme-provider-wire-schema-hash-1`, records exactly the schema that left the
adapter and is attached to normalized response metadata.

### Output contracts express unknown as null

Rather than un-lowering provider nulls back to absent keys in the adapter,
output-facing reference-domain schemas use `.nullish()` for model-reported
unknowns. State, delta and memory schemas keep `.optional()`, because
`acme-cjson-1` distinguishes `null` from absent and identity must not shift.
Schemas shared by output and state paths are split. Modules drop `null` during
interpretation when the domain still wants absence in state.

### Plain unions are refused, not guessed

`oneOf` → `anyOf` is sound only under provable disjointness. Zod
`discriminatedUnion` guarantees distinct const discriminators;
`z.union` does not and must be refused.

## Alternatives Considered

### Turn off strict structured output

- Benefits: every existing contract works immediately; no schema rewrite.
- Costs: moves structure enforcement to post-hoc validation after tokens are
  spent; with no repair loop, a wrong shape is terminal.
- Reason not selected: constrained decoding is the load-bearing control for
  Milestone 1's single model call.

### Change domain contracts to emit provider-native schema

- Benefits: no adapter lowering.
- Costs: provider dialect becomes domain truth; a second provider would force
  another contract rewrite; request hashes couple to one vendor.
- Reason not selected: core/module neutrality is a fixed architecture
  guardrail.

### Adapter un-lowering of null → absent after the call

- Benefits: leave contracts on `.optional()`.
- Costs: makes a semantic rewrite part of what ACME claims the model said;
  the validated, hashed and replayed value would differ from the model output.
- Reason not selected: an explicit `.nullish()` contract is honest about the
  value that was produced.

## Consequences

### Positive

- Canonical contracts stay domain-owned; provider subset constraints stay in
  the adapter.
- Unlowerable schemas fail locally with a typed error and no spend.
- Live calls with both reference domains reached provider success under the
  lowered form, including nested `anyOf`.

### Negative

- Each new provider may need its own lowering and refusal table.
- Output schemas that must support strict providers adopt nullable unknowns,
  which forces schema splits where the same shape also appears on state paths.
- Some models reject parameters other than schema (e.g. `temperature`); that
  remains a composition-root / model-selection concern until a capability gate
  exists.

### Follow-ups

- A second provider adapter should either reuse a shared lowering port or
  document a distinct dialect; do not push dialect rules into core.
- Optional profile flags for model parameter subsets (temperature, etc.) if
  more reasoning models are used in live gates.

## Compatibility and Migration

No core identity algorithm changes. Contracts that adopted `.nullish()` on the
output path re-pinned only request-derived goldens. State and memory identity
keys are unchanged. Offline fixtures for the Responses body remain simplified
samples; the wire response schema is tolerant of unknown fields.
