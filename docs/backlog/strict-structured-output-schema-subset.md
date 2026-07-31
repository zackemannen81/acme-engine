# Make prompt-contract output schemas satisfy the strict structured-output subset

## Discovery context

Found by the first two real provider calls in ACME-0028, not by any offline
test. Both were rejected before token generation, so both were effectively
free.

Call one, `narrative.observe-document`:

```text
HTTP 400 invalid_json_schema, param: text.format.schema
In context=('properties', 'observations', 'items'), 'oneOf' is not permitted.
```

Call two, `research.observe-evidence`, chosen because it emits no `oneOf`:

```text
HTTP 400 invalid_json_schema, param: text.format.schema
In context=('properties', 'claims', 'items'), 'required' is required to be
supplied and to be an array including every key in properties.
Missing 'evidenceQuote'.
```

The second call disproved the assumption behind switching contracts. Strict
mode enforces at least two independent rules, and avoiding one does not avoid
the other.

## What the strict subset rejects, measured

| Rule | `narrative.observe-document` | `research.observe-evidence` |
| --- | --- | --- |
| `oneOf` is not permitted | breaks it | satisfies it |
| every key in `properties` must appear in `required` | breaks it in 4 places | breaks it in 1 place |

The second rule means strict mode permits no optional fields at all. An
optional field must be expressed as required-and-nullable instead. Measured
violations:

```text
narrative.observe-document
  (root) optional: outlineProgress
  observations.items.oneOf.0 optional: correction
  observations.items.oneOf.0.properties.correction optional: sourceLocator
  scene optional: location, time

research.observe-evidence
  claims.items optional: evidenceQuote, sourceLocator
```

No ACME prompt contract currently satisfies the subset.

The account owner reports the `oneOf` limitation as previously observed and
supplied a community discussion of it:
<https://community.openai.com/t/oneof-allof-usage-has-problems-with-strict-mode/966047/2>.
That link is recorded as supplied context; the authoritative evidence for this
repository is the two 400s above.

## Why the offline work could not catch it

The deterministic mock asserts an exact request hash. It never validates the
JSON Schema it carries, because it is not a provider. Nothing offline has an
opinion about which JSON Schema constructs a provider accepts, so a contract
can be perfectly valid, perfectly hashed and still unusable.

This is the clearest evidence so far for why ADR-0014 recorded the fixtures as
unconfirmed. A self-consistent offline stack can be confidently wrong about the
outside world, and it took a real call costing nothing to find out.

## Proposed outcome

Two separable decisions.

**Does ACME use strict structured output at all?** The adapter sets
`strict: true` in `text.format`. `AGENTS.md` already holds that prompt outputs
are untrusted candidates until runtime and semantic validation pass, and the
response pipeline validates every output with Zod regardless. Strict mode is
therefore additional assurance rather than the thing ACME relies on. Turning it
off makes every existing contract usable immediately and changes no ACME
golden, because `buildResponsesBody` is adapter-internal. Keeping it on means
constraining every contract ACME will ever register.

**If strict stays on, the contracts must move into the subset.** That means
replacing discriminated unions and expressing every optional field as
required-and-nullable. It changes each contract's output schema and therefore
its request hash, which invalidates the ACME-0018 archived goldens, the
Narrative Phase 5 scenario and the committed scenario file digest.

Either way, a check belongs somewhere that fails before a billed call rather
than at one.

## Why this is outside the active task

ACME-0028 asks whether the hand-written Responses wire format is correct. This
is a different question: whether ACME's own contracts fit a provider's schema
subset, and whether ACME wants to be bound by it. It also changes either the
adapter's promise or two reference modules' public schemas, and cascades into
pinned identity evidence.

## Dependencies

- None to start. The evidence already exists.
- The strict-mode decision shapes everything else and should come first.

## Suggested verification

- a contract whose schema leaves the chosen subset is rejected before any
  network call
- a reworked contract produces the same interpreted result for existing
  fixtures, so only the schema and its hash change
- every pinned golden that moves is re-pinned deliberately and recorded, never
  silently regenerated
- a live call reaches a 200 and the success-path wire format is finally
  confirmed
