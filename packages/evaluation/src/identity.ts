import {
  nodeHashing,
  type ExecutionResult,
  type Hashing,
  type JsonValue,
} from '@acme/core';

import {
  QUALITY_ARTIFACT_DIGEST_ALGORITHM,
  QUALITY_EVALUATION_ID_ALGORITHM,
  QUALITY_EVALUATION_VERSION,
  QUALITY_EXECUTION_RESULT_DIGEST_ALGORITHM,
  QUALITY_RESULT_DIGEST_ALGORITHM,
  QUALITY_SUBJECT_DIGEST_ALGORITHM,
  QUALITY_SUBJECT_VERSION,
  type QualityContractBinding,
  type QualityEvaluationInput,
  type QualityEvaluationRecord,
  type QualityEvaluationResult,
  type QualityEvaluationSubject,
  type QualityEvaluatorRef,
} from './contracts.js';
import { QualityEvaluationError } from './errors.js';
import {
  cloneJson,
  parseQualityEvaluationRecord,
  parseQualityEvaluationResult,
  parseQualityEvaluationSubject,
  parseQualityEvaluatorRef,
} from './validation.js';

function hash(hashing: Hashing, algorithm: string, value: JsonValue): string {
  return hashing.sha256(
    hashing.canonicalJson({ algorithm, value } as unknown as JsonValue),
  );
}

export interface QualityEvaluationInputOptions {
  readonly runId: string;
  readonly executionResult: ExecutionResult;
  readonly operationDigest?: string | null;
  readonly artifact: {
    readonly kind: string;
    readonly id: string;
    readonly value: JsonValue;
    readonly expectedDigest?: string;
  };
  readonly contract: QualityContractBinding;
  readonly hashing?: Hashing;
}

export function computeQualityArtifactDigest(
  value: JsonValue,
  hashing: Hashing = nodeHashing,
): string {
  return hash(hashing, QUALITY_ARTIFACT_DIGEST_ALGORITHM, value);
}

export function computeQualityExecutionResultDigest(
  result: ExecutionResult,
  hashing: Hashing = nodeHashing,
): string {
  return hash(
    hashing,
    QUALITY_EXECUTION_RESULT_DIGEST_ALGORITHM,
    result as unknown as JsonValue,
  );
}

export function computeQualitySubjectDigest(
  subject: QualityEvaluationSubject,
  hashing: Hashing = nodeHashing,
): string {
  return hash(
    hashing,
    QUALITY_SUBJECT_DIGEST_ALGORITHM,
    subject as unknown as JsonValue,
  );
}

export function computeQualityResultDigest(
  result: QualityEvaluationResult,
  hashing: Hashing = nodeHashing,
): string {
  return hash(
    hashing,
    QUALITY_RESULT_DIGEST_ALGORITHM,
    result as unknown as JsonValue,
  );
}

export function deriveQualityEvaluationId(
  subjectDigest: string,
  evaluator: QualityEvaluatorRef,
  hashing: Hashing = nodeHashing,
): string {
  return `quality_evaluation_${hashing.sha256(
    hashing.canonicalJson({
      algorithm: QUALITY_EVALUATION_ID_ALGORITHM,
      subjectDigest,
      evaluator,
    } as unknown as JsonValue),
  )}`;
}

export function createQualityEvaluationInput(
  options: QualityEvaluationInputOptions,
): QualityEvaluationInput {
  const hashing = options.hashing ?? nodeHashing;
  const artifact = cloneJson(options.artifact.value, 'artifact');
  const executionResult = cloneJson(options.executionResult, 'executionResult');
  const artifactDigest = computeQualityArtifactDigest(artifact, hashing);
  if (
    options.artifact.expectedDigest !== undefined &&
    options.artifact.expectedDigest !== artifactDigest
  ) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      `Artifact digest was ${artifactDigest}, expected ${options.artifact.expectedDigest}.`,
    );
  }
  const subject = parseQualityEvaluationSubject({
    version: QUALITY_SUBJECT_VERSION,
    runId: options.runId,
    executionId: executionResult.executionId,
    executionResultDigest: computeQualityExecutionResultDigest(
      executionResult,
      hashing,
    ),
    operationDigest: options.operationDigest ?? null,
    artifact: {
      kind: options.artifact.kind,
      id: options.artifact.id,
      digest: artifactDigest,
    },
    contract: options.contract,
  });
  return cloneJson({
    subject,
    subjectDigest: computeQualitySubjectDigest(subject, hashing),
    executionResult,
    artifact,
  });
}

export function validateQualityEvaluationInputIdentity(
  raw: QualityEvaluationInput,
  hashing: Hashing = nodeHashing,
): QualityEvaluationInput {
  const input = cloneJson(raw, 'quality evaluation input');
  const subject = parseQualityEvaluationSubject(input.subject);
  if (input.executionResult.executionId !== subject.executionId) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Quality input execution result does not match the subject execution id.',
    );
  }
  if (
    computeQualityExecutionResultDigest(input.executionResult, hashing) !==
    subject.executionResultDigest
  ) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Quality input execution result does not match the subject digest.',
    );
  }
  if (
    computeQualityArtifactDigest(input.artifact, hashing) !==
    subject.artifact.digest
  ) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Quality input artifact does not match the subject digest.',
    );
  }
  if (computeQualitySubjectDigest(subject, hashing) !== input.subjectDigest) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Quality input subject digest does not match its subject.',
    );
  }
  return cloneJson({ ...input, subject });
}

export function createQualityEvaluationRecord(options: {
  readonly input: QualityEvaluationInput;
  readonly evaluator: QualityEvaluatorRef;
  readonly result: unknown;
  readonly hashing?: Hashing;
}): QualityEvaluationRecord {
  const hashing = options.hashing ?? nodeHashing;
  const input = validateQualityEvaluationInputIdentity(options.input, hashing);
  const evaluator = parseQualityEvaluatorRef({
    id: options.evaluator.id,
    version: options.evaluator.version,
    kind: options.evaluator.kind,
  });
  const result = parseQualityEvaluationResult(options.result);
  return cloneJson({
    version: QUALITY_EVALUATION_VERSION,
    evaluationId: deriveQualityEvaluationId(
      input.subjectDigest,
      evaluator,
      hashing,
    ),
    subject: input.subject,
    subjectDigest: input.subjectDigest,
    evaluator,
    result,
    resultDigest: computeQualityResultDigest(result, hashing),
  });
}

export function validateQualityEvaluationRecordIdentity(
  raw: unknown,
  hashing: Hashing = nodeHashing,
): QualityEvaluationRecord {
  const record = parseQualityEvaluationRecord(raw);
  const subjectDigest = computeQualitySubjectDigest(record.subject, hashing);
  if (record.subjectDigest !== subjectDigest) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Quality record subject digest does not match its subject.',
    );
  }
  if (
    record.evaluationId !==
    deriveQualityEvaluationId(subjectDigest, record.evaluator, hashing)
  ) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Quality record id does not match its subject and evaluator.',
    );
  }
  if (
    record.resultDigest !== computeQualityResultDigest(record.result, hashing)
  ) {
    throw new QualityEvaluationError(
      'INVALID_QUALITY_EVALUATION',
      'Quality record result digest does not match its result.',
    );
  }
  return record;
}
