export type QualityEvaluationErrorCode =
  | 'INVALID_QUALITY_EVALUATION'
  | 'EVALUATOR_NOT_FOUND'
  | 'EVALUATOR_COLLISION'
  | 'RECORDED_SUBJECT_MISMATCH'
  | 'RECORDED_RESULT_MISMATCH'
  | 'QUALITY_STORE_COLLISION';

// Note: INVALID_QUALITY_EVALUATION covers registry refusal of live-model.

export class QualityEvaluationError extends Error {
  readonly code: QualityEvaluationErrorCode;

  constructor(code: QualityEvaluationErrorCode, message: string) {
    super(message);
    this.name = 'QualityEvaluationError';
    this.code = code;
  }
}
