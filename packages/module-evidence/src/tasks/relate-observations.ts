import {
  AcmeError,
  defineTask,
  type ExecutionReadContext,
  type JsonValue,
  type MemoryCandidate,
  type ModuleResult,
  type StateDelta,
  type StateProjectionInput,
} from '@acme/core';

import { EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_REF } from '../catalogue.js';
import {
  deriveEvidenceEventId,
  deriveEvidenceOpenQuestionId,
  deriveEvidencePropositionId,
  deriveEvidenceRelationId,
  evidenceMemoryIdentity,
} from '../identity.js';
import { immutableEvidence } from '../immutable.js';
import {
  EVIDENCE_DELTA_SCHEMA_VERSION,
  EVIDENCE_EVENT_OCCURRENCE_SCHEMA_VERSION,
  EVIDENCE_MEMORY_SCHEMA_VERSION,
  EVIDENCE_NAMESPACE,
  EVIDENCE_OPEN_QUESTION_SCHEMA_VERSION,
  EVIDENCE_PROPOSITION_SCHEMA_VERSION,
  EVIDENCE_RELATION_SCHEMA_VERSION,
  EVIDENCE_STATE_SCHEMA_VERSION,
  EvidenceDeltaSchema,
  EvidenceMemoryValueSchema,
  EvidenceObservationSchema,
  EvidenceRelateObservationsInputSchema,
  EvidenceRelateObservationsOutputSchema,
  SourceArtifactVersionSchema,
  type EvidenceDelta,
  type EvidenceEventOccurrence,
  type EvidenceMemoryValue,
  type EvidenceObservation,
  type EvidenceOpenQuestion,
  type EvidenceProposition,
  type EvidenceRelateObservationsInput,
  type EvidenceRelateObservationsOutput,
  type EvidenceRelation,
  type EvidenceState,
  type EvidenceStandingChange,
} from '../schemas.js';
import { evidenceDeltaInvariants, initialEvidenceState } from '../state.js';

function readState(
  context: ExecutionReadContext<EvidenceState>,
): EvidenceState {
  if (context.state === null) return initialEvidenceState();
  if (
    context.state.namespace !== EVIDENCE_NAMESPACE ||
    context.state.entityId !== context.entityId ||
    context.state.schemaVersion !== EVIDENCE_STATE_SCHEMA_VERSION
  ) {
    throw new AcmeError({
      code: 'DOMAIN_INVALID_RESULT',
      message: 'Evidence read context contains a foreign state snapshot.',
      stage: 'loading',
      retryable: false,
    });
  }
  return context.state.value;
}

function memory(
  value: EvidenceMemoryValue,
  context: ExecutionReadContext<EvidenceState>,
): MemoryCandidate {
  return immutableEvidence({
    key: evidenceMemoryIdentity(value),
    kind: `evidence.${value.kind === 'evidence-relation' ? 'relation' : value.kind}`,
    schemaVersion: EVIDENCE_MEMORY_SCHEMA_VERSION,
    value: value as unknown as JsonValue,
    confidence: 1,
    source: {
      executionId: context.executionId,
      contract: EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_REF,
      documentKeys: [],
    },
  });
}

function observationMap(
  input: EvidenceRelateObservationsInput,
): Map<string, EvidenceObservation> {
  return new Map(
    input.observations.map((observation) => [
      observation.observationId,
      EvidenceObservationSchema.parse(observation),
    ]),
  );
}

function artifactLogicalId(
  context: ExecutionReadContext<EvidenceState>,
  artifactVersionId: string,
): string | null {
  const fromDocuments = context.documents
    .map(({ value }) => SourceArtifactVersionSchema.safeParse(value))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
    .find((source) => source.artifactVersionId === artifactVersionId);
  return fromDocuments?.logicalArtifactId ?? null;
}

function isCorrectionSuccessor(
  observation: EvidenceObservation,
  state: EvidenceState,
  context: ExecutionReadContext<EvidenceState>,
): boolean {
  const source = context.documents
    .map(({ value }) => SourceArtifactVersionSchema.safeParse(value))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
    .find(
      (candidate) =>
        candidate.artifactVersionId === observation.artifactVersionId,
    );
  if (source?.predecessorVersionId == null) return false;
  return state.standings.some(
    (entry) =>
      entry.standing === 'superseded' &&
      (entry.objectKind === 'statement-occurrence' ||
        entry.objectKind === 'exhibit-assertion') &&
      context.memories.some((record) => {
        const parsed = EvidenceMemoryValueSchema.safeParse(record.value);
        return (
          parsed.success &&
          (parsed.data.kind === 'statement-occurrence' ||
            parsed.data.kind === 'exhibit-assertion') &&
          parsed.data.observationId === entry.objectId &&
          parsed.data.artifactVersionId === source.predecessorVersionId
        );
      }),
  );
}

function contestStandingChanges(
  relations: readonly EvidenceRelation[],
  observations: ReadonlyMap<string, EvidenceObservation>,
  state: EvidenceState,
  context: ExecutionReadContext<EvidenceState>,
): EvidenceStandingChange[] {
  const changes = new Map<string, EvidenceStandingChange>();
  for (const relation of relations) {
    if (relation.relationKind !== 'contradicts') continue;
    const observationEndpoints = relation.endpoints.filter(
      (endpoint) => endpoint.kind === 'observation',
    );
    for (const endpoint of observationEndpoints) {
      const observation = observations.get(endpoint.id);
      if (observation === undefined) continue;
      const prior = state.standings.find(
        (entry) =>
          entry.objectId === observation.observationId &&
          (entry.objectKind === observation.kind ||
            entry.objectKind === 'statement-occurrence' ||
            entry.objectKind === 'exhibit-assertion'),
      );
      if (prior === undefined || prior.standing !== 'current') continue;
      if (observation.kind === 'exhibit-assertion') continue;

      const otherObservationEndpoints = observationEndpoints.filter(
        (candidate) => candidate.id !== endpoint.id,
      );
      const otherLogicalIds = otherObservationEndpoints
        .map((candidate) => observations.get(candidate.id))
        .filter((value): value is EvidenceObservation => value !== undefined)
        .map((value) => artifactLogicalId(context, value.artifactVersionId));
      const thisLogicalId = artifactLogicalId(
        context,
        observation.artifactVersionId,
      );
      const conflictsWithDifferentArtifact =
        thisLogicalId !== null &&
        otherLogicalIds.some(
          (logicalId) => logicalId !== null && logicalId !== thisLogicalId,
        );
      if (
        conflictsWithDifferentArtifact &&
        isCorrectionSuccessor(observation, state, context)
      ) {
        continue;
      }

      const key = `${observation.kind}:${observation.observationId}`;
      if (changes.has(key)) continue;
      changes.set(key, {
        objectKind: observation.kind,
        objectId: observation.observationId,
        from: 'current',
        to: 'contested',
        transition: 'contest',
        correctionLineage: null,
      });
    }
  }
  return [...changes.values()].sort((left, right) =>
    left.objectId.localeCompare(right.objectId),
  );
}

function buildPropositions(
  output: EvidenceRelateObservationsOutput,
): EvidenceProposition[] {
  return output.propositions.map((candidate) => {
    const observationIds = [...candidate.observationIds].sort();
    const propositionId = deriveEvidencePropositionId({
      observationIds,
      normalizedProposition: candidate.normalizedProposition,
    });
    return immutableEvidence({
      schemaVersion: EVIDENCE_PROPOSITION_SCHEMA_VERSION,
      kind: 'proposition' as const,
      propositionId,
      observationIds,
      normalizedProposition: candidate.normalizedProposition,
    });
  });
}

function buildEvents(
  output: EvidenceRelateObservationsOutput,
  observations: ReadonlyMap<string, EvidenceObservation>,
): EvidenceEventOccurrence[] {
  return output.events.map((candidate) => {
    const temporalObservation = observations.get(
      candidate.temporalObservationId,
    );
    if (temporalObservation?.temporalBound == null) {
      throw new AcmeError({
        code: 'DOMAIN_INVALID_RESULT',
        message: 'Event temporalObservationId is missing a temporal bound.',
        stage: 'interpreting',
        retryable: false,
      });
    }
    const supportingObservationIds = [
      ...candidate.supportingObservationIds,
    ].sort();
    const actorReferenceKeys = [...candidate.actorReferenceKeys].sort();
    const temporalBound = temporalObservation.temporalBound;
    const eventId = deriveEvidenceEventId({
      supportingObservationIds,
      actorReferenceKeys,
      temporalBound,
    });
    return immutableEvidence({
      schemaVersion: EVIDENCE_EVENT_OCCURRENCE_SCHEMA_VERSION,
      kind: 'event-occurrence' as const,
      eventId,
      supportingObservationIds,
      actorReferenceKeys,
      temporalBound,
      description: candidate.description,
    });
  });
}

function buildRelations(
  output: EvidenceRelateObservationsOutput,
  observations: ReadonlyMap<string, EvidenceObservation>,
): EvidenceRelation[] {
  return output.relations.map((candidate) => {
    const endpoints = [...candidate.endpoints].sort((left, right) =>
      `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`),
    );
    const temporalBounds = candidate.comparableScope.temporalObservationIds.map(
      (observationId) => {
        const bound = observations.get(observationId)?.temporalBound;
        if (bound == null) {
          throw new AcmeError({
            code: 'DOMAIN_INVALID_RESULT',
            message: `Relation temporalObservationId ${observationId} is missing a temporal bound.`,
            stage: 'interpreting',
            retryable: false,
          });
        }
        return bound;
      },
    );
    const comparableScope = {
      subject: candidate.comparableScope.subject,
      aspect: candidate.comparableScope.aspect,
      actorReferenceKeys: [
        ...candidate.comparableScope.actorReferenceKeys,
      ].sort(),
      temporalBounds,
    };
    const relationId = deriveEvidenceRelationId({
      relationKind: candidate.relationKind,
      endpoints,
      comparableScope,
      rationale: candidate.rationale,
      predecessorRelationId: null,
    });
    return immutableEvidence({
      schemaVersion: EVIDENCE_RELATION_SCHEMA_VERSION,
      kind: 'evidence-relation' as const,
      relationId,
      relationKind: candidate.relationKind,
      endpoints,
      comparableScope,
      rationaleCode: candidate.rationaleCode,
      rationale: candidate.rationale,
      predecessorRelationId: null,
    });
  });
}

function buildOpenQuestions(
  output: EvidenceRelateObservationsOutput,
  relations: readonly EvidenceRelation[],
): EvidenceOpenQuestion[] {
  const relationsByCode = new Map(
    relations.map((relation) => [relation.rationaleCode, relation]),
  );
  return output.openQuestions.map((candidate) => {
    const relationIds = candidate.triggeringRelationRationaleCodes.map(
      (code) => {
        const relation = relationsByCode.get(code);
        if (relation === undefined) {
          throw new AcmeError({
            code: 'DOMAIN_INVALID_RESULT',
            message: `Open question cites unknown relation rationale code ${code}.`,
            stage: 'interpreting',
            retryable: false,
          });
        }
        return relation.relationId;
      },
    );
    const triggeringEvidenceIds = [
      ...candidate.triggeringObservationIds,
      ...relationIds,
    ].sort();
    const openQuestionId = deriveEvidenceOpenQuestionId({
      triggeringEvidenceIds,
      questionCode: candidate.questionCode,
      questionText: candidate.questionText,
    });
    return immutableEvidence({
      schemaVersion: EVIDENCE_OPEN_QUESTION_SCHEMA_VERSION,
      kind: 'open-question' as const,
      openQuestionId,
      triggeringEvidenceIds,
      questionCode: candidate.questionCode,
      questionText: candidate.questionText,
    });
  });
}

function interpretOutput(
  output: EvidenceRelateObservationsOutput,
  input: EvidenceRelateObservationsInput,
  context: ExecutionReadContext<EvidenceState>,
): ModuleResult<EvidenceDelta> {
  const validatedInput = EvidenceRelateObservationsInputSchema.parse(input);
  const validatedOutput = EvidenceRelateObservationsOutputSchema.parse(output);
  const state = readState(context);
  const observations = observationMap(validatedInput);
  const propositions = buildPropositions(validatedOutput);
  const events = buildEvents(validatedOutput, observations);
  const relations = buildRelations(validatedOutput, observations);
  const openQuestions = buildOpenQuestions(validatedOutput, relations);
  const values: EvidenceMemoryValue[] = [
    ...propositions,
    ...events,
    ...relations,
    ...openQuestions,
  ];
  const contestChanges = contestStandingChanges(
    relations,
    observations,
    state,
    context,
  );
  const nextRelationIds = [
    ...new Set([
      ...state.currentRelationVersionIds,
      ...relations.map(({ relationId }) => relationId),
    ]),
  ].sort();
  const nextQuestionIds = [
    ...new Set([
      ...state.currentOpenQuestionIds,
      ...openQuestions.map(({ openQuestionId }) => openQuestionId),
    ]),
  ].sort();
  return immutableEvidence({
    documents: [],
    memories: values.map((value) => memory(value, context)),
    stateIntent: {
      schemaVersion: EVIDENCE_DELTA_SCHEMA_VERSION,
      value: {
        schemaVersion: EVIDENCE_DELTA_SCHEMA_VERSION,
        nextEvidenceRevision: state.evidenceRevision + 1,
        addSourceDocumentIds: [],
        addAssessmentDocumentIds: [],
        addMemoryIds: [],
        standingChanges: contestChanges,
        currentRelationVersionIds: nextRelationIds,
        currentOpenQuestionIds: nextQuestionIds,
      },
    },
    events: [
      {
        key: `relations-proposed:${context.executionId}`,
        type: 'evidence.relations-proposed',
        schemaVersion: '1.0.0',
        payload: {
          relationCount: relations.length,
          openQuestionCount: openQuestions.length,
        },
      },
    ],
    diagnostics: [
      {
        code: 'EVIDENCE_RELATIONS_PROPOSED',
        severity: 'info',
        value: {
          relationCount: relations.length,
          openQuestionCount: openQuestions.length,
          contestCount: contestChanges.length,
        },
      },
    ],
  });
}

function projectEvidenceState(
  input: StateProjectionInput<EvidenceDelta>,
  context: ExecutionReadContext<EvidenceState>,
): StateDelta<EvidenceDelta> | undefined {
  if (input.stateIntent === undefined) return undefined;
  const state = readState(context);
  const direct = EvidenceDeltaSchema.parse(input.stateIntent.value);
  const created = input.memory
    .filter(({ resolution }) => resolution.action === 'create')
    .map(({ candidate, identityKey }) => {
      const value = EvidenceMemoryValueSchema.parse(candidate.value);
      if (
        candidate.schemaVersion !== EVIDENCE_MEMORY_SCHEMA_VERSION ||
        evidenceMemoryIdentity(value) !== identityKey
      ) {
        throw new AcmeError({
          code: 'DOMAIN_INVALID_RESULT',
          message:
            'Evidence state projection received a mismatched memory identity.',
          stage: 'preparing-commit',
          retryable: false,
        });
      }
      return { identityKey, objectKind: value.kind, value } as const;
    })
    .filter(({ identityKey }) => !state.memoryIds.includes(identityKey))
    .sort((left, right) => left.identityKey.localeCompare(right.identityKey));
  const addMemoryIds = created.map(({ identityKey }) => identityKey);
  const createdStandingChanges = created.map(({ identityKey, objectKind }) => ({
    objectKind,
    objectId: identityKey,
    from: null,
    to: 'current' as const,
    transition: 'create' as const,
    correctionLineage: null,
  }));
  const standingChanges = [
    ...direct.standingChanges,
    ...createdStandingChanges,
  ];
  const pointerChanged =
    direct.currentRelationVersionIds.join('\u0000') !==
      state.currentRelationVersionIds.join('\u0000') ||
    direct.currentOpenQuestionIds.join('\u0000') !==
      state.currentOpenQuestionIds.join('\u0000');
  const changes =
    addMemoryIds.length > 0 ||
    direct.standingChanges.length > 0 ||
    pointerChanged;
  const delta = EvidenceDeltaSchema.parse({
    ...direct,
    nextEvidenceRevision: state.evidenceRevision + (changes ? 1 : 0),
    addMemoryIds,
    standingChanges,
  });
  const issues = evidenceDeltaInvariants(state, delta);
  if (issues.length > 0) {
    throw new AcmeError({
      code: 'DOMAIN_INVALID_RESULT',
      message: `Evidence delta invariants failed: ${issues.map(({ code }) => code).join(', ')}`,
      stage: 'preparing-commit',
      retryable: false,
    });
  }
  return immutableEvidence({
    schemaVersion: EVIDENCE_DELTA_SCHEMA_VERSION,
    value: delta,
  });
}

export const evidenceRelateObservationsTask = defineTask<
  EvidenceRelateObservationsInput,
  EvidenceRelateObservationsInput,
  EvidenceRelateObservationsOutput,
  EvidenceState,
  EvidenceDelta
>({
  role: 'analyzer',
  inputSchema: EvidenceRelateObservationsInputSchema,
  contract: EVIDENCE_RELATE_OBSERVATIONS_CONTRACT_REF,
  project(input, context) {
    readState(context);
    return immutableEvidence(
      EvidenceRelateObservationsInputSchema.parse(input),
    );
  },
  interpret(output, input, context) {
    return interpretOutput(output, input, context);
  },
  projectState(input, context) {
    return projectEvidenceState(input, context);
  },
});
