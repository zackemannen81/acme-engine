# @acme/evidence-testing

Synthetic test support for the Evidence Integrity Workbench.

The default export exposes the fixed corpus manifest, canonical source loader,
scratch/development truth, validators, golden builder and identity vectors.
Evaluation source text is available through the normal source loader, but its
sealed truth is not. It also exposes the deterministic `DEV-T01` observation
input/output fixture, its exact model-request hash and the labelled 2/2
development metric targets.

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
