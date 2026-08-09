import type {
  QualityEvaluationInput,
  QualityEvaluator,
  QualityEvaluatorRef,
} from './contracts.js';
import { QualityEvaluationError } from './errors.js';
import { parseQualityEvaluatorRef } from './validation.js';

function key(ref: Pick<QualityEvaluatorRef, 'id' | 'version'>): string {
  return `${ref.id}\u0000${ref.version}`;
}

export class QualityEvaluatorRegistry {
  readonly #evaluators: ReadonlyMap<string, QualityEvaluator>;
  readonly #refs: readonly QualityEvaluatorRef[];

  constructor(evaluators: readonly QualityEvaluator[]) {
    const entries = new Map<string, QualityEvaluator>();
    const refs: QualityEvaluatorRef[] = [];
    for (const evaluator of evaluators) {
      const ref = parseQualityEvaluatorRef({
        id: evaluator.id,
        version: evaluator.version,
        kind: evaluator.kind,
      });
      const identity = key(ref);
      if (entries.has(identity)) {
        throw new QualityEvaluationError(
          'EVALUATOR_COLLISION',
          `Duplicate quality evaluator ${JSON.stringify(ref.id)} at version ${JSON.stringify(ref.version)}.`,
        );
      }
      if (ref.kind === 'live-model') {
        throw new QualityEvaluationError(
          'INVALID_QUALITY_EVALUATION',
          'live-model evaluators cannot be registered in the synchronous harness registry; use runLiveModelQualityJudge.',
        );
      }
      entries.set(
        identity,
        Object.freeze({
          id: ref.id,
          version: ref.version,
          kind: ref.kind,
          evaluate(input: QualityEvaluationInput) {
            return evaluator.evaluate(input);
          },
        }) as QualityEvaluator,
      );
      refs.push(ref);
    }
    this.#evaluators = entries;
    this.#refs = Object.freeze(refs);
  }

  get(ref: QualityEvaluatorRef): QualityEvaluator {
    const parsed = parseQualityEvaluatorRef(ref);
    const evaluator = this.#evaluators.get(key(parsed));
    if (evaluator === undefined || evaluator.kind !== parsed.kind) {
      throw new QualityEvaluationError(
        'EVALUATOR_NOT_FOUND',
        `No ${parsed.kind} quality evaluator ${JSON.stringify(parsed.id)} at version ${JSON.stringify(parsed.version)} is registered.`,
      );
    }
    return evaluator;
  }

  list(): readonly QualityEvaluatorRef[] {
    return this.#refs;
  }
}
