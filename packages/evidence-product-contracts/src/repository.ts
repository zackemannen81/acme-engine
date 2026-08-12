import type {
  EvidenceAssessment,
  EvidenceObservation,
  EvidenceOpenQuestion,
  EvidenceRelation,
  SourceArtifactVersion,
} from '@acme/module-evidence';
import type {
  EvidenceArtifactLifecycleEvent,
  EvidenceArtifactObjectEnvelope,
  EvidenceArtifactRepresentation,
  EvidenceArtifactStaging,
  EvidenceSecurityAuditEvent,
} from '@acme/evidence-artifacts';

import type {
  EvidenceProductJob,
  EvidenceProductChangeSet,
  EvidenceProductSnapshot,
  EvidenceReviewCommand,
  EvidenceReviewDecision,
  EvidenceAuthenticatedReviewCommand,
  EvidenceCaseReviewCommand,
  EvidenceCaseObjectBinding,
  EvidenceCaseObjectScope,
  EvidenceWorkspace,
} from './schemas.js';
import type {
  EvidenceRedactionDraft,
  EvidenceRedactionLog,
  EvidenceTextImportRecord,
} from './ingestion.js';
import type {
  EvidenceReviewActivity,
  EvidenceReviewAssignment,
  EvidenceReviewComment,
} from './operations.js';

export interface EvidenceProductClock {
  now(): string;
}

export interface EvidenceProductIds {
  next(kind: 'review-decision'): string;
}

export interface EvidenceArtifactReadAuditContext {
  readonly organizationId: string;
  readonly principalRef: string;
  readonly requestId: string;
  readonly policyVersion: string;
}

export interface EvidenceProductRepository {
  snapshot(): Promise<EvidenceProductSnapshot>;
  caseSnapshot(
    caseId: string,
    workspaceId: string,
    audit?: EvidenceArtifactReadAuditContext,
  ): Promise<EvidenceProductSnapshot>;
  bindCaseObjects(
    bindings: readonly EvidenceCaseObjectBinding[],
  ): Promise<readonly EvidenceCaseObjectBinding[]>;
  putTextImport(
    record: EvidenceTextImportRecord,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceTextImportRecord>;
  putRedactionDraft(
    draft: EvidenceRedactionDraft,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceRedactionDraft>;
  applyRedaction(
    draft: EvidenceRedactionDraft,
    log: EvidenceRedactionLog,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceRedactionLog>;
  putReviewAssignment(
    assignment: EvidenceReviewAssignment,
    activity: EvidenceReviewActivity,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceReviewAssignment>;
  appendReviewComment(
    comment: EvidenceReviewComment,
    activity: EvidenceReviewActivity,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceReviewComment>;
  appendReviewActivity(
    activity: EvidenceReviewActivity,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceReviewActivity>;
  appendReviewDecisions(
    decisions: readonly EvidenceReviewDecision[],
    activities: readonly EvidenceReviewActivity[],
    scope: EvidenceCaseObjectScope,
  ): Promise<readonly EvidenceReviewDecision[]>;
  stageArtifact(
    staging: EvidenceArtifactStaging,
    audit: EvidenceSecurityAuditEvent,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceArtifactStaging>;
  activateArtifactSource(
    source: SourceArtifactVersion,
    representation: EvidenceArtifactRepresentation,
    envelope: EvidenceArtifactObjectEnvelope,
    lifecycle: EvidenceArtifactLifecycleEvent,
    audit: EvidenceSecurityAuditEvent,
    scope: EvidenceCaseObjectScope,
  ): Promise<SourceArtifactVersion>;
  appendSecurityAudit(
    audit: EvidenceSecurityAuditEvent,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceSecurityAuditEvent>;
  updateArtifactEnvelope(
    envelope: EvidenceArtifactObjectEnvelope,
    lifecycle: EvidenceArtifactLifecycleEvent,
    audit: EvidenceSecurityAuditEvent,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceArtifactObjectEnvelope>;
  appendArtifactLifecycle(
    lifecycle: EvidenceArtifactLifecycleEvent,
    audit: EvidenceSecurityAuditEvent,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceArtifactLifecycleEvent>;
  quarantineArtifactStaging(
    stagingId: string,
    lifecycle: EvidenceArtifactLifecycleEvent,
    audit: EvidenceSecurityAuditEvent,
    scope: EvidenceCaseObjectScope,
  ): Promise<EvidenceArtifactStaging>;
  putWorkspace(
    workspace: EvidenceWorkspace,
    scope?: EvidenceCaseObjectScope,
  ): Promise<EvidenceWorkspace>;
  putSource(
    source: SourceArtifactVersion,
    scope?: EvidenceCaseObjectScope,
  ): Promise<SourceArtifactVersion>;
  putObservations(
    observations: readonly EvidenceObservation[],
    scope?: EvidenceCaseObjectScope,
  ): Promise<readonly EvidenceObservation[]>;
  putRelations(
    relations: readonly EvidenceRelation[],
    scope?: EvidenceCaseObjectScope,
  ): Promise<readonly EvidenceRelation[]>;
  putOpenQuestions(
    openQuestions: readonly EvidenceOpenQuestion[],
    scope?: EvidenceCaseObjectScope,
  ): Promise<readonly EvidenceOpenQuestion[]>;
  putAssessments(
    assessments: readonly EvidenceAssessment[],
    scope?: EvidenceCaseObjectScope,
  ): Promise<readonly EvidenceAssessment[]>;
  putChangeSet(
    changeSet: EvidenceProductChangeSet,
    scope?: EvidenceCaseObjectScope,
  ): Promise<EvidenceProductChangeSet>;
  putJob(
    job: EvidenceProductJob,
    scope?: EvidenceCaseObjectScope,
  ): Promise<EvidenceProductJob>;
  appendReviewDecision(
    decision: EvidenceReviewDecision,
    scope?: EvidenceCaseObjectScope,
  ): Promise<EvidenceReviewDecision>;
  advanceEvidenceRevision(
    workspaceId: string,
    expectedRevision: number,
    nextRevision: number,
  ): Promise<EvidenceWorkspace>;
}

export class EvidenceProductCommandCollisionError extends Error {
  readonly code = 'EVIDENCE_PRODUCT_COMMAND_COLLISION';
  constructor(commandKey: string) {
    super(`Command key ${commandKey} was already used with different content.`);
    this.name = 'EvidenceProductCommandCollisionError';
  }
}

export async function recordReviewDecision(
  repository: EvidenceProductRepository,
  command: EvidenceReviewCommand,
  clock: EvidenceProductClock,
  ids: EvidenceProductIds,
): Promise<EvidenceReviewDecision> {
  const { EvidenceReviewCommandSchema, EvidenceReviewDecisionSchema } =
    await import('./schemas.js');
  const validated = EvidenceReviewCommandSchema.parse(command);
  return repository.appendReviewDecision(
    EvidenceReviewDecisionSchema.parse({
      schemaVersion: 'evidence-review-decision/1',
      reviewDecisionId: ids.next('review-decision'),
      workspaceId: validated.workspaceId,
      targetKind: validated.targetKind,
      targetVersionId: validated.targetVersionId,
      action: validated.action,
      reviewerRef: validated.reviewerRef,
      principalAssurance: 'unauthenticated-local',
      rationale: validated.rationale,
      decidedAt: clock.now(),
      commandKey: validated.commandKey,
      basisEvidenceRevision: validated.basisEvidenceRevision,
    }),
  );
}

export async function recordAuthenticatedReviewDecision(
  repository: EvidenceProductRepository,
  command: EvidenceAuthenticatedReviewCommand,
  authorization: import('@acme/evidence-auth').EvidenceAuthorizationContext,
  clock: EvidenceProductClock,
  ids: EvidenceProductIds,
): Promise<EvidenceReviewDecision> {
  const {
    EvidenceAuthenticatedReviewCommandSchema,
    EvidenceAuthenticatedReviewDecisionSchema,
  } = await import('./schemas.js');
  const validated = EvidenceAuthenticatedReviewCommandSchema.parse(command);
  if (
    authorization.action !== 'review.decide' ||
    authorization.workspaceId !== validated.workspaceId
  ) {
    throw new Error('Review authorization context does not match command.');
  }
  return repository.appendReviewDecision(
    EvidenceAuthenticatedReviewDecisionSchema.parse({
      schemaVersion: 'evidence-review-decision/2',
      reviewDecisionId: ids.next('review-decision'),
      workspaceId: validated.workspaceId,
      targetKind: validated.targetKind,
      targetVersionId: validated.targetVersionId,
      action: validated.action,
      principalRef: authorization.principalRef,
      principalAssurance: 'authenticated-session',
      authorization,
      rationale: validated.rationale,
      decidedAt: clock.now(),
      commandKey: validated.commandKey,
      basisEvidenceRevision: validated.basisEvidenceRevision,
    }),
  );
}

export async function recordCaseReviewDecision(
  repository: EvidenceProductRepository,
  command: EvidenceCaseReviewCommand,
  authorization: import('@acme/evidence-auth').EvidenceCaseAuthorizationContext,
  clock: EvidenceProductClock,
  ids: EvidenceProductIds,
): Promise<EvidenceReviewDecision> {
  const { EvidenceCaseReviewCommandSchema, EvidenceCaseReviewDecisionSchema } =
    await import('./schemas.js');
  const { EvidenceReviewActivitySchema, deriveEvidenceReviewOperationId } =
    await import('./operations.js');
  const validated = EvidenceCaseReviewCommandSchema.parse(command);
  if (
    authorization.action !== 'review.decide' ||
    authorization.caseId === null ||
    authorization.workspaceId === null
  )
    throw new Error('Case review authorization context is incomplete.');
  const decidedAt = clock.now();
  const decision = EvidenceCaseReviewDecisionSchema.parse({
    schemaVersion: 'evidence-review-decision/3',
    reviewDecisionId: ids.next('review-decision'),
    caseId: authorization.caseId,
    workspaceId: authorization.workspaceId,
    targetKind: validated.targetKind,
    targetVersionId: validated.targetVersionId,
    action: validated.action,
    principalRef: authorization.principalRef,
    principalAssurance: 'authenticated-case-session',
    authorization,
    rationale: validated.rationale,
    decidedAt,
    commandKey: validated.commandKey,
    basisEvidenceRevision: validated.basisEvidenceRevision,
  });
  const [recorded] = await repository.appendReviewDecisions(
    [decision],
    [
      EvidenceReviewActivitySchema.parse({
        schemaVersion: 'evidence-review-activity/1',
        activityId: deriveEvidenceReviewOperationId('activity', {
          caseId: authorization.caseId,
          commandKey: validated.commandKey,
        }),
        organizationId: authorization.organizationId,
        caseId: authorization.caseId,
        workspaceId: authorization.workspaceId,
        targetKind: validated.targetKind,
        targetVersionId: validated.targetVersionId,
        action: 'decided',
        principalRef: authorization.principalRef,
        subjectPrincipalRef: null,
        commandKey: validated.commandKey,
        occurredAt: decidedAt,
      }),
    ],
    {
      caseId: authorization.caseId,
      workspaceId: authorization.workspaceId,
      boundAt: decidedAt,
    },
  );
  if (recorded === undefined)
    throw new Error('Review decision was not recorded.');
  return recorded;
}
