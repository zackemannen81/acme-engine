import type { JsonValue } from '@acme/core';

import {
  available,
  unavailable,
  QUALITY_EVALUATION_VIEW_VERSION,
  type ViewSection,
} from '../view.js';

/**
 * S11 — quality evaluation inspector (ACME-0067 / plan Q3).
 *
 * Pure lens over stored `acme-quality-evaluation/1` records. The interface
 * never runs a judge and never invents a verdict.
 */

export { QUALITY_EVALUATION_VIEW_VERSION };

export const QUALITY_EVALUATION_UNAVAILABLE = {
  /** No records were supplied by the composition root. */
  qualityEvidence: 'QUALITY_EVIDENCE_UNAVAILABLE',
  /** The requested evaluation id was not in the supplied set. */
  evaluationNotFound: 'QUALITY_EVALUATION_NOT_FOUND',
} as const;

/** Structural subset of a stored quality record (no package import). */
export interface QualityEvaluationRecordShape {
  readonly version: string;
  readonly evaluationId: string;
  readonly subjectDigest: string;
  readonly resultDigest: string;
  readonly subject: {
    readonly runId: string;
    readonly executionId: string;
    readonly operationDigest: string | null;
    readonly artifact: {
      readonly kind: string;
      readonly id: string;
      readonly digest: string;
    };
    readonly contract: {
      readonly id: string;
      readonly version: string;
      readonly fingerprint: string;
    };
  };
  readonly evaluator: {
    readonly id: string;
    readonly version: string;
    readonly kind: string;
  };
  readonly result: {
    readonly verdict: string;
    readonly scores: readonly {
      readonly id: string;
      readonly value: number;
      readonly scale: { readonly min: number; readonly max: number };
      readonly interpretation: string;
    }[];
    readonly findings: readonly {
      readonly code: string;
      readonly severity: string;
      readonly message: string;
    }[];
  };
}

export interface QualityEvaluationListItemView {
  readonly evaluationId: string;
  readonly runId: string;
  readonly executionId: string;
  readonly evaluatorId: string;
  readonly evaluatorVersion: string;
  readonly evaluatorKind: string;
  readonly verdict: string;
  readonly subjectDigest: string;
  readonly scoreCount: number;
  readonly findingCount: number;
}

export interface QualityEvaluationListView {
  readonly view: typeof QUALITY_EVALUATION_VIEW_VERSION;
  readonly surface: 'list';
  readonly evaluations: ViewSection<{
    readonly count: number;
    readonly items: readonly QualityEvaluationListItemView[];
  }>;
}

export interface QualityEvaluationDetailView {
  readonly view: typeof QUALITY_EVALUATION_VIEW_VERSION;
  readonly surface: 'detail';
  readonly evaluation: ViewSection<{
    readonly evaluationId: string;
    readonly runId: string;
    readonly executionId: string;
    readonly operationDigest: string | null;
    readonly evaluator: {
      readonly id: string;
      readonly version: string;
      readonly kind: string;
    };
    readonly verdict: string;
    readonly scores: QualityEvaluationRecordShape['result']['scores'];
    readonly findings: QualityEvaluationRecordShape['result']['findings'];
    readonly subjectDigest: string;
    readonly resultDigest: string;
    readonly artifact: QualityEvaluationRecordShape['subject']['artifact'];
    readonly contract: QualityEvaluationRecordShape['subject']['contract'];
  }>;
}

export function buildQualityEvaluationListView(
  records: readonly QualityEvaluationRecordShape[] | undefined,
): QualityEvaluationListView {
  if (records === undefined) {
    return {
      view: QUALITY_EVALUATION_VIEW_VERSION,
      surface: 'list',
      evaluations: unavailable(QUALITY_EVALUATION_UNAVAILABLE.qualityEvidence),
    };
  }
  const items = [...records]
    .sort((left, right) => left.evaluationId.localeCompare(right.evaluationId))
    .map((record): QualityEvaluationListItemView => ({
      evaluationId: record.evaluationId,
      runId: record.subject.runId,
      executionId: record.subject.executionId,
      evaluatorId: record.evaluator.id,
      evaluatorVersion: record.evaluator.version,
      evaluatorKind: record.evaluator.kind,
      verdict: record.result.verdict,
      subjectDigest: record.subjectDigest,
      scoreCount: record.result.scores.length,
      findingCount: record.result.findings.length,
    }));
  return {
    view: QUALITY_EVALUATION_VIEW_VERSION,
    surface: 'list',
    evaluations: available({
      count: items.length,
      items: Object.freeze(items),
    }),
  };
}

export function buildQualityEvaluationDetailView(
  records: readonly QualityEvaluationRecordShape[] | undefined,
  evaluationId: string,
): QualityEvaluationDetailView {
  if (records === undefined) {
    return {
      view: QUALITY_EVALUATION_VIEW_VERSION,
      surface: 'detail',
      evaluation: unavailable(QUALITY_EVALUATION_UNAVAILABLE.qualityEvidence),
    };
  }
  const record = records.find((entry) => entry.evaluationId === evaluationId);
  if (record === undefined) {
    return {
      view: QUALITY_EVALUATION_VIEW_VERSION,
      surface: 'detail',
      evaluation: unavailable(
        QUALITY_EVALUATION_UNAVAILABLE.evaluationNotFound,
      ),
    };
  }
  return {
    view: QUALITY_EVALUATION_VIEW_VERSION,
    surface: 'detail',
    evaluation: available({
      evaluationId: record.evaluationId,
      runId: record.subject.runId,
      executionId: record.subject.executionId,
      operationDigest: record.subject.operationDigest,
      evaluator: { ...record.evaluator },
      verdict: record.result.verdict,
      scores: record.result.scores,
      findings: record.result.findings,
      subjectDigest: record.subjectDigest,
      resultDigest: record.resultDigest,
      artifact: { ...record.subject.artifact },
      contract: { ...record.subject.contract },
    }),
  };
}

/** JSON-safe clone for view contract tests. */
export function qualityViewAsJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
