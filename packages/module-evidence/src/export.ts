import { canonicalJson, type JsonValue } from '@acme/core';

import { immutableEvidence } from './immutable.js';
import {
  EvidenceAssessmentSchema,
  type EvidenceAssessment,
  type EvidenceObservation,
  type EvidenceOpenQuestion,
  type EvidenceRelation,
  type SourceArtifactVersion,
} from './schemas.js';

export const EVIDENCE_ASSESSMENT_EXPORT_SCHEMA_VERSION =
  'evidence-assessment-export/1' as const;

export interface EvidenceAssessmentExportBundle {
  readonly schemaVersion: typeof EVIDENCE_ASSESSMENT_EXPORT_SCHEMA_VERSION;
  readonly dataPolicy: 'synthetic-only';
  readonly assessment: EvidenceAssessment;
  readonly sources: readonly SourceArtifactVersion[];
  readonly observations: readonly EvidenceObservation[];
  readonly relations: readonly EvidenceRelation[];
  readonly openQuestions: readonly EvidenceOpenQuestion[];
}

/**
 * Deterministic self-contained assessment export. Refuses any workspace or
 * source not labelled synthetic-only.
 */
export function buildEvidenceAssessmentExport(input: {
  readonly dataPolicy: string;
  readonly assessment: EvidenceAssessment;
  readonly sources: readonly SourceArtifactVersion[];
  readonly observations: readonly EvidenceObservation[];
  readonly relations: readonly EvidenceRelation[];
  readonly openQuestions: readonly EvidenceOpenQuestion[];
}): EvidenceAssessmentExportBundle {
  if (input.dataPolicy !== 'synthetic-only') {
    throw new RangeError(
      'Assessment export refuses non-synthetic data policies.',
    );
  }
  const assessment = EvidenceAssessmentSchema.parse(input.assessment);
  const cited = new Set(
    assessment.citations.map(({ evidenceId }) => evidenceId),
  );
  const observations = input.observations
    .filter((value) => cited.has(value.observationId))
    .sort((left, right) =>
      left.observationId.localeCompare(right.observationId),
    );
  const relations = input.relations
    .filter((value) => cited.has(value.relationId))
    .sort((left, right) => left.relationId.localeCompare(right.relationId));
  const openQuestions = input.openQuestions
    .filter((value) =>
      assessment.openQuestionIds.includes(value.openQuestionId),
    )
    .sort((left, right) =>
      left.openQuestionId.localeCompare(right.openQuestionId),
    );
  const sourceIds = new Set([
    ...observations.map(({ artifactVersionId }) => artifactVersionId),
    ...assessment.citations.map(({ artifactVersionId }) => artifactVersionId),
  ]);
  const sources = input.sources
    .filter((source) => sourceIds.has(source.artifactVersionId))
    .sort((left, right) =>
      left.artifactVersionId.localeCompare(right.artifactVersionId),
    );
  return immutableEvidence({
    schemaVersion: EVIDENCE_ASSESSMENT_EXPORT_SCHEMA_VERSION,
    dataPolicy: 'synthetic-only',
    assessment,
    sources,
    observations,
    relations,
    openQuestions,
  });
}

export function evidenceAssessmentExportBytes(
  bundle: EvidenceAssessmentExportBundle,
): string {
  return `${canonicalJson(bundle as unknown as JsonValue)}\n`;
}
