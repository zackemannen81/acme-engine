import type { ContractRef, ExecutionResult, JsonValue } from '@acme/core';

export const QUALITY_SUBJECT_VERSION = 'acme-quality-subject/1' as const;
export const QUALITY_EVALUATION_VERSION = 'acme-quality-evaluation/1' as const;
export const RECORDED_QUALITY_EVALUATION_VERSION =
  'acme-recorded-quality-evaluation/1' as const;

export const QUALITY_ARTIFACT_DIGEST_ALGORITHM =
  'acme-quality-artifact-digest-1' as const;
export const QUALITY_EXECUTION_RESULT_DIGEST_ALGORITHM =
  'acme-quality-execution-result-digest-1' as const;
export const QUALITY_SUBJECT_DIGEST_ALGORITHM =
  'acme-quality-subject-digest-1' as const;
export const QUALITY_RESULT_DIGEST_ALGORITHM =
  'acme-quality-result-digest-1' as const;
export const QUALITY_EVALUATION_ID_ALGORITHM =
  'acme-quality-evaluation-id-1' as const;

export type QualityVerdict = 'pass' | 'fail' | 'inconclusive';
/**
 * `live-model` is produced only by the composition-root live judge path
 * (ACME-0068), never by the synchronous harness (ADR-0025).
 */
export type QualityEvaluatorKind =
  | 'deterministic'
  | 'recorded-external'
  | 'live-model';

export interface QualityScore {
  readonly id: string;
  readonly value: number;
  readonly scale: {
    readonly min: number;
    readonly max: number;
  };
  readonly interpretation: 'higher-is-better' | 'lower-is-better' | 'nominal';
}

export interface QualityFinding {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly path?: readonly (string | number)[];
}

export interface QualityEvaluationResult {
  readonly scores: readonly QualityScore[];
  readonly findings: readonly QualityFinding[];
  readonly verdict: QualityVerdict;
}

export interface QualityEvaluatorRef {
  readonly id: string;
  readonly version: string;
  readonly kind: QualityEvaluatorKind;
}

export interface QualityArtifactRef {
  readonly kind: string;
  readonly id: string;
  readonly digest: string;
}

export interface QualityContractBinding extends ContractRef {
  readonly fingerprint: string;
}

export interface QualityEvaluationSubject {
  readonly version: typeof QUALITY_SUBJECT_VERSION;
  readonly runId: string;
  readonly executionId: string;
  readonly executionResultDigest: string;
  readonly operationDigest: string | null;
  readonly artifact: QualityArtifactRef;
  readonly contract: QualityContractBinding;
}

/**
 * Runtime evaluator input. Artifact content is intentionally absent from the
 * stored subject and record so evaluation cannot silently widen retention.
 */
export interface QualityEvaluationInput {
  readonly subject: QualityEvaluationSubject;
  readonly subjectDigest: string;
  readonly executionResult: ExecutionResult;
  readonly artifact: JsonValue;
}

export interface QualityEvaluationRecord {
  readonly version: typeof QUALITY_EVALUATION_VERSION;
  readonly evaluationId: string;
  readonly subject: QualityEvaluationSubject;
  readonly subjectDigest: string;
  readonly evaluator: QualityEvaluatorRef;
  readonly result: QualityEvaluationResult;
  readonly resultDigest: string;
}

export interface RecordedQualityEvaluation {
  readonly version: typeof RECORDED_QUALITY_EVALUATION_VERSION;
  readonly evaluationId: string;
  readonly subject: QualityEvaluationSubject;
  readonly subjectDigest: string;
  readonly evaluator: QualityEvaluatorRef & {
    readonly kind: 'recorded-external';
  };
  readonly result: QualityEvaluationResult;
  readonly resultDigest: string;
}

export interface DeterministicQualityEvaluator {
  readonly id: string;
  readonly version: string;
  readonly kind: 'deterministic';
  evaluate(input: QualityEvaluationInput): unknown;
}

export interface RecordedExternalQualityEvaluator {
  readonly id: string;
  readonly version: string;
  readonly kind: 'recorded-external';
  evaluate(input: QualityEvaluationInput): unknown;
}

/**
 * Identity-only registration for provenance. The synchronous harness must not
 * invoke live-model evaluators; use `runLiveModelQualityJudge` instead.
 */
export interface LiveModelQualityEvaluator {
  readonly id: string;
  readonly version: string;
  readonly kind: 'live-model';
  evaluate(input: QualityEvaluationInput): unknown;
}

export type QualityEvaluator =
  | DeterministicQualityEvaluator
  | RecordedExternalQualityEvaluator
  | LiveModelQualityEvaluator;

export interface QualityEvaluationQuery {
  readonly runId?: string;
  readonly executionId?: string;
}

export interface QualityEvaluationStore {
  put(record: QualityEvaluationRecord): Promise<'created' | 'existing'>;
  get(evaluationId: string): Promise<QualityEvaluationRecord | null>;
  list(
    query?: QualityEvaluationQuery,
  ): Promise<readonly QualityEvaluationRecord[]>;
}
