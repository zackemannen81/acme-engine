# Reference-module identity and provenance fields

Status: Backlog proposal  
Discovered in: ACME-0010

## Discovery context

The approved reference behaviors require information not fully represented in
the current illustrative contract outputs:

- Narrative supersession requires explicit accepted correction provenance,
  but `NarrativeContractOutput` has no correction field.
- Narrative alias normalization needs a defined authority.
- Research corroboration needs a stable proposition identity and versioned
  source-independence key, while `ResearchContractOutput` supplies only claim
  text, quote, confidence and locator.
- Research claim audit needs URI/publisher/independence metadata in
  domain-owned value or evidence, beyond generic `ProvenanceRef`.

## Proposed outcome

Before either `@1.0.0` contract is implemented, freeze domain-owned schemas
for:

- narrative alias and correction provenance
- research proposition identity
- research source independence
- claim evidence/source locator retention

Decide whether each field belongs to task input, contract input/output,
candidate value, state or immutable module configuration. Version every
identity algorithm.

## Why this is outside ACME-0010

The current task documents build/test plans and cannot change approved prompt
contracts or domain schemas. Those changes require owner review and may
require specification correction or an ADR.

## Dependencies

- Narrative and Research contract versions
- domain memory identity and resolution policy
- retention/privacy rules
- request/contract fingerprinting

## Suggested verification

- identity golden vectors and ordering/content sensitivity
- alias/correction positive and negative cases
- same-source versus independent-source Research cases
- semantically distinct claims never collide
- every state promotion traces to retained evidence
- schema-version migration/compatibility review

