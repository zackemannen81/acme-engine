import {
  AcmeError,
  canonicalJson,
  defineTask,
  sha256,
  type ExecutionReadContext,
  type JsonValue,
  type MemoryCandidate,
  type ModuleResult,
  type StateDelta,
  type StateProjectionInput,
} from '@acme/core';

import { EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF } from '../catalogue.js';
import { locateUniqueEvidenceQuote } from '../canonical-text.js';
import { resolveEvidenceStructuredSourceSegment } from '../source-structure.js';
import {
  EvidenceCorrectionPairingError,
  pairEvidenceCorrectionObservations,
} from '../correction.js';
import {
  deriveEvidenceActorReferenceKey,
  deriveEvidenceLocatorId,
  deriveEvidenceObservationId,
  evidenceMemoryIdentity,
} from '../identity.js';
import { immutableEvidence } from '../immutable.js';
import {
  EVIDENCE_ACTOR_REFERENCE_SCHEMA_VERSION,
  EVIDENCE_DELTA_SCHEMA_VERSION,
  EVIDENCE_EXHIBIT_ASSERTION_SCHEMA_VERSION,
  EVIDENCE_LOCATOR_SCHEMA_VERSION,
  EVIDENCE_MEMORY_SCHEMA_VERSION,
  EVIDENCE_NAMESPACE,
  EVIDENCE_STATE_SCHEMA_VERSION,
  EVIDENCE_STATEMENT_OCCURRENCE_SCHEMA_VERSION,
  EVIDENCE_TEMPORAL_BOUND_SCHEMA_VERSION,
  EvidenceDeltaSchema,
  EvidenceMemoryValueSchema,
  EvidenceObserveArtifactInputSchema,
  EvidenceObserveArtifactReplayOutputSchema,
  EvidenceStateSchema,
  SourceArtifactVersionSchema,
  type EvidenceActorReference,
  type EvidenceDelta,
  type EvidenceMemoryValue,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactReplayOutput,
  type EvidenceObservation,
  type EvidenceState,
  type EvidenceTemporalBound,
} from '../schemas.js';
import { evidenceDeltaInvariants, initialEvidenceState } from '../state.js';
import { evidenceObservationInvariants } from '../validation.js';

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
  return EvidenceStateSchema.parse(context.state.value);
}

type Candidate = EvidenceObserveArtifactReplayOutput['observations'][number];

type ActorCandidate =
  | {
      readonly status: 'resolved';
      readonly sourceLabel: string;
      readonly sourceRole: EvidenceActorReference['sourceRole'];
      readonly actorKey: string;
    }
  | {
      readonly status: 'unresolved';
      readonly sourceLabel: string;
      readonly sourceRole: EvidenceActorReference['sourceRole'];
      readonly candidateActorKeys: readonly string[];
    };

function actorReference(
  candidate: ActorCandidate,
  artifactVersionId: string,
  locatorId: string,
): EvidenceActorReference {
  const base = {
    schemaVersion: EVIDENCE_ACTOR_REFERENCE_SCHEMA_VERSION,
    artifactVersionId,
    locatorId,
    sourceLabel: candidate.sourceLabel,
    sourceRole: candidate.sourceRole,
  } as const;
  const resolution =
    candidate.status === 'resolved'
      ? { status: 'resolved' as const, actorKey: candidate.actorKey }
      : {
          status: 'unresolved' as const,
          candidateActorKeys: [...candidate.candidateActorKeys],
        };
  return immutableEvidence({
    ...base,
    actorReferenceKey: deriveEvidenceActorReferenceKey(base),
    resolution,
  });
}

function temporalBound(
  candidate: Candidate['temporalBound'],
  artifactVersionId: string,
  locatorId: string,
): EvidenceTemporalBound | null {
  if (candidate === null) return null;
  return immutableEvidence({
    schemaVersion: EVIDENCE_TEMPORAL_BOUND_SCHEMA_VERSION,
    artifactVersionId,
    locatorId,
    ...candidate,
  }) as EvidenceTemporalBound;
}

function observation(
  candidate: Candidate,
  input: EvidenceObserveArtifactInput,
): EvidenceObservation {
  const artifactVersionId = input.artifactVersion.artifactVersionId;
  const selectedSegment =
    'sourceSegmentId' in candidate
      ? resolveEvidenceStructuredSourceSegment(
          input.artifactVersion.text,
          candidate.sourceSegmentId,
        )
      : undefined;
  if ('sourceSegmentId' in candidate && selectedSegment === undefined) {
    throw new AcmeError({
      code: 'DOMAIN_INVALID_RESULT',
      message: 'Active observation source segment does not exist.',
      stage: 'interpreting',
      retryable: false,
    });
  }
  const exactQuote =
    'exactQuote' in candidate
      ? candidate.exactQuote
      : (selectedSegment?.exactQuote as string);
  const lineRange =
    'startLine' in candidate && 'endLine' in candidate
      ? { startLine: candidate.startLine, endLine: candidate.endLine }
      : selectedSegment !== undefined
        ? {
            startLine: selectedSegment.startLine,
            endLine: selectedSegment.endLine,
          }
        : locateUniqueEvidenceQuote(input.artifactVersion.text, exactQuote);
  if ('status' in lineRange && lineRange.status !== 'unique') {
    throw new AcmeError({
      code: 'DOMAIN_INVALID_RESULT',
      message: 'Active observation quote does not have one canonical locator.',
      stage: 'interpreting',
      retryable: false,
    });
  }
  const locatorId = deriveEvidenceLocatorId({
    artifactVersionId,
    startLine: lineRange.startLine,
    endLine: lineRange.endLine,
  });
  const locator = {
    schemaVersion: EVIDENCE_LOCATOR_SCHEMA_VERSION,
    locatorId,
    artifactVersionId,
    startLine: lineRange.startLine,
    endLine: lineRange.endLine,
  } as const;
  const temporal = temporalBound(
    candidate.temporalBound,
    artifactVersionId,
    locatorId,
  );
  const sourceActor =
    candidate.kind === 'statement-occurrence'
      ? actorReference(candidate.actorReference, artifactVersionId, locatorId)
      : candidate.sourceActorReference === null
        ? null
        : actorReference(
            candidate.sourceActorReference,
            artifactVersionId,
            locatorId,
          );
  const observationId = deriveEvidenceObservationId({
    kind: candidate.kind,
    artifactVersionId,
    locatorId,
    exactQuote,
    sourceActorReference: sourceActor,
    temporalBound: temporal,
  });
  return immutableEvidence(
    candidate.kind === 'statement-occurrence'
      ? {
          schemaVersion: EVIDENCE_STATEMENT_OCCURRENCE_SCHEMA_VERSION,
          kind: candidate.kind,
          observationId,
          artifactVersionId,
          locator,
          exactQuote,
          actorReference: sourceActor as EvidenceActorReference,
          temporalBound: temporal,
        }
      : {
          schemaVersion: EVIDENCE_EXHIBIT_ASSERTION_SCHEMA_VERSION,
          kind: candidate.kind,
          observationId,
          artifactVersionId,
          locator,
          exactQuote,
          sourceActorReference: sourceActor,
          temporalBound: temporal,
        },
  );
}

function memory(
  value: EvidenceMemoryValue,
  context: ExecutionReadContext<EvidenceState>,
  documentKey: string,
): MemoryCandidate {
  return immutableEvidence({
    key: evidenceMemoryIdentity(value),
    kind: `evidence.${value.kind === 'evidence-relation' ? 'relation' : value.kind}`,
    schemaVersion: EVIDENCE_MEMORY_SCHEMA_VERSION,
    value: value as unknown as JsonValue,
    confidence: 1,
    source: {
      executionId: context.executionId,
      contract: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF,
      documentKeys: [documentKey],
    },
  });
}

function invalidCorrection(code: string, message: string): never {
  throw new AcmeError({
    code: 'DOMAIN_INVALID_RESULT',
    message: `${code}: ${message}`,
    stage: 'preparing-commit',
    retryable: false,
  });
}

function correctionStandingChanges(
  input: EvidenceObserveArtifactInput,
  created: readonly {
    readonly identityKey: string;
    readonly objectKind: EvidenceMemoryValue['kind'];
    readonly value: EvidenceMemoryValue;
  }[],
  state: EvidenceState,
  context: ExecutionReadContext<EvidenceState>,
): {
  readonly changes: EvidenceDelta['standingChanges'];
} {
  const successorSource = input.artifactVersion;
  if (successorSource.predecessorVersionId === null || created.length === 0) {
    return { changes: [] };
  }
  const predecessorSource = context.documents
    .map(({ value }) => SourceArtifactVersionSchema.safeParse(value))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
    .find(
      ({ artifactVersionId }) =>
        artifactVersionId === successorSource.predecessorVersionId,
    );
  if (predecessorSource === undefined) {
    invalidCorrection(
      'EVIDENCE_CORRECTION_PREDECESSOR_MISSING',
      'A corrected artifact requires its exact predecessor source document in the recorded read set.',
    );
  }
  const predecessors = context.memories
    .map(({ value }) => EvidenceMemoryValueSchema.safeParse(value))
    .flatMap((parsed) =>
      parsed.success &&
      (parsed.data.kind === 'statement-occurrence' ||
        parsed.data.kind === 'exhibit-assertion') &&
      parsed.data.artifactVersionId === predecessorSource.artifactVersionId
        ? [parsed.data]
        : [],
    );
  const successors = created.flatMap(({ value }) =>
    value.kind === 'statement-occurrence' || value.kind === 'exhibit-assertion'
      ? [value]
      : [],
  );
  let pairs;
  try {
    pairs = pairEvidenceCorrectionObservations({
      predecessorSource,
      successorSource,
      predecessorObservations: predecessors,
      successorObservations: successors,
    });
  } catch (error) {
    if (error instanceof EvidenceCorrectionPairingError) {
      invalidCorrection(error.code, error.message);
    }
    throw error;
  }
  const changes = pairs
    .map(({ predecessor, successor }) => {
      const predecessorId = evidenceMemoryIdentity(predecessor);
      const prior = state.standings.find(
        ({ objectKind, objectId }) =>
          objectKind === predecessor.kind && objectId === predecessorId,
      );
      if (
        prior === undefined ||
        prior.standing === 'superseded' ||
        prior.standing === 'rejected'
      ) {
        invalidCorrection(
          'EVIDENCE_CORRECTION_PREDECESSOR_NOT_CURRENT',
          'A correction predecessor must have a current or contested standing.',
        );
      }
      return {
        objectKind: predecessor.kind,
        objectId: predecessorId,
        from: prior.standing,
        to: 'superseded' as const,
        transition: 'correction' as const,
        correctionLineage: {
          logicalArtifactId: successorSource.logicalArtifactId,
          predecessorArtifactVersionId: predecessorSource.artifactVersionId,
          successorArtifactVersionId: successorSource.artifactVersionId,
          successorObjectId: successor.observationId,
        },
      };
    })
    .sort((left, right) => left.objectId.localeCompare(right.objectId));
  return {
    changes,
  };
}

function interpretOutput(
  output: EvidenceObserveArtifactReplayOutput,
  input: EvidenceObserveArtifactInput,
  context: ExecutionReadContext<EvidenceState>,
): ModuleResult<EvidenceDelta> {
  const validatedInput = EvidenceObserveArtifactInputSchema.parse(input);
  const validatedOutput =
    EvidenceObserveArtifactReplayOutputSchema.parse(output);
  const state = readState(context);
  const observations = validatedOutput.observations.map((candidate) =>
    observation(candidate, validatedInput),
  );
  const validationIssues = observations.flatMap((value) =>
    evidenceObservationInvariants(value, validatedInput.artifactVersion),
  );
  if (validationIssues.length > 0) {
    throw new AcmeError({
      code: 'DOMAIN_INVALID_RESULT',
      message: `Evidence observation invariants failed: ${validationIssues.map(({ code }) => code).join(', ')}`,
      stage: 'interpreting',
      retryable: false,
    });
  }
  const documentKey = validatedInput.artifactVersion.artifactVersionId;
  const addSource = state.sourceDocumentIds.includes(documentKey)
    ? []
    : [documentKey];
  const correction = correctionStandingChanges(
    validatedInput,
    addSource.length === 0
      ? []
      : observations.map((value) => ({
          identityKey: evidenceMemoryIdentity(value),
          objectKind: value.kind,
          value,
        })),
    state,
    context,
  );
  return immutableEvidence({
    documents: [
      {
        key: documentKey,
        kind: 'evidence.source-artifact-version',
        schemaVersion: validatedInput.artifactVersion.schemaVersion,
        value: validatedInput.artifactVersion as unknown as JsonValue,
        contentHash: sha256(
          canonicalJson(validatedInput.artifactVersion as unknown as JsonValue),
        ),
      },
    ],
    memories: observations.map((value) => memory(value, context, documentKey)),
    stateIntent: {
      schemaVersion: EVIDENCE_DELTA_SCHEMA_VERSION,
      value: {
        schemaVersion: EVIDENCE_DELTA_SCHEMA_VERSION,
        nextEvidenceRevision:
          state.evidenceRevision + (addSource.length > 0 ? 1 : 0),
        addSourceDocumentIds: addSource,
        addAssessmentDocumentIds: [],
        addMemoryIds: [],
        standingChanges: correction.changes,
        currentRelationVersionIds: state.currentRelationVersionIds,
        currentOpenQuestionIds: state.currentOpenQuestionIds,
      },
    },
    events: [
      {
        key: `artifact-observed:${documentKey}`,
        type: 'evidence.artifact-observed',
        schemaVersion: '1.0.0',
        payload: {
          artifactVersionId: documentKey,
          observationCount: observations.length,
        },
      },
    ],
    diagnostics: [
      {
        code: 'EVIDENCE_ARTIFACT_OBSERVED',
        severity: 'info',
        value: {
          artifactVersionId: documentKey,
          observationCount: observations.length,
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
  const changes =
    direct.addSourceDocumentIds.length > 0 ||
    addMemoryIds.length > 0 ||
    direct.standingChanges.length > 0;
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

export const evidenceObserveArtifactTask = defineTask<
  EvidenceObserveArtifactInput,
  EvidenceObserveArtifactInput,
  EvidenceObserveArtifactReplayOutput,
  EvidenceState,
  EvidenceDelta
>({
  role: 'analyzer',
  inputSchema: EvidenceObserveArtifactInputSchema,
  contract: EVIDENCE_OBSERVE_ARTIFACT_CONTRACT_REF,
  project(input, context) {
    readState(context);
    return immutableEvidence(EvidenceObserveArtifactInputSchema.parse(input));
  },
  interpret(output, input, context) {
    return interpretOutput(output, input, context);
  },
  projectState(input, context) {
    return projectEvidenceState(input, context);
  },
});
