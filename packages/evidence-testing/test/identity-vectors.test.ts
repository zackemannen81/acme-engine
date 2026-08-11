import { describe, expect, it } from 'vitest';

import {
  canonicalizeEvidenceText,
  deriveEvidenceActorReferenceKey,
  deriveEvidenceEventId,
  deriveEvidenceLocatorId,
  deriveEvidencePropositionId,
} from '@acme/module-evidence';

import {
  loadIdentityVectors,
  loadSourceArtifactVersion,
} from '../src/index.js';
import {
  buildSealedEvaluationGolden,
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from '../src/evaluation.js';

describe('Evidence identity vectors', () => {
  it('pins every named V1 identity family', () => {
    const vectors = loadIdentityVectors();
    const source = loadSourceArtifactVersion('EVAL-T01', 1);
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const observation = material.observations.get('E-O03');
    const eventObservation = material.observations.get('E-O09');
    if (
      observation?.kind !== 'statement-occurrence' ||
      eventObservation === undefined ||
      eventObservation.temporalBound === null
    ) {
      throw new Error('Golden identity fixture is incomplete.');
    }

    expect(canonicalizeEvidenceText(vectors.canonicalization.input)).toBe(
      vectors.canonicalization.canonical,
    );
    expect(source.contentHash).toBe(vectors.contentHash.expected);
    expect(source.artifactVersionId).toBe(vectors.artifactVersion.expected);
    expect(
      deriveEvidenceLocatorId({
        artifactVersionId: observation.artifactVersionId,
        startLine: observation.locator.startLine,
        endLine: observation.locator.endLine,
      }),
    ).toBe(vectors.locator.expected);
    expect(deriveEvidenceActorReferenceKey(observation.actorReference)).toBe(
      vectors.actorReference.expected,
    );
    expect(observation.observationId).toBe(vectors.observation.expected);
    expect(
      deriveEvidencePropositionId({
        observationIds: [observation.observationId],
        normalizedProposition:
          'Iven Marr reported arriving at approximately 09:08.',
      }),
    ).toBe(vectors.proposition.expected);
    expect(
      deriveEvidenceEventId({
        supportingObservationIds: [eventObservation.observationId],
        actorReferenceKeys: [],
        temporalBound: eventObservation.temporalBound,
      }),
    ).toBe(vectors.event.expected);
    expect(material.relations.get('E-R05')?.relationId).toBe(
      vectors.relation.expected,
    );
    expect(material.openQuestions.get('E-Q01')?.openQuestionId).toBe(
      vectors.openQuestion.expected,
    );
    expect(material.assessments.get('E-A01')?.contentHash).toBe(
      vectors.assessment.expectedContentHash,
    );
    expect(material.assessments.get('E-A01')?.assessmentVersionId).toBe(
      vectors.assessment.expectedId,
    );
    expect(buildSealedEvaluationGolden().expectedObservationIds).toContain(
      vectors.observation.expected,
    );
  });
});
