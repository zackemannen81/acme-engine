# ADR 0009 — Reference-domain identity and provenance

Status: Accepted

Date: 2026-07-30

Decision owners: ACME maintainers

## Context

The Narrative and Research reference modules cannot implement their approved
memory policies from the illustrative v1 contracts without hidden authority:

- Narrative has no authoritative alias map and no correction evidence that a
  pure policy can verify before superseding an existing fact.
- Research has only claim text, even though corroboration needs stable
  proposition identity and contradiction polarity.
- Different documents or URIs do not prove source independence.
- Core `ProvenanceRef` links executions, contracts, model calls and document
  keys, but intentionally does not own domain meanings such as publisher,
  locator, quotation or editorial independence.

The missing fields must be fixed before either immutable `@1.0.0` prompt
contract is implemented. Identity cannot depend on a second model call, store
lookup, current time, locale, mutable public-suffix data or undocumented fuzzy
matching.

## Decision

### Shared identity rules

Every algorithm in this ADR:

1. validates its domain input before normalization;
2. creates the exact canonical object shown below;
3. serializes it with `acme-cjson-1`;
4. hashes the UTF-8 serialization with SHA-256; and
5. prepends the declared serialized prefix.

Text normalization is `reference-text-normalization-1`:

1. apply Unicode NFKC;
2. trim leading and trailing Unicode whitespace;
3. replace each internal run of Unicode whitespace with one ASCII space; and
4. apply locale-independent Unicode lowercase as implemented by the pinned
   Node 24 runtime.

Punctuation, diacritics and word order are preserved. An empty result is
invalid. Changing any step requires a new algorithm identifier. These
algorithms establish deterministic equality only; they do not claim general
natural-language semantic equivalence.

### Narrative alias authority

Canonical `NarrativeState` is the only authority for aliases. It contains:

```ts
interface NarrativeCharacter {
  displayName: string;
  attributes: Record<string, string>;
}

interface NarrativeState {
  characters: Record<string, NarrativeCharacter>;
  entityAliases: Record<string, string>;
  // relationships, worldRules, scene, narrativeWindow and outlineProgress
}
```

Each `entityAliases` key is a value normalized with
`reference-text-normalization-1`; its value is a Narrative entity key.
Every character's display name must have an alias entry pointing to its own
key. Two entity keys may not own the same normalized alias. The reducer and
invariants own those checks.

`narrative-entity-key-1` derives an entity key from the first accepted label
when no authoritative alias exists:

```json
{"algorithm":"narrative-entity-key-1","normalizedLabel":"<normalized label>"}
```

The serialized form is `narrative_entity_<sha256>`.

`project()` supplies only the relevant alias projection to the prompt
contract. Contract output may refer to labels, but it cannot declare alias
authority. `interpret()` resolves each label through the state alias map or
derives a new entity key. A memory candidate retains the observed label and
resolved entity key. `projectState()` may add the exact observed normalized
label after an applied create/merge/reinforce decision; ignored or rejected
candidates cannot modify aliases.

No module configuration, prompt output, memory record or repository adapter
contains a competing authoritative alias map. A future manual alias-merge or
rename operation requires its own task contract and reducer rules.

### Narrative correction evidence

Only a `character-fact` observation may request v1 supersession:

```ts
interface NarrativeCorrectionEvidence {
  targetIdentityKey: string;
  supersedesValue: string;
  evidenceQuote: string;
  sourceLocator?: string;
}
```

The correction object belongs to `NarrativeContractOutput`. The contract
input exposes sanitized relevant fact summaries with their identity keys and
current values, never complete repository records. The interpreted candidate
value retains the complete correction object plus its observed label,
resolved entity key and this interpretation-owned evidence shape:

```ts
interface NarrativeValidatedCorrectionEvidence
  extends NarrativeCorrectionEvidence {
  documentKey: string;
  correctionEvidenceValidated: true;
}
```

`correctionEvidenceValidated` is created only by deterministic interpretation
after input-bound contract semantics check the quote and interpretation binds
the original validated task input; it is not a prompt-output field. Generic
`ProvenanceRef.documentKeys` supplies the same source document link.

A pure Narrative policy may return `supersede-existing` only when all of the
following hold:

- the candidate's derived identity equals `targetIdentityKey`;
- an active or contested record with that identity contains the exact
  `supersedesValue`;
- `evidenceQuote` is non-empty and is an exact code-point substring of the
  supplied source document retained by the candidate's document key;
- the optional locator is non-empty when present; and
- the candidate otherwise passes schema and semantic validation.

Because `DomainMemoryPolicy.resolve()` does not receive documents,
input-bound contract semantics check the exact quote against projected
contract input. `interpret(output, input, context)` then binds the validated
output to the original validated task document and retains the explicit flag
in the candidate value. The policy must require that flag and recheck the
identity and prior value against its immutable working set. Missing or failed
evidence may produce `contest` or `reject-candidate`, never supersession.

The quote and locator are domain evidence. They do not replace generic core
provenance, and core does not interpret them.

### Research source input and identity

The v1 task input makes the caller's independence assertion explicit:

```ts
type ResearchIndependenceBasis =
  | "publisher"
  | "editorial-group"
  | "origin"
  | "fixture";

interface ResearchSourceInput {
  uri: string;
  title?: string;
  retrievedAt: string;
  publisher?: string;
  independence: {
    authority: string;
    basis: ResearchIndependenceBasis;
  };
}
```

The module accepts absolute HTTP(S) URIs without credentials. URI
normalization uses the pinned Node 24 WHATWG `URL` implementation: lowercase
scheme and host, remove the fragment, remove the default port, preserve the
serialized path and query, and serialize an empty path as `/`. Query
parameters are not reordered or removed.

`research-source-key-1` identifies the exact normalized source URI:

```json
{"algorithm":"research-source-key-1","normalizedUri":"<normalized URI>"}
```

The serialized form is `research_source_<sha256>`.

`research-source-independence-key-1` identifies the declared editorial
authority group:

```json
{"algorithm":"research-source-independence-key-1","authority":"<normalized authority>","basis":"<basis>"}
```

The serialized form is `research_independence_<sha256>`.

`authority` uses `reference-text-normalization-1`. The caller owns the
assertion; the module validates, records and applies it but does not infer
corporate relationships. Publisher and URI remain evidence. They do not
override the declared authority. A different document key, URI or publisher
label alone never increments the independent-source count. Only a distinct
validated independence key does.

### Research proposition identity and polarity

Every v1 contract claim has this shape:

```ts
interface ResearchContractClaim {
  proposition: string;
  statement: string;
  position: "supports" | "contradicts";
  evidenceQuote?: string;
  sourceLocator?: string;
  confidence: number;
}
```

`proposition` is the contract's context-complete canonical proposition being
evaluated. `statement` preserves the source-specific extracted assertion for
display and audit. `position` states how that evidence bears on the
proposition. Supporting and contradicting evidence therefore target the same
identity without fuzzy matching or a second model call.

`research-proposition-key-1` uses:

```json
{"algorithm":"research-proposition-key-1","normalizedProposition":"<normalized proposition>"}
```

The serialized form is `research_proposition_<sha256>`.

The prompt contract must require stable canonical propositions. Semantic
validation rejects empty fields, duplicate
`(proposition key, position, statement, locator)` entries, invalid confidence,
locators without the supplied source and configured exact quotes not present
in the evidence text. If two outputs do not produce the same normalized
proposition, v1 treats them as distinct; the pure memory policy must not guess
semantic equivalence.

### Research retained evidence

Every `research.claim` candidate and resulting record retains this
domain-owned evidence:

```ts
interface ResearchClaimEvidence {
  sourceKey: string;
  independenceKey: string;
  documentKey: string;
  uri: string;
  retrievedAt: string;
  publisher?: string;
  sourceLocator?: string;
  evidenceQuote?: string;
}

interface ResearchClaimValue {
  propositionKey: string;
  proposition: string;
  statement: string;
  position: "supports" | "contradicts";
  evidence: ResearchClaimEvidence[];
}
```

Each candidate begins with exactly one evidence entry. Merge and reinforce
results preserve all distinct evidence entries in stable `independenceKey`,
`sourceKey`, `documentKey`, locator, quote order.
Corroboration counts distinct independence keys, not evidence rows. Duplicate
evidence from one key remains auditable but does not increase the count.

Research state summaries reference the memory evidence that justified them:

```ts
interface ResearchVerifiedClaim {
  identityKey: string;
  statement: string;
  independentSourceCount: number;
  memoryIds: string[];
}

interface ResearchContestedClaim {
  identityKey: string;
  variants: string[];
  memoryIds: string[];
}
```

`memoryIds` are unique and stably sorted. They are produced only by
post-memory `projectState()` from applied decisions. This lets audit traverse
state → memory values → domain evidence and state → memory provenance → core
execution/contract/document evidence. State does not duplicate URI, quote or
publisher fields.

### Schema placement

| Field | Authoritative boundary |
| --- | --- |
| Narrative alias map | canonical `NarrativeState.entityAliases` |
| Narrative observed label/resolved entity key | memory candidate/record value |
| Narrative correction target/value/quote/locator | contract output, then retained candidate/record value |
| Narrative quote validation result | interpreted candidate value |
| Research independence assertion | task input and projected contract input |
| Research source/proposition/independence keys | deterministically derived candidate/record value |
| Research proposition/statement/position | contract output, then candidate/record value |
| Research URI/publisher/retrieved time/locator/quote | task input plus contract output as applicable, then candidate/record evidence |
| Generic execution/contract/model-call/document trace | core `ProvenanceRef` |
| Research state-to-evidence link | state `memoryIds` produced after applied memory decisions |

No field in this table is made canonical directly from model output. Contract
schema and semantic validation, interpretation, memory policy, state
projection, StateEngine validation and the aggregate commit still apply.

### Golden vectors

The following inputs use the shared procedure above:

| Algorithm | Canonical `acme-cjson-1` preimage | Serialized output |
| --- | --- | --- |
| `narrative-entity-key-1` | `{"algorithm":"narrative-entity-key-1","normalizedLabel":"dr. mira vale"}` | `narrative_entity_e9c378a3081e2771f6c2653fed130d1f437bba404ad0988376acf81a498fd253` |
| `research-proposition-key-1` | `{"algorithm":"research-proposition-key-1","normalizedProposition":"water boils at 100 °c at standard atmospheric pressure."}` | `research_proposition_69ac03ae1accb381bf9b9478aebe6c8ac76969657b42b970b0849c7c287e0e71` |
| `research-source-key-1` | `{"algorithm":"research-source-key-1","normalizedUri":"https://example.com/evidence?id=42"}` | `research_source_a2b68eead8f666873382d7406331c2f9cbf88caf4fb6a1a3528bd7692a08837d` |
| `research-source-independence-key-1` | `{"algorithm":"research-source-independence-key-1","authority":"example research consortium","basis":"publisher"}` | `research_independence_1f76b6d23335fec11b0efe3680612ae44e3cab1e831c781e8925fb4c140aa263` |

## Alternatives Considered

### Let the model emit authoritative IDs and aliases

- Benefits: fewer domain transforms.
- Costs: unstable, untrusted output would become identity authority.
- Reason not selected: model output must never become canonical directly.

### Fuzzy-match aliases and claims inside the memory policy

- Benefits: handles more natural-language variation.
- Costs: results depend on hidden heuristics or a model call and are difficult
  to replay or migrate.
- Reason not selected: v1 requires explicit deterministic equality.

### Infer source independence from URI or publisher text

- Benefits: smaller task input.
- Costs: domains, mirrors, syndication and corporate ownership make the
  inference unreliable; public-suffix and ownership data change.
- Reason not selected: independence is an explicit caller assertion and audit
  fact, not a URL property.

### Put all evidence in core `ProvenanceRef`

- Benefits: one generic evidence shape.
- Costs: core would acquire source, publisher, quote, locator and independence
  semantics belonging only to Research/Narrative.
- Reason not selected: core owns mechanics and links; modules own meaning.

### Duplicate complete evidence in state

- Benefits: state is self-contained for display.
- Costs: evidence updates and provenance would have multiple canonical copies.
- Reason not selected: state references memory IDs and audit follows the
  retained records.

## Consequences

### Positive

- Both pure memory policies receive every identity and evidence fact they
  require without effects or hidden lookups.
- Alias, proposition, source and independence identities are replayable and
  golden-testable.
- Contradiction and correction remain explicit and auditable.
- Same-source duplicates cannot masquerade as independent corroboration.
- Core remains free of Narrative and Research vocabulary.

### Negative

- Callers must make and retain an explicit Research independence assertion.
- v1 proposition equality is intentionally conservative and misses semantic
  paraphrases unless the contract emits the same canonical proposition.
- Narrative alias merges need a future explicit domain task.
- Prompt inputs expose sanitized current Narrative fact identity/value
  summaries so correction targets can be checked.
- Persisted domain values are richer than generic core provenance.

## Compatibility and Migration

No reference module, immutable v1 prompt contract or persisted
reference-domain data exists. These changes therefore correct the
pre-implementation baseline without migration.

The four algorithm identifiers and `reference-text-normalization-1` are
immutable. Any normalization, URI handling, prefix or canonical-object change
requires a new identifier, ADR and compatibility path. Prompt contract output
changes after `@1.0.0` require a new contract version. State or memory schema
changes require new explicit domain schema versions; old keys and evidence
are never silently rewritten.

## Follow-ups

- The reusable DomainModule conformance kit must expose fixtures that verify
  stable identity, immutable evidence and post-memory state references without
  encoding either domain's policy.
- NarrativeModule must unit-test unknown labels, existing aliases, alias
  collision, correction acceptance and every correction rejection condition.
- ResearchModule must unit-test URI normalization, same-authority duplicates,
  distinct-authority corroboration, proposition polarity, distinct
  propositions and stable evidence ordering.
- Reference-module implementations must include the golden vectors above.

## References

- [ACME specification, NarrativeModule](../design/acme-design-and-development-spec.md#16-reference-vertical-slice-narrativemodule)
- [ACME specification, ResearchModule](../design/acme-design-and-development-spec.md#17-reference-vertical-slice-researchmodule)
- [ADR 0002 — Static task-typed module composition](0002-static-task-typed-module-composition.md)
- [ADR 0005 — Pure memory decision application](0005-pure-memory-decision-application.md)
- [ADR 0008 — Post-memory domain state projection](0008-post-memory-domain-state-projection.md)
- [ADR 0010 — Input-bound validation and interpretation](0010-input-bound-validation-and-interpretation.md)
- [ACME-0012 task charter](../finished/ACME-0012_reference-domain-identity-and-provenance.md)
