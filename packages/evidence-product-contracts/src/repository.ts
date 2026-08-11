import type {
  EvidenceObservation,
  EvidenceOpenQuestion,
  EvidenceRelation,
  SourceArtifactVersion,
} from '@acme/module-evidence';

import type {
  EvidenceProductJob,
  EvidenceProductSnapshot,
  EvidenceReviewCommand,
  EvidenceReviewDecision,
  EvidenceWorkspace,
} from './schemas.js';

export interface EvidenceProductClock {
  now(): string;
}

export interface EvidenceProductIds {
  next(kind: 'review-decision'): string;
}

export interface EvidenceProductRepository {
  snapshot(): Promise<EvidenceProductSnapshot>;
  putWorkspace(workspace: EvidenceWorkspace): Promise<EvidenceWorkspace>;
  putSource(source: SourceArtifactVersion): Promise<SourceArtifactVersion>;
  putObservations(
    observations: readonly EvidenceObservation[],
  ): Promise<readonly EvidenceObservation[]>;
  putRelations(
    relations: readonly EvidenceRelation[],
  ): Promise<readonly EvidenceRelation[]>;
  putOpenQuestions(
    openQuestions: readonly EvidenceOpenQuestion[],
  ): Promise<readonly EvidenceOpenQuestion[]>;
  putJob(job: EvidenceProductJob): Promise<EvidenceProductJob>;
  appendReviewDecision(
    decision: EvidenceReviewDecision,
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
