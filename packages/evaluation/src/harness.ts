import { nodeHashing, type Hashing } from '@acme/core';

import type {
  QualityEvaluationInput,
  QualityEvaluationRecord,
  QualityEvaluationStore,
  QualityEvaluator,
  QualityEvaluatorRef,
} from './contracts.js';
import { QualityEvaluationError } from './errors.js';
import {
  createQualityEvaluationRecord,
  validateQualityEvaluationInputIdentity,
} from './identity.js';
import { QualityEvaluatorRegistry } from './registry.js';
import { parseQualityEvaluatorRef } from './validation.js';

export interface QualityEvaluationHarnessOptions {
  readonly registry: QualityEvaluatorRegistry;
  readonly store: QualityEvaluationStore;
  readonly hashing?: Hashing;
}

export class QualityEvaluationHarness {
  readonly #registry: QualityEvaluatorRegistry;
  readonly #store: QualityEvaluationStore;
  readonly #hashing: Hashing;

  constructor(options: QualityEvaluationHarnessOptions) {
    this.#registry = options.registry;
    this.#store = options.store;
    this.#hashing = options.hashing ?? nodeHashing;
  }

  async run(
    input: QualityEvaluationInput,
    evaluators: readonly QualityEvaluatorRef[],
  ): Promise<readonly QualityEvaluationRecord[]> {
    return this.runWith(
      input,
      evaluators.map((ref) => this.#registry.get(ref)),
    );
  }

  async runWith(
    input: QualityEvaluationInput,
    evaluators: readonly QualityEvaluator[],
  ): Promise<readonly QualityEvaluationRecord[]> {
    if (evaluators.length === 0) {
      throw new QualityEvaluationError(
        'INVALID_QUALITY_EVALUATION',
        'At least one quality evaluator is required.',
      );
    }
    const detachedInput = validateQualityEvaluationInputIdentity(
      input,
      this.#hashing,
    );
    const identities = new Set<string>();
    const records: QualityEvaluationRecord[] = [];

    for (const evaluator of evaluators) {
      const ref = parseQualityEvaluatorRef({
        id: evaluator.id,
        version: evaluator.version,
        kind: evaluator.kind,
      });
      const identity = `${ref.id}\u0000${ref.version}\u0000${ref.kind}`;
      if (identities.has(identity)) {
        throw new QualityEvaluationError(
          'EVALUATOR_COLLISION',
          `Quality evaluator ${JSON.stringify(ref.id)} at version ${JSON.stringify(ref.version)} was requested more than once.`,
        );
      }
      identities.add(identity);
      const result = evaluator.evaluate(detachedInput);
      if (result instanceof Promise) {
        throw new QualityEvaluationError(
          'INVALID_QUALITY_EVALUATION',
          'Quality evaluators must return synchronously; live or deferred work is outside this harness.',
        );
      }
      const record = createQualityEvaluationRecord({
        input: detachedInput,
        evaluator: ref,
        result,
        hashing: this.#hashing,
      });
      await this.#store.put(record);
      records.push(record);
    }

    return Object.freeze(records);
  }
}
