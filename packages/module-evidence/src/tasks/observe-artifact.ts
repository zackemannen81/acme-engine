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
  EvidenceObserveArtifactOutputSchema,
  EvidenceStateSchema,
  type EvidenceActorReference,
  type EvidenceDelta,
  type EvidenceMemoryValue,
  type EvidenceObserveArtifactInput,
  type EvidenceObserveArtifactOutput,
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

type Candidate = EvidenceObserveArtifactOutput['observations'][number];

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
  const locatorId = deriveEvidenceLocatorId({
    artifactVersionId,
    startLine: candidate.startLine,
    endLine: candidate.endLine,
  });
  const locator = {
    schemaVersion: EVIDENCE_LOCATOR_SCHEMA_VERSION,
    locatorId,
    artifactVersionId,
    startLine: candidate.startLine,
    endLine: candidate.endLine,
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
    exactQuote: candidate.exactQuote,
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
          exactQuote: candidate.exactQuote,
          actorReference: sourceActor as EvidenceActorReference,
          temporalBound: temporal,
        }
      : {
          schemaVersion: EVIDENCE_EXHIBIT_ASSERTION_SCHEMA_VERSION,
          kind: candidate.kind,
          observationId,
          artifactVersionId,
          locator,
          exactQuote: candidate.exactQuote,
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

function interpretOutput(
  output: EvidenceObserveArtifactOutput,
  input: EvidenceObserveArtifactInput,
  context: ExecutionReadContext<EvidenceState>,
): ModuleResult<EvidenceDelta> {
  const validatedInput = EvidenceObserveArtifactInputSchema.parse(input);
  const validatedOutput = EvidenceObserveArtifactOutputSchema.parse(output);
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
        standingChanges: [],
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
      return { identityKey, objectKind: value.kind } as const;
    })
    .filter(({ identityKey }) => !state.memoryIds.includes(identityKey))
    .sort((left, right) => left.identityKey.localeCompare(right.identityKey));
  const addMemoryIds = created.map(({ identityKey }) => identityKey);
  const standingChanges = created.map(({ identityKey, objectKind }) => ({
    objectKind,
    objectId: identityKey,
    from: null,
    to: 'current' as const,
    transition: 'create' as const,
    correctionLineage: null,
  }));
  const changes =
    direct.addSourceDocumentIds.length > 0 || addMemoryIds.length > 0;
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
  EvidenceObserveArtifactOutput,
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
