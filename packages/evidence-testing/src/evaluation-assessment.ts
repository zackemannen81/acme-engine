import { computeModelRequestHash } from '@acme/core';
import {
  evidenceProposeAssessmentContract,
  EvidenceProposeAssessmentInputSchema,
  EvidenceProposeAssessmentOutputSchema,
  type EvidenceProposeAssessmentInput,
  type EvidenceProposeAssessmentOutput,
} from '@acme/module-evidence';

import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from './evaluation.js';

export interface EvidenceEvaluationAssessmentCase {
  readonly caseId: string;
  readonly truthId: string;
  readonly requestHash: string;
  readonly input: EvidenceProposeAssessmentInput;
  readonly output: EvidenceProposeAssessmentOutput;
  readonly expectedAssessmentVersionId: string;
}

export function evaluationAssessmentCases(): readonly EvidenceEvaluationAssessmentCase[] {
  const truth = loadSealedEvaluationTruth();
  const material = buildGoldenMaterial(truth);
  const observationIdByTruth = new Map(
    [...material.observations.entries()].map(([truthId, value]) => [
      truthId,
      value.observationId,
    ]),
  );
  const relationIdByTruth = new Map(
    [...material.relations.entries()].map(([truthId, value]) => [
      truthId,
      value.relationId,
    ]),
  );
  const openQuestionIdByTruth = new Map(
    [...material.openQuestions.entries()].map(([truthId, value]) => [
      truthId,
      value.openQuestionId,
    ]),
  );

  return Object.freeze(
    truth.assessments.map((item) => {
      const assessment = material.assessments.get(item.truthId);
      if (assessment === undefined) {
        throw new RangeError(`Missing golden assessment ${item.truthId}.`);
      }
      const acceptedObservationIds = [
        ...new Set(
          [
            ...item.claims.flatMap((claim) => claim.supportObservationTruthIds),
            ...item.citationTruthIds.filter((truthId) =>
              observationIdByTruth.has(truthId),
            ),
          ].map((truthId) => observationIdByTruth.get(truthId) as string),
        ),
      ].sort();
      const acceptedRelationIds = [
        ...new Set(
          [
            ...item.claims.flatMap((claim) => [
              ...claim.conflictRelationTruthIds,
              ...claim.qualificationRelationTruthIds,
            ]),
            ...item.citationTruthIds.filter((truthId) =>
              relationIdByTruth.has(truthId),
            ),
          ].map((truthId) => relationIdByTruth.get(truthId) as string),
        ),
      ].sort();
      const acceptedOpenQuestionIds = [
        ...new Set(
          item.openQuestionTruthIds.map(
            (truthId) => openQuestionIdByTruth.get(truthId) as string,
          ),
        ),
      ].sort();
      const input = EvidenceProposeAssessmentInputSchema.parse({
        schemaVersion: 'evidence-propose-assessment-input/1',
        workspaceId: item.workspaceId,
        sequence: item.sequence,
        basisEvidenceRevision: item.basisEvidenceRevision,
        acceptedObservationIds,
        acceptedRelationIds,
        acceptedOpenQuestionIds,
        predecessorAssessmentVersionId:
          assessment.predecessorAssessmentVersionId,
      });
      const output = EvidenceProposeAssessmentOutputSchema.parse({
        schemaVersion: 'evidence-propose-assessment-output/1',
        claims: assessment.claims,
        openQuestionIds: assessment.openQuestionIds,
        citations: assessment.citations,
      });
      const requestHash = computeModelRequestHash(
        evidenceProposeAssessmentContract.buildRequest(input, {
          executionId: 'hash-only',
          now: '2026-08-11T00:00:00.000Z',
        }),
      );
      return Object.freeze({
        caseId: `evaluation-propose-${item.truthId.toLowerCase()}`,
        truthId: item.truthId,
        requestHash,
        input,
        output,
        expectedAssessmentVersionId: assessment.assessmentVersionId,
      });
    }),
  );
}
