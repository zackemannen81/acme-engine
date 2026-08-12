# @acme/evidence-testing

Synthetic test support for the Evidence Integrity Workbench.

The default export exposes the fixed corpus manifest, canonical source loader,
scratch/development truth, validators, golden builder and identity vectors.
Evaluation source text is available through the normal source loader, but its
sealed truth is not. It also exposes the deterministic `DEV-T01` observation
input/output fixture, its exact model-request hash and the labelled 2/2
development metric targets.

Slice 2 adds five fixed candidate-response cases on the explicit
`@acme/evidence-testing/evaluation-candidates` entry point. They contain source
inputs, response candidates and frozen request hashes, but import no sealed
truth. The offline evaluation scenario executes and validates all five cases
before dynamically opening the separate truth entry point for comparison.

Sealed evaluation truth requires an explicit import:

```ts
import {
  loadSealedEvaluationTruth,
  validateSealedEvaluationCorpus,
} from '@acme/evidence-testing/evaluation';
```

Prompt construction, few-shot examples, model input and repair input must not
import that entry point. The dependency boundary and prompt guard enforce this
rule. All corpus people, places and events are synthetic and non-criminal.

Repository and primary-view conformance registrars are isolated on
`@acme/evidence-testing/product-conformance`, so ordinary fixture consumers do
not load a test runner.

ACME-0089 re-sealed the pre-late E-A01 fixture with no open-question
references. Every sealed question has at least one trigger that depends on
EVAL-E01, which is imported only afterward. Post-import E-A02 retains E-Q01,
E-Q02 and E-Q03. Identity vectors and golden standings pin the resulting
E-A01 identity plus E-A02's predecessor-derived identity, and a regression
gate rejects any future E-A01 question whose observation or relation trigger
is unavailable before EVAL-E01.
