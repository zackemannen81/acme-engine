import { canonicalJson, computeModelRequestHash } from '@acme/core';
import {
  evidenceRelateObservationsContract,
  EvidenceRelateObservationsInputSchema,
  EvidenceRelateObservationsOutputSchema,
  type EvidenceRelateObservationsInput,
  type EvidenceRelateObservationsOutput,
  type EvidenceTemporalBound,
} from '@acme/module-evidence';

import {
  buildGoldenMaterial,
  loadSealedEvaluationTruth,
} from './evaluation.js';

export interface EvidenceEvaluationRelateCase {
  readonly caseId: string;
  readonly requestHash: string;
  readonly input: EvidenceRelateObservationsInput;
  readonly output: EvidenceRelateObservationsOutput;
}

function temporalKey(bound: EvidenceTemporalBound): string {
  return canonicalJson(bound as never);
}

export function evaluationRelateCase(): EvidenceEvaluationRelateCase {
  const truth = loadSealedEvaluationTruth();
  const material = buildGoldenMaterial(truth);
  const observations = [...material.observations.values()].sort((left, right) =>
    left.observationId.localeCompare(right.observationId),
  );
  const observationIdByTemporal = new Map<string, string[]>();
  for (const observation of observations) {
    if (observation.temporalBound === null) continue;
    const key = temporalKey(observation.temporalBound);
    const bucket = observationIdByTemporal.get(key) ?? [];
    bucket.push(observation.observationId);
    observationIdByTemporal.set(key, bucket);
  }
  const observationIdByTruth = new Map(
    [...material.observations.entries()].map(([truthId, value]) => [
      truthId,
      value.observationId,
    ]),
  );

  const input = EvidenceRelateObservationsInputSchema.parse({
    schemaVersion: 'evidence-relate-observations-input/1',
    observations,
  });

  const relations = truth.relations.map((item) => {
    const relation = material.relations.get(item.truthId);
    if (relation === undefined) {
      throw new RangeError(`Missing golden relation ${item.truthId}.`);
    }
    const temporalObservationIds = [
      ...new Set(
        relation.comparableScope.temporalBounds.flatMap((bound) => {
          const matches = observationIdByTemporal.get(temporalKey(bound)) ?? [];
          return matches;
        }),
      ),
    ].sort();
    // Prefer truth-declared temporal observation ids when they resolve uniquely.
    const truthTemporalIds = item.comparableScope.temporalObservationTruthIds
      .map((truthId) => observationIdByTruth.get(truthId))
      .filter((id): id is string => id !== undefined)
      .sort();
    return {
      relationKind: relation.relationKind,
      endpoints: relation.endpoints,
      comparableScope: {
        subject: relation.comparableScope.subject,
        aspect: relation.comparableScope.aspect,
        actorReferenceKeys: [...relation.comparableScope.actorReferenceKeys],
        temporalObservationIds:
          truthTemporalIds.length > 0
            ? truthTemporalIds
            : temporalObservationIds,
      },
      rationaleCode: relation.rationaleCode,
      rationale: relation.rationale,
    };
  });

  const openQuestions = truth.openQuestions.map((item) => {
    const observationTriggers = item.triggeringTruthIds
      .filter((truthId) => observationIdByTruth.has(truthId))
      .map((truthId) => observationIdByTruth.get(truthId) as string)
      .sort();
    const relationCodes = item.triggeringTruthIds
      .map((truthId) => material.relations.get(truthId)?.rationaleCode)
      .filter((code): code is string => code !== undefined)
      .sort();
    return {
      questionCode: item.questionCode,
      questionText: item.questionText,
      triggeringObservationIds: observationTriggers,
      triggeringRelationRationaleCodes: relationCodes,
    };
  });

  const output = EvidenceRelateObservationsOutputSchema.parse({
    schemaVersion: 'evidence-relate-observations-output/2',
    propositions: [],
    events: [],
    relations,
    openQuestions,
  });

  const requestHash = computeModelRequestHash(
    evidenceRelateObservationsContract.buildRequest(input, {
      executionId: 'hash-only',
      now: '2026-08-11T00:00:00.000Z',
    }),
  );

  return Object.freeze({
    caseId: 'evaluation-relate-observations-1',
    requestHash,
    input,
    output,
  });
}

export function evaluationRelateExpectedRelationIds(): readonly string[] {
  return Object.freeze(
    [
      ...buildGoldenMaterial(loadSealedEvaluationTruth()).run
        .expectedRelationIds,
    ].sort(),
  );
}

export function evaluationRelateExpectedOpenQuestionIds(): readonly string[] {
  return Object.freeze(
    [
      ...buildGoldenMaterial(loadSealedEvaluationTruth()).run
        .expectedOpenQuestionIds,
    ].sort(),
  );
}
