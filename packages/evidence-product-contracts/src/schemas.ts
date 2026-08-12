import { z } from 'zod';

import {
  EvidenceActorRosterEntrySchema,
  EvidenceAssessmentSchema,
  EvidenceChangeSetSchema,
  EvidenceIsoTimestampSchema,
  EvidenceNonBlankStringSchema,
  EvidenceObservationSchema,
  EvidenceOpenQuestionSchema,
  EvidenceRelationSchema,
  SourceArtifactVersionSchema,
} from '@acme/module-evidence';

export const EVIDENCE_WORKSPACE_SCHEMA_VERSION =
  'evidence-workspace/1' as const;
export const EVIDENCE_IMPORT_COMMAND_SCHEMA_VERSION =
  'evidence-import-command/1' as const;
export const EVIDENCE_PRODUCT_JOB_SCHEMA_VERSION =
  'evidence-product-job/1' as const;
export const EVIDENCE_REVIEW_DECISION_SCHEMA_VERSION =
  'evidence-review-decision/1' as const;
export const EVIDENCE_REVIEW_COMMAND_SCHEMA_VERSION =
  'evidence-review-command/1' as const;
export const EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION =
  'evidence-product-snapshot/1' as const;
export const EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION =
  'evidence-product-change-set/1' as const;
export const EVIDENCE_ASSESSMENT_COMMAND_SCHEMA_VERSION =
  'evidence-assessment-command/1' as const;

export const EvidenceWorkspaceSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_WORKSPACE_SCHEMA_VERSION),
    workspaceId: EvidenceNonBlankStringSchema,
    label: EvidenceNonBlankStringSchema,
    dataPolicy: z.literal('synthetic-only'),
    evidenceRevision: z.number().int().nonnegative(),
    createdAt: EvidenceIsoTimestampSchema,
  })
  .strict();

export const EvidenceImportCommandSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_IMPORT_COMMAND_SCHEMA_VERSION),
    workspaceId: EvidenceNonBlankStringSchema,
    commandKey: EvidenceNonBlankStringSchema,
    artifactVersion: SourceArtifactVersionSchema,
    actorRoster: z.array(EvidenceActorRosterEntrySchema),
  })
  .strict();

export const EvidenceProductJobPhaseSchema = z.enum([
  'queued',
  'observing',
  'completed',
  'failed',
  'cancelled',
]);

export const EvidenceProductJobSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PRODUCT_JOB_SCHEMA_VERSION),
    jobId: EvidenceNonBlankStringSchema,
    workspaceId: EvidenceNonBlankStringSchema,
    commandKey: EvidenceNonBlankStringSchema,
    artifactVersionId: EvidenceNonBlankStringSchema,
    phase: EvidenceProductJobPhaseSchema,
    completedUnits: z.number().int().nonnegative(),
    totalUnits: z.number().int().positive(),
    message: EvidenceNonBlankStringSchema,
    cancelRequested: z.boolean(),
    createdAt: EvidenceIsoTimestampSchema,
    updatedAt: EvidenceIsoTimestampSchema,
  })
  .strict()
  .refine((value) => value.completedUnits <= value.totalUnits, {
    path: ['completedUnits'],
    message: 'Completed units cannot exceed total units.',
  });

export const EvidenceProductChangeSetSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION),
    workspaceId: EvidenceNonBlankStringSchema,
    commandKey: EvidenceNonBlankStringSchema,
    recordedAt: EvidenceIsoTimestampSchema,
    changeSet: EvidenceChangeSetSchema,
  })
  .strict();

export const EvidenceAssessmentCommandSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_ASSESSMENT_COMMAND_SCHEMA_VERSION),
    workspaceId: EvidenceNonBlankStringSchema,
    commandKey: EvidenceNonBlankStringSchema,
    sequence: z.number().int().positive(),
    predecessorAssessmentVersionId: EvidenceNonBlankStringSchema.nullable(),
  })
  .strict();

export const EvidenceReviewTargetKindSchema = z.enum([
  'observation',
  'relation',
  'assessment',
]);
export const EvidenceReviewActionSchema = z.enum([
  'accept',
  'reject',
  'leave-unresolved',
  'request-revision',
  'reaffirm',
]);

function reviewBasisRule(
  value: {
    readonly action: string;
    readonly basisEvidenceRevision: number | null;
  },
  context: z.RefinementCtx,
): void {
  if (
    (value.action === 'reaffirm') !==
    (value.basisEvidenceRevision !== null)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['basisEvidenceRevision'],
      message: 'Only reaffirm requires a basis evidence revision.',
    });
  }
}

export const EvidenceReviewCommandSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_REVIEW_COMMAND_SCHEMA_VERSION),
    workspaceId: EvidenceNonBlankStringSchema,
    commandKey: EvidenceNonBlankStringSchema,
    targetKind: EvidenceReviewTargetKindSchema,
    targetVersionId: EvidenceNonBlankStringSchema,
    action: EvidenceReviewActionSchema,
    reviewerRef: EvidenceNonBlankStringSchema,
    rationale: EvidenceNonBlankStringSchema,
    basisEvidenceRevision: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .superRefine(reviewBasisRule);

export const EvidenceReviewDecisionSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_REVIEW_DECISION_SCHEMA_VERSION),
    reviewDecisionId: EvidenceNonBlankStringSchema,
    workspaceId: EvidenceNonBlankStringSchema,
    targetKind: EvidenceReviewTargetKindSchema,
    targetVersionId: EvidenceNonBlankStringSchema,
    action: EvidenceReviewActionSchema,
    reviewerRef: EvidenceNonBlankStringSchema,
    principalAssurance: z.literal('unauthenticated-local'),
    rationale: EvidenceNonBlankStringSchema,
    decidedAt: EvidenceIsoTimestampSchema,
    commandKey: EvidenceNonBlankStringSchema,
    basisEvidenceRevision: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .superRefine(reviewBasisRule);

export const EvidenceProductSnapshotSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION),
    workspaces: z.array(EvidenceWorkspaceSchema),
    sources: z.array(SourceArtifactVersionSchema),
    observations: z.array(EvidenceObservationSchema),
    relations: z.array(EvidenceRelationSchema),
    openQuestions: z.array(EvidenceOpenQuestionSchema),
    assessments: z.array(EvidenceAssessmentSchema),
    changeSets: z.array(EvidenceProductChangeSetSchema).default([]),
    jobs: z.array(EvidenceProductJobSchema),
    reviewDecisions: z.array(EvidenceReviewDecisionSchema),
  })
  .strict();

export type EvidenceWorkspace = z.infer<typeof EvidenceWorkspaceSchema>;
export type EvidenceImportCommand = z.infer<typeof EvidenceImportCommandSchema>;
export type EvidenceProductJob = z.infer<typeof EvidenceProductJobSchema>;
export type EvidenceProductChangeSet = z.infer<
  typeof EvidenceProductChangeSetSchema
>;
export type EvidenceAssessmentCommand = z.infer<
  typeof EvidenceAssessmentCommandSchema
>;
export type EvidenceReviewCommand = z.infer<typeof EvidenceReviewCommandSchema>;
export type EvidenceReviewDecision = z.infer<
  typeof EvidenceReviewDecisionSchema
>;
export type EvidenceProductSnapshot = z.infer<
  typeof EvidenceProductSnapshotSchema
>;
