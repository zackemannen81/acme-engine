import { describe, expect, it } from 'vitest';

import { computeModelRequestHash, createContractRegistry } from '@acme/core';
import {
  deriveEvidenceRelationId,
  evidenceRelateObservationsContract,
  evidenceRelateObservationsContractV1,
} from '@acme/module-evidence';

import {
  evaluationRelateCase,
  evaluationRelateExpectedOpenQuestionIds,
  evaluationRelateExpectedRelationIds,
} from '../src/evaluation-relate.js';
import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from '../src/evaluation.js';
import { loadIdentityVectors } from '../src/corpus.js';

describe('evaluation relate candidates', () => {
  it('versions explicit sorted-set instructions without historical drift', () => {
    const relate = evaluationRelateCase();
    const context = {
      executionId: 'hash-only',
      now: '2026-08-11T00:00:00.000Z',
    };
    const historical = evidenceRelateObservationsContractV1.buildRequest(
      relate.input,
      context,
    );
    const active = evidenceRelateObservationsContract.buildRequest(
      relate.input,
      context,
    );

    expect(computeModelRequestHash(historical)).toBe(
      '9c4f7a883a6363d0a652f5d90e603e610d5969715069079ed1fdd5c3516815b0',
    );
    expect(computeModelRequestHash(active)).toBe(
      '1f49ca0835d94ab9236ea5a53aa1650f07a53454c94aacf94f16ccbac1b89f4f',
    );
    expect(JSON.stringify(historical)).not.toContain(
      'ascending lexicographic order',
    );
    expect(JSON.stringify(active)).toContain('ascending lexicographic order');
    expect(active.output.schemaName).toBe('evidence_relate_observations_1_1_0');
    expect(historical.output.schemaName).toBe(
      'evidence_relate_observations_1_0_0',
    );
    const registry = createContractRegistry([
      evidenceRelateObservationsContractV1,
      evidenceRelateObservationsContract,
    ]);
    expect(registry.has(evidenceRelateObservationsContractV1.ref)).toBe(true);
    expect(registry.has(evidenceRelateObservationsContract.ref)).toBe(true);
  });

  it('matches sealed golden relation and open-question identities', () => {
    const relate = evaluationRelateCase();
    const material = buildGoldenMaterial(loadSealedEvaluationTruth());
    const vectors = loadIdentityVectors();

    expect(relate.output.relations).toHaveLength(8);
    expect(relate.output.openQuestions).toHaveLength(3);
    expect(
      computeModelRequestHash(
        evidenceRelateObservationsContract.buildRequest(relate.input, {
          executionId: 'hash-only',
          now: '2026-08-11T00:00:00.000Z',
        }),
      ),
    ).toBe(relate.requestHash);

    const derivedRelationIds = relate.output.relations
      .map((candidate) => {
        const temporalBounds =
          candidate.comparableScope.temporalObservationIds.map(
            (observationId) => {
              const observation = relate.input.observations.find(
                (item) => item.observationId === observationId,
              );
              if (observation?.temporalBound == null) {
                throw new Error(`Missing temporal bound for ${observationId}`);
              }
              return observation.temporalBound;
            },
          );
        return deriveEvidenceRelationId({
          relationKind: candidate.relationKind,
          endpoints: candidate.endpoints,
          comparableScope: {
            subject: candidate.comparableScope.subject,
            aspect: candidate.comparableScope.aspect,
            actorReferenceKeys: candidate.comparableScope.actorReferenceKeys,
            temporalBounds,
          },
          rationale: candidate.rationale,
          predecessorRelationId: null,
        });
      })
      .sort();

    expect(derivedRelationIds).toEqual([
      ...evaluationRelateExpectedRelationIds(),
    ]);
    expect(material.relations.get('E-R05')?.relationId).toBe(
      vectors.relation.expected,
    );
    expect(derivedRelationIds).toContain(vectors.relation.expected);
    expect(evaluationRelateExpectedOpenQuestionIds()).toContain(
      vectors.openQuestion.expected,
    );
  });
});
