import { nodeHashing, type Hashing, type JsonValue } from '@acme/core';

import {
  RECORDED_QUALITY_EVALUATION_VERSION,
  type QualityEvaluationRecord,
  type QualityEvaluationInput,
  type RecordedExternalQualityEvaluator,
  type RecordedQualityEvaluation,
} from './contracts.js';
import { QualityEvaluationError } from './errors.js';
import {
  computeQualityResultDigest,
  computeQualitySubjectDigest,
  deriveQualityEvaluationId,
} from './identity.js';
import { cloneJson, parseRecordedQualityEvaluation } from './validation.js';

function equal(left: unknown, right: unknown, hashing: Hashing): boolean {
  return (
    hashing.canonicalJson(left as JsonValue) ===
    hashing.canonicalJson(right as JsonValue)
  );
}

function validateRecording(
  recording: RecordedQualityEvaluation,
  hashing: Hashing,
): void {
  const subjectDigest = computeQualitySubjectDigest(recording.subject, hashing);
  if (recording.subjectDigest !== subjectDigest) {
    throw new QualityEvaluationError(
      'RECORDED_SUBJECT_MISMATCH',
      'Recorded quality subject digest does not match its subject.',
    );
  }
  const evaluationId = deriveQualityEvaluationId(
    subjectDigest,
    recording.evaluator,
    hashing,
  );
  if (recording.evaluationId !== evaluationId) {
    throw new QualityEvaluationError(
      'RECORDED_SUBJECT_MISMATCH',
      'Recorded quality evaluation id does not match its subject and evaluator.',
    );
  }
  const resultDigest = computeQualityResultDigest(recording.result, hashing);
  if (recording.resultDigest !== resultDigest) {
    throw new QualityEvaluationError(
      'RECORDED_RESULT_MISMATCH',
      'Recorded quality result digest does not match its result.',
    );
  }
}

export function createRecordedQualityEvaluation(
  record: QualityEvaluationRecord,
): RecordedQualityEvaluation {
  if (record.evaluator.kind !== 'recorded-external') {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Only a recorded-external quality record can become an external recording.',
    );
  }
  return cloneJson({
    ...record,
    version: RECORDED_QUALITY_EVALUATION_VERSION,
    evaluator: { ...record.evaluator, kind: 'recorded-external' as const },
  });
}

export function recordedExternalEvaluator(
  raw: unknown,
  hashing: Hashing = nodeHashing,
): RecordedExternalQualityEvaluator {
  const recording = parseRecordedQualityEvaluation(raw);
  validateRecording(recording, hashing);

  return Object.freeze({
    id: recording.evaluator.id,
    version: recording.evaluator.version,
    kind: 'recorded-external' as const,
    evaluate(input: QualityEvaluationInput): unknown {
      if (
        input.subjectDigest !== recording.subjectDigest ||
        !equal(input.subject, recording.subject, hashing)
      ) {
        throw new QualityEvaluationError(
          'RECORDED_SUBJECT_MISMATCH',
          'Recorded external evaluation does not match the supplied subject.',
        );
      }
      return cloneJson(recording.result);
    },
  });
}
