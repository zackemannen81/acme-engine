import { describe, expect, it } from 'vitest';

import {
  SEALED_EVALUATION_TRUTH_EXPORT,
  assertNoSealedTruthPromptDependency,
} from '../src/index.js';

describe('sealed evaluation truth guard', () => {
  it('allows normal prompt dependencies', () => {
    expect(() =>
      assertNoSealedTruthPromptDependency([
        '@acme/core',
        '@acme/evidence-testing',
        '@acme/module-evidence',
      ]),
    ).not.toThrow();
  });

  it('rejects the sealed evaluation entry point and direct truth path', () => {
    expect(() =>
      assertNoSealedTruthPromptDependency([SEALED_EVALUATION_TRUTH_EXPORT]),
    ).toThrow(/sealed evaluation truth/u);
    expect(() =>
      assertNoSealedTruthPromptDependency([
        '../fixtures/rillford-annex-review-1/evaluation/truth.json',
      ]),
    ).toThrow(/sealed evaluation truth/u);
  });
});
