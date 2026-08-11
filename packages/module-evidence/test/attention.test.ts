import { describe, expect, it } from 'vitest';

import {
  createEvidenceChangeSet,
  evidenceAttentionTier,
  evidenceAssessmentDueForAttention,
  type EvidenceTemporalBound,
} from '../src/index.js';

const bound: EvidenceTemporalBound = {
  schemaVersion: 'evidence-temporal-bound/1',
  role: 'claimed-event-time',
  artifactVersionId:
    'evidence_artifact_6d28c72d67b3be603fc266f25216bf4a4e4c4d058a6e4877724c4116dd10f913',
  locatorId:
    'evidence_locator_30cf44f91b4f68dd94eed3edf22b97ab762f1494820b495bf709732902423284',
  kind: 'exact',
  at: '2026-04-18T09:16:00Z',
};

describe('evidence attention helpers', () => {
  it('marks assessments due only when workspace revision exceeds effective basis', () => {
    expect(
      evidenceAssessmentDueForAttention({
        workspaceEvidenceRevision: 6,
        effectiveBasisEvidenceRevision: 5,
      }),
    ).toBe(true);
    expect(
      evidenceAssessmentDueForAttention({
        workspaceEvidenceRevision: 5,
        effectiveBasisEvidenceRevision: 5,
      }),
    ).toBe(false);
  });

  it('assigns tier A for shared temporal anchors and tier B otherwise', () => {
    const changeSet = createEvidenceChangeSet({
      fromEvidenceRevision: 5,
      toEvidenceRevision: 6,
      addedArtifactVersionIds: ['artifact-log'],
      addedObservationIds: ['obs-log'],
      addedRelationIds: [],
      addedOpenQuestionIds: [],
      standingChanges: [],
      actorReferenceKeys: [],
      relationEndpointIds: [],
      temporalBounds: [bound],
    });
    expect(
      evidenceAttentionTier(
        {
          assessmentVersionId: 'a1',
          basisEvidenceRevision: 5,
          effectiveBasisEvidenceRevision: 5,
          workspaceEvidenceRevision: 6,
          citedArtifactVersionIds: [],
          citedActorReferenceKeys: [],
          citedRelationEndpointIds: [],
          citedTemporalBounds: [bound],
        },
        changeSet,
      ),
    ).toBe('A');
    expect(
      evidenceAttentionTier(
        {
          assessmentVersionId: 'a1',
          basisEvidenceRevision: 5,
          effectiveBasisEvidenceRevision: 5,
          workspaceEvidenceRevision: 6,
          citedArtifactVersionIds: ['other'],
          citedActorReferenceKeys: [],
          citedRelationEndpointIds: [],
          citedTemporalBounds: [],
        },
        changeSet,
      ),
    ).toBe('B');
  });
});
