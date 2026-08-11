import {
  EVIDENCE_ACTOR_REFERENCE_SCHEMA_VERSION,
  EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
  EVIDENCE_EXHIBIT_ASSERTION_SCHEMA_VERSION,
  EVIDENCE_LOCATOR_SCHEMA_VERSION,
  EVIDENCE_OPEN_QUESTION_SCHEMA_VERSION,
  EVIDENCE_RELATION_SCHEMA_VERSION,
  EVIDENCE_STATEMENT_OCCURRENCE_SCHEMA_VERSION,
  EVIDENCE_TEMPORAL_BOUND_SCHEMA_VERSION,
  EvidenceAssessmentSchema,
  EvidenceObservationSchema,
  EvidenceOpenQuestionSchema,
  EvidenceRelationSchema,
  EvidenceTemporalBoundSchema,
  deriveEvidenceActorReferenceKey,
  deriveEvidenceAssessmentContentHash,
  deriveEvidenceAssessmentId,
  deriveEvidenceLocatorId,
  deriveEvidenceObservationId,
  deriveEvidenceOpenQuestionId,
  deriveEvidenceRelationId,
  evidenceObservationInvariants,
  type EvidenceActorReference,
  type EvidenceAssessment,
  type EvidenceObservation,
  type EvidenceOpenQuestion,
  type EvidenceRelation,
  type EvidenceTemporalBound,
} from '@acme/module-evidence';
import type { JsonValue } from '@acme/core';

import {
  loadCorpusManifest,
  loadSourceArtifactVersion,
  validateCorpusManifest,
  validateCorpusTruth,
} from './corpus.js';
import {
  EVIDENCE_GOLDEN_RUN_SCHEMA_VERSION,
  EvidenceGoldenRunSchema,
  type EvidenceCorpusTruth,
  type EvidenceGoldenRun,
  type TruthObservation,
} from './schemas.js';

function sourceVersionFor(truth: TruthObservation) {
  return loadSourceArtifactVersion(
    truth.logicalArtifactId,
    truth.versionOrdinal,
  );
}

function buildTemporalBound(
  truth: TruthObservation,
  artifactVersionId: string,
  locatorId: string,
): EvidenceTemporalBound {
  return EvidenceTemporalBoundSchema.parse({
    schemaVersion: EVIDENCE_TEMPORAL_BOUND_SCHEMA_VERSION,
    artifactVersionId,
    locatorId,
    ...truth.temporalBound,
  });
}

function buildActorReference(
  truth: TruthObservation,
  artifactVersionId: string,
  locatorId: string,
): EvidenceActorReference | null {
  if (truth.sourceActor === null) return null;
  const actorReferenceKey = deriveEvidenceActorReferenceKey({
    artifactVersionId,
    locatorId,
    sourceLabel: truth.sourceActor.sourceLabel,
    sourceRole: truth.sourceActor.sourceRole,
  });
  return {
    schemaVersion: EVIDENCE_ACTOR_REFERENCE_SCHEMA_VERSION,
    actorReferenceKey,
    artifactVersionId,
    locatorId,
    sourceLabel: truth.sourceActor.sourceLabel,
    sourceRole: truth.sourceActor.sourceRole,
    resolution: truth.sourceActor.resolution,
  };
}

function buildObservation(truth: TruthObservation): EvidenceObservation {
  const source = sourceVersionFor(truth);
  const locatorId = deriveEvidenceLocatorId({
    artifactVersionId: source.artifactVersionId,
    startLine: truth.startLine,
    endLine: truth.endLine,
  });
  const locator = {
    schemaVersion: EVIDENCE_LOCATOR_SCHEMA_VERSION,
    locatorId,
    artifactVersionId: source.artifactVersionId,
    startLine: truth.startLine,
    endLine: truth.endLine,
  } as const;
  const actor = buildActorReference(truth, source.artifactVersionId, locatorId);
  const temporalBound = buildTemporalBound(
    truth,
    source.artifactVersionId,
    locatorId,
  );
  const observationId = deriveEvidenceObservationId({
    kind: truth.kind,
    artifactVersionId: source.artifactVersionId,
    locatorId,
    exactQuote: truth.exactQuote,
    sourceActorReference: actor,
    temporalBound,
  });
  const observation = EvidenceObservationSchema.parse(
    truth.kind === 'statement-occurrence'
      ? {
          schemaVersion: EVIDENCE_STATEMENT_OCCURRENCE_SCHEMA_VERSION,
          kind: truth.kind,
          observationId,
          artifactVersionId: source.artifactVersionId,
          locator,
          exactQuote: truth.exactQuote,
          temporalBound,
          actorReference: actor,
        }
      : {
          schemaVersion: EVIDENCE_EXHIBIT_ASSERTION_SCHEMA_VERSION,
          kind: truth.kind,
          observationId,
          artifactVersionId: source.artifactVersionId,
          locator,
          exactQuote: truth.exactQuote,
          temporalBound,
          sourceActorReference: actor,
        },
  );
  const issues = evidenceObservationInvariants(observation, source);
  if (issues.length > 0) {
    throw new TypeError(
      `${truth.truthId} failed Evidence invariants: ${issues.map(({ code }) => code).join(', ')}`,
    );
  }
  return observation;
}

function actorOf(
  observation: EvidenceObservation,
): EvidenceActorReference | null {
  return observation.kind === 'statement-occurrence'
    ? observation.actorReference
    : observation.sourceActorReference;
}

function actualId(
  truthId: string,
  observations: ReadonlyMap<string, EvidenceObservation>,
  relations: ReadonlyMap<string, EvidenceRelation>,
  questions: ReadonlyMap<string, EvidenceOpenQuestion>,
): string {
  return (
    observations.get(truthId)?.observationId ??
    relations.get(truthId)?.relationId ??
    questions.get(truthId)?.openQuestionId ??
    (() => {
      throw new RangeError(`Unknown truth reference ${truthId}.`);
    })()
  );
}

function citationAnchor(
  truthId: string,
  truth: EvidenceCorpusTruth,
  observations: ReadonlyMap<string, EvidenceObservation>,
): EvidenceObservation {
  const direct = observations.get(truthId);
  if (direct !== undefined) return direct;
  const relation = truth.relations.find(({ truthId: id }) => id === truthId);
  const observationRef = relation?.endpoints.find(
    ({ kind }) => kind === 'observation',
  )?.ref;
  const anchor =
    observationRef === undefined ? undefined : observations.get(observationRef);
  if (anchor === undefined) {
    throw new RangeError(`${truthId} has no source-bound citation anchor.`);
  }
  return anchor;
}

export interface EvidenceGoldenMaterial {
  readonly observations: ReadonlyMap<string, EvidenceObservation>;
  readonly relations: ReadonlyMap<string, EvidenceRelation>;
  readonly openQuestions: ReadonlyMap<string, EvidenceOpenQuestion>;
  readonly assessments: ReadonlyMap<string, EvidenceAssessment>;
  readonly run: EvidenceGoldenRun;
}

export function buildGoldenMaterial(
  truth: EvidenceCorpusTruth,
  scenarioId = truth.scenarios[0]?.scenarioId,
): EvidenceGoldenMaterial {
  const manifestIssues = validateCorpusManifest();
  const truthIssues = validateCorpusTruth(truth);
  if (manifestIssues.length > 0 || truthIssues.length > 0) {
    throw new TypeError([...manifestIssues, ...truthIssues].join('\n'));
  }
  if (scenarioId === undefined) {
    throw new RangeError('A golden run requires a scenario.');
  }
  const scenario = truth.scenarios.find(
    (candidate) => candidate.scenarioId === scenarioId,
  );
  if (scenario === undefined) {
    throw new RangeError(`Unknown scenario ${scenarioId}.`);
  }

  const observations = new Map(
    truth.observations.map((item) => [item.truthId, buildObservation(item)]),
  );
  const actorResolutionObservation = new Map(
    truth.actorResolutions.map((item) => [
      item.truthId,
      item.observationTruthId,
    ]),
  );
  const relations = new Map<string, EvidenceRelation>();
  for (const item of truth.relations) {
    const endpoints = item.endpoints
      .map((endpoint) => ({
        kind: endpoint.kind,
        id:
          endpoint.kind === 'observation'
            ? (observations.get(endpoint.ref)?.observationId ?? '')
            : endpoint.ref,
      }))
      .sort((left, right) =>
        `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`),
      );
    const actorReferenceKeys = item.comparableScope.actorReferenceTruthIds
      .map((truthId) => actorResolutionObservation.get(truthId))
      .map((observationTruthId) =>
        observationTruthId === undefined
          ? null
          : actorOf(
              observations.get(observationTruthId) as EvidenceObservation,
            ),
      )
      .map((actor) => actor?.actorReferenceKey ?? '')
      .sort();
    const temporalBounds = item.comparableScope.temporalObservationTruthIds.map(
      (truthId) => {
        const bound = observations.get(truthId)?.temporalBound;
        if (bound === null || bound === undefined) {
          throw new RangeError(`${item.truthId} has a missing temporal bound.`);
        }
        return bound;
      },
    );
    const comparableScope = {
      subject: item.comparableScope.subject,
      aspect: item.comparableScope.aspect,
      actorReferenceKeys,
      temporalBounds,
    };
    const relationId = deriveEvidenceRelationId({
      relationKind: item.relationKind,
      endpoints,
      comparableScope,
      rationale: item.rationale,
      predecessorRelationId: null,
    });
    relations.set(
      item.truthId,
      EvidenceRelationSchema.parse({
        schemaVersion: EVIDENCE_RELATION_SCHEMA_VERSION,
        kind: 'evidence-relation',
        relationId,
        relationKind: item.relationKind,
        endpoints,
        comparableScope,
        rationaleCode: item.rationaleCode,
        rationale: item.rationale,
        predecessorRelationId: null,
      }),
    );
  }

  const openQuestions = new Map<string, EvidenceOpenQuestion>();
  for (const item of truth.openQuestions) {
    const triggeringEvidenceIds = item.triggeringTruthIds
      .map((truthId) =>
        actualId(truthId, observations, relations, openQuestions),
      )
      .sort();
    const openQuestionId = deriveEvidenceOpenQuestionId({
      triggeringEvidenceIds,
      questionCode: item.questionCode,
      questionText: item.questionText,
    });
    openQuestions.set(
      item.truthId,
      EvidenceOpenQuestionSchema.parse({
        schemaVersion: EVIDENCE_OPEN_QUESTION_SCHEMA_VERSION,
        kind: 'open-question',
        openQuestionId,
        triggeringEvidenceIds,
        questionCode: item.questionCode,
        questionText: item.questionText,
      }),
    );
  }

  const assessments = new Map<string, EvidenceAssessment>();
  for (const item of truth.assessments) {
    const claims = item.claims.map((claim) => ({
      claimKey: claim.claimKey,
      text: claim.text,
      supportObservationIds: claim.supportObservationTruthIds
        .map((truthId) => observations.get(truthId)?.observationId ?? '')
        .sort(),
      conflictRelationIds: claim.conflictRelationTruthIds
        .map((truthId) => relations.get(truthId)?.relationId ?? '')
        .sort(),
      qualificationRelationIds: claim.qualificationRelationTruthIds
        .map((truthId) => relations.get(truthId)?.relationId ?? '')
        .sort(),
      supportUnresolved: claim.supportUnresolved,
      uncertainty: claim.uncertainty,
      uncertaintyRationale: claim.uncertaintyRationale,
    }));
    const openQuestionIds = item.openQuestionTruthIds
      .map((truthId) => openQuestions.get(truthId)?.openQuestionId ?? '')
      .sort();
    const citations = item.citationTruthIds
      .map((truthId) => {
        const anchor = citationAnchor(truthId, truth, observations);
        return {
          evidenceId: actualId(truthId, observations, relations, openQuestions),
          artifactVersionId: anchor.artifactVersionId,
          locatorId: anchor.locator.locatorId,
        };
      })
      .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
    const predecessorAssessmentVersionId =
      item.predecessorAssessmentTruthId === null
        ? null
        : (assessments.get(item.predecessorAssessmentTruthId)
            ?.assessmentVersionId ?? null);
    const content = {
      claims,
      openQuestionIds,
      citations,
      predecessorAssessmentVersionId,
    } as unknown as JsonValue;
    const contentHash = deriveEvidenceAssessmentContentHash(content);
    const assessmentVersionId = deriveEvidenceAssessmentId({
      workspaceId: item.workspaceId,
      sequence: item.sequence,
      basisEvidenceRevision: item.basisEvidenceRevision,
      contentHash,
    });
    assessments.set(
      item.truthId,
      EvidenceAssessmentSchema.parse({
        schemaVersion: EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
        assessmentVersionId,
        workspaceId: item.workspaceId,
        sequence: item.sequence,
        basisEvidenceRevision: item.basisEvidenceRevision,
        contentHash,
        claims,
        openQuestionIds,
        citations,
        predecessorAssessmentVersionId,
      }),
    );
  }

  const expectedStandings = [
    ...truth.observations.map((item) => ({
      objectKind: item.kind,
      objectId: observations.get(item.truthId)?.observationId ?? '',
      standing: item.finalStanding,
    })),
    ...truth.relations.map((item) => ({
      objectKind: 'evidence-relation',
      objectId: relations.get(item.truthId)?.relationId ?? '',
      standing: item.expectedStanding,
    })),
    ...truth.openQuestions.map((item) => ({
      objectKind: 'open-question',
      objectId: openQuestions.get(item.truthId)?.openQuestionId ?? '',
      standing: item.expectedStanding,
    })),
    ...truth.assessments.map((item) => ({
      objectKind: 'assessment-version',
      objectId: assessments.get(item.truthId)?.assessmentVersionId ?? '',
      standing: 'current' as const,
    })),
  ].sort((left, right) =>
    `${left.objectKind}:${left.objectId}`.localeCompare(
      `${right.objectKind}:${right.objectId}`,
    ),
  );

  const run = EvidenceGoldenRunSchema.parse({
    schemaVersion: EVIDENCE_GOLDEN_RUN_SCHEMA_VERSION,
    corpusId: loadCorpusManifest().corpusId,
    partition: truth.partition,
    scenarioId,
    inputArtifactVersionIds: scenario.inputArtifactVersionIds,
    expectedObservationIds: [...observations.values()]
      .map(({ observationId }) => observationId)
      .sort(),
    expectedRelationIds: [...relations.values()]
      .map(({ relationId }) => relationId)
      .sort(),
    expectedOpenQuestionIds: [...openQuestions.values()]
      .map(({ openQuestionId }) => openQuestionId)
      .sort(),
    expectedAssessmentVersionIds: [...assessments.values()]
      .map(({ assessmentVersionId }) => assessmentVersionId)
      .sort(),
    expectedStandings,
    expectedEvidenceRevision: scenario.expectedEvidenceRevision,
    expectedReviewOverlay: scenario.expectedReviewOverlay,
    expectedRefusals: scenario.expectedRefusals,
    expectedReplayVerdicts: scenario.expectedReplayVerdicts,
  });
  return { observations, relations, openQuestions, assessments, run };
}

export function buildGoldenRun(
  truth: EvidenceCorpusTruth,
  scenarioId?: string,
): EvidenceGoldenRun {
  return buildGoldenMaterial(truth, scenarioId).run;
}
