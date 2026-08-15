# ADR-0042: Runtime-derived observation locators

Status: Accepted

Date: 2026-08-15

## Context

ACME-0113 proved two separate facts against the authorized Stage A source.
Active `evidence.observe-artifact@1.2.0` solved the prior output truncation: the
provider returned a complete strict-JSON batch of six candidates. Every
`exactQuote` occurred verbatim in canonical source text. The same candidates'
model-authored `startLine` and `endLine` values were nevertheless offset, so
the semantic pipeline correctly refused all six and committed nothing.

Line locators are canonical provenance. Asking the model both to select a
verbatim passage and to count its line positions gives an untrusted candidate
authority over data that runtime can derive exactly. Prompt reinforcement does
not turn probabilistic line counting into canonical evidence.

Historical observation contracts `@1.0.0`, `@1.1.0` and `@1.2.0` have retained
request and response evidence. They cannot be edited without breaking replay.

## Decision

1. Active `evidence.observe-artifact@1.3.0` uses output schema
   `evidence-observe-artifact-output/2`. Model candidates contain an exact quote
   and domain candidate fields, but no `startLine` or `endLine`.
2. Runtime performs an ordinal search over canonical LF/NFC source text. A
   quote is valid only when it occurs exactly once in the entire supplied
   artifact version.
3. For one occurrence, runtime derives `startLine` from the number of preceding
   LF delimiters and `endLine` from the LF delimiters inside the exact quote.
   These derived values alone enter locator identity, observation identity,
   invariant checks, state and product projection.
4. An absent quote and a multiply occurring quote fail semantic validation.
   There is no fuzzy, whitespace-normalized, punctuation-normalized or
   best-match fallback.
5. Output `/1` and contract versions `@1.0.0`–`@1.2.0` remain registered and
   byte-identical for historical replay. The task interpreter accepts both
   historical `/1` candidates and active `/2` candidates; it preserves
   historical locators and derives active locators.
6. The one-to-eight non-exhaustive batch and 8,192-output-token bounds from
   ADR-0041 remain active. Locator derivation does not imply source coverage.

## Consequences

- The model remains a candidate generator for passage selection and domain
  characterization, never the authority for canonical source coordinates.
- A unique multi-line exact quote produces a deterministic inclusive line
  range without another model call.
- Repeated boilerplate or another duplicated quote is refused until a future
  explicitly designed disambiguation contract supplies deterministic context.
- Active request/schema hashes change additively; historical hashes remain
  resolvable.
- A new separately frozen provider acceptance is required after the offline
  implementation is green.

## Rejected alternatives

- **Prompt the model to count more carefully:** ACME-0113 already demonstrated
  that correct verbatim selection does not make line estimates authoritative.
- **Silently repair supplied line numbers:** retaining model-authored locator
  fields would leave ambiguous authority and complicate replay evidence.
- **Fuzzy quote matching:** it can bind a candidate to the wrong passage and
  weakens exact provenance.
- **Choose the first duplicate:** occurrence order is not evidence that the
  candidate intended that occurrence.
