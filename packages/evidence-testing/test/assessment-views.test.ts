import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
  EvidenceProductSnapshotSchema,
} from '@acme/evidence-product-contracts';
import {
  buildEvidencePrimaryAssessmentView,
  buildEvidencePrimaryReviewHistoryView,
  buildEvidencePrimaryWorkQueueView,
  scanPrimaryViewVocabulary,
} from '@acme/evidence-views';
import { createEvidenceChangeSet } from '@acme/module-evidence';

import { evaluationObserveCases } from '../src/evaluation-candidates.js';
import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from '../src/evaluation.js';

describe('Evidence Slice 5 primary views', () => {
  it('builds one source-linked tier-A notice and immutable assessment history', () => {
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const assessment = material.assessments.get('E-A01');
    if (assessment === undefined) throw new Error('Missing E-A01.');
    const relations = [...material.relations.values()];
    const observations = [...material.observations.values()];
    const lateSource = evaluationObserveCases().find(
      ({ input }) => input.artifactVersion.logicalArtifactId === 'EVAL-E01',
    )?.input.artifactVersion;
    if (lateSource === undefined) throw new Error('Missing late source.');
    const lateObservationIds = new Set(
      observations
        .filter(
          ({ artifactVersionId }) =>
            artifactVersionId === lateSource.artifactVersionId,
        )
        .map(({ observationId }) => observationId),
    );
    const lateRelations = relations.filter(({ endpoints }) =>
      endpoints.some(
        ({ kind, id }) => kind === 'observation' && lateObservationIds.has(id),
      ),
    );
    const snapshot = EvidenceProductSnapshotSchema.parse({
      schemaVersion: EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION,
      workspaces: [
        {
          schemaVersion: 'evidence-workspace/1',
          workspaceId: assessment.workspaceId,
          label: 'Rillford evaluation review',
          dataPolicy: 'synthetic-only',
          evidenceRevision: 7,
          createdAt: '2026-08-11T00:00:00.000Z',
        },
      ],
      sources: evaluationObserveCases().map(
        ({ input }) => input.artifactVersion,
      ),
      observations,
      relations,
      openQuestions: [...material.openQuestions.values()],
      assessments: [assessment],
      changeSets: [
        {
          schemaVersion: 'evidence-product-change-set/1',
          workspaceId: assessment.workspaceId,
          commandKey: 'evaluation-observe-eval-e01-v1',
          recordedAt: '2026-08-11T01:00:00.000Z',
          changeSet: createEvidenceChangeSet({
            fromEvidenceRevision: 5,
            toEvidenceRevision: 7,
            addedArtifactVersionIds: [lateSource.artifactVersionId],
            addedObservationIds: [...lateObservationIds],
            addedRelationIds: lateRelations.map(({ relationId }) => relationId),
            addedOpenQuestionIds: [],
            standingChanges: [],
            actorReferenceKeys: [],
            relationEndpointIds: lateRelations.flatMap(({ endpoints }) =>
              endpoints.map(({ id }) => id),
            ),
            temporalBounds: lateRelations.flatMap(
              ({ comparableScope }) => comparableScope.temporalBounds,
            ),
          }),
        },
      ],
      jobs: [],
      reviewDecisions: [
        {
          schemaVersion: 'evidence-review-decision/1',
          reviewDecisionId: 'review-e-a01-accept',
          workspaceId: assessment.workspaceId,
          targetKind: 'assessment',
          targetVersionId: assessment.assessmentVersionId,
          action: 'accept',
          reviewerRef: 'local-reviewer',
          principalAssurance: 'unauthenticated-local',
          rationale: 'Every material claim was checked against exact sources.',
          decidedAt: '2026-08-11T00:30:00.000Z',
          commandKey: 'review-e-a01-accept',
          basisEvidenceRevision: null,
        },
      ],
    });
    const view = buildEvidencePrimaryAssessmentView({
      workspaceId: assessment.workspaceId,
      assessmentVersionId: assessment.assessmentVersionId,
      snapshot,
    });
    const queue = buildEvidencePrimaryWorkQueueView({
      workspaceId: assessment.workspaceId,
      snapshot,
    });
    const history = buildEvidencePrimaryReviewHistoryView({
      workspaceId: assessment.workspaceId,
      targetKind: 'assessment',
      targetVersionId: assessment.assessmentVersionId,
      snapshot,
    });
    expect(view).toMatchObject({
      shareable: true,
      dueForAttention: true,
      reviewStanding: 'accepted',
    });
    expect(view.newEvidenceNotices).toHaveLength(1);
    expect(view.newEvidenceNotices[0]?.attentionTier).toBe('A');
    expect(view.claims[0]?.supportCitations).not.toHaveLength(0);
    expect(queue.newEvidenceNotices).toEqual(view.newEvidenceNotices);
    expect(
      queue.nextItems.filter(({ kind }) => kind === 'assessment-attention'),
    ).toHaveLength(1);
    expect(history.decisions.map(({ action }) => action)).toEqual(['accept']);
    expect(scanPrimaryViewVocabulary({ view, queue, history })).toEqual([]);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.claims)).toBe(true);
    expect(Object.isFrozen(history.decisions)).toBe(true);
  });
});
