import {
  AcmeError,
  defineTask,
  type ExecutionReadContext,
  type JsonValue,
  type ModuleResult,
  type StateDelta,
  type StateProjectionInput,
} from '@acme/core';

import { EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF } from '../catalogue.js';
import {
  deriveEvidenceAssessmentContentHash,
  deriveEvidenceAssessmentId,
} from '../identity.js';
import { immutableEvidence } from '../immutable.js';
import {
  EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
  EVIDENCE_DELTA_SCHEMA_VERSION,
  EVIDENCE_NAMESPACE,
  EVIDENCE_STATE_SCHEMA_VERSION,
  EvidenceAssessmentSchema,
  EvidenceDeltaSchema,
  EvidenceProposeAssessmentInputSchema,
  EvidenceProposeAssessmentOutputSchema,
  EvidenceStateSchema,
  type EvidenceAssessment,
  type EvidenceDelta,
  type EvidenceProposeAssessmentInput,
  type EvidenceProposeAssessmentOutput,
  type EvidenceState,
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
  return EvidenceStateSchema.parse(context.state.value);
}

function buildAssessment(
  input: EvidenceProposeAssessmentInput,
  output: EvidenceProposeAssessmentOutput,
): EvidenceAssessment {
  const claims = output.claims.map((claim) => ({
    ...claim,
    supportObservationIds: [...claim.supportObservationIds].sort(),
    conflictRelationIds: [...claim.conflictRelationIds].sort(),
    qualificationRelationIds: [...claim.qualificationRelationIds].sort(),
  }));
  const openQuestionIds = [...output.openQuestionIds].sort();
  const citations = [...output.citations].sort((left, right) =>
    left.evidenceId.localeCompare(right.evidenceId),
  );
  const content = {
    claims,
    openQuestionIds,
    citations,
    predecessorAssessmentVersionId: input.predecessorAssessmentVersionId,
  } as unknown as JsonValue;
  const contentHash = deriveEvidenceAssessmentContentHash(content);
  const assessmentVersionId = deriveEvidenceAssessmentId({
    workspaceId: input.workspaceId,
    sequence: input.sequence,
    basisEvidenceRevision: input.basisEvidenceRevision,
    contentHash,
  });
  return EvidenceAssessmentSchema.parse({
    schemaVersion: EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
    assessmentVersionId,
    workspaceId: input.workspaceId,
    sequence: input.sequence,
    basisEvidenceRevision: input.basisEvidenceRevision,
    contentHash,
    claims,
    openQuestionIds,
    citations,
    predecessorAssessmentVersionId: input.predecessorAssessmentVersionId,
  });
}

function interpretOutput(
  output: EvidenceProposeAssessmentOutput,
  input: EvidenceProposeAssessmentInput,
  context: ExecutionReadContext<EvidenceState>,
): ModuleResult<EvidenceDelta> {
  const validatedInput = EvidenceProposeAssessmentInputSchema.parse(input);
  const validatedOutput = EvidenceProposeAssessmentOutputSchema.parse(output);
  const state = readState(context);
  if (validatedInput.basisEvidenceRevision > state.evidenceRevision) {
    throw new AcmeError({
      code: 'DOMAIN_INVALID_RESULT',
      message:
        'Assessment basisEvidenceRevision cannot exceed current evidence revision.',
      stage: 'interpreting',
      retryable: false,
    });
  }
  const assessment = buildAssessment(validatedInput, validatedOutput);
  const already = state.assessmentDocumentIds.includes(
    assessment.assessmentVersionId,
  );
  return immutableEvidence({
    documents: [
      {
        key: assessment.assessmentVersionId,
        kind: 'evidence.assessment-version',
        schemaVersion: assessment.schemaVersion,
        value: assessment as unknown as JsonValue,
        contentHash: assessment.contentHash,
      },
    ],
    memories: [],
    stateIntent: {
      schemaVersion: EVIDENCE_DELTA_SCHEMA_VERSION,
      value: {
        schemaVersion: EVIDENCE_DELTA_SCHEMA_VERSION,
        // Assessment documents do not increment evidence revision.
        nextEvidenceRevision: state.evidenceRevision,
        addSourceDocumentIds: [],
        addAssessmentDocumentIds: already
          ? []
          : [assessment.assessmentVersionId],
        addMemoryIds: [],
        standingChanges: already
          ? []
          : [
              {
                objectKind: 'assessment-version',
                objectId: assessment.assessmentVersionId,
                from: null,
                to: 'current',
                transition: 'create',
                correctionLineage: null,
              },
            ],
        currentRelationVersionIds: state.currentRelationVersionIds,
        currentOpenQuestionIds: state.currentOpenQuestionIds,
      },
    },
    events: [
      {
        key: `assessment-proposed:${assessment.assessmentVersionId}`,
        type: 'evidence.assessment-proposed',
        schemaVersion: '1.0.0',
        payload: {
          assessmentVersionId: assessment.assessmentVersionId,
          sequence: assessment.sequence,
        },
      },
    ],
    diagnostics: [
      {
        code: 'EVIDENCE_ASSESSMENT_PROPOSED',
        severity: 'info',
        value: {
          assessmentVersionId: assessment.assessmentVersionId,
          basisEvidenceRevision: assessment.basisEvidenceRevision,
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
  const issues = evidenceDeltaInvariants(state, direct);
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
    value: direct,
  });
}

export const evidenceProposeAssessmentTask = defineTask<
  EvidenceProposeAssessmentInput,
  EvidenceProposeAssessmentInput,
  EvidenceProposeAssessmentOutput,
  EvidenceState,
  EvidenceDelta
>({
  role: 'producer',
  inputSchema: EvidenceProposeAssessmentInputSchema,
  contract: EVIDENCE_PROPOSE_ASSESSMENT_CONTRACT_REF,
  project(input, context) {
    readState(context);
    return immutableEvidence(EvidenceProposeAssessmentInputSchema.parse(input));
  },
  interpret(output, input, context) {
    return interpretOutput(output, input, context);
  },
  projectState(input, context) {
    return projectEvidenceState(input, context);
  },
});
