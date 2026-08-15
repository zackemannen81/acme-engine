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
import {
  EvidenceAuthorizationContextSchema,
  EvidenceCaseDataPolicySchema,
  EvidenceCaseAuthorizationContextSchema,
} from '@acme/evidence-auth';
import {
  EvidenceArtifactLifecycleEventSchema,
  EvidenceArtifactObjectEnvelopeSchema,
  EvidenceArtifactRepresentationSchema,
  EvidenceArtifactStagingSchema,
  EvidenceSecurityAuditEventSchema,
} from '@acme/evidence-artifacts';
import {
  EvidenceRedactionDraftSchema,
  EvidenceRedactionLogSchema,
  EvidenceTextImportRecordSchema,
} from './ingestion.js';
import {
  EvidenceExportAuditRecordSchema,
  EvidenceExportPolicySchema,
} from './export-operation-schemas.js';
import {
  EvidenceReviewActivitySchema,
  EvidenceReviewAssignmentSchema,
  EvidenceReviewCommentSchema,
} from './review-operation-schemas.js';

export const EVIDENCE_ENCRYPTED_SOURCE_PLACEHOLDER =
  '[ACME encrypted artifact representation]' as const;

export const EVIDENCE_WORKSPACE_SCHEMA_VERSION =
  'evidence-workspace/1' as const;
export const EVIDENCE_IMPORT_COMMAND_SCHEMA_VERSION =
  'evidence-import-command/1' as const;
export const EVIDENCE_PRODUCT_JOB_SCHEMA_VERSION =
  'evidence-product-job/1' as const;
export const EVIDENCE_LIVE_OBSERVATION_JOB_SCHEMA_VERSION =
  'evidence-product-job/2' as const;
export const EVIDENCE_LIVE_RELATION_JOB_SCHEMA_VERSION =
  'evidence-product-job/3' as const;
export const EVIDENCE_REVIEW_DECISION_SCHEMA_VERSION =
  'evidence-review-decision/1' as const;
export const EVIDENCE_REVIEW_COMMAND_SCHEMA_VERSION =
  'evidence-review-command/1' as const;
export const EVIDENCE_AUTHENTICATED_REVIEW_COMMAND_SCHEMA_VERSION =
  'evidence-review-command/2' as const;
export const EVIDENCE_AUTHENTICATED_REVIEW_DECISION_SCHEMA_VERSION =
  'evidence-review-decision/2' as const;
export const EVIDENCE_CASE_REVIEW_COMMAND_SCHEMA_VERSION =
  'evidence-review-command/3' as const;
export const EVIDENCE_CASE_REVIEW_DECISION_SCHEMA_VERSION =
  'evidence-review-decision/3' as const;
export const EVIDENCE_PRODUCT_SNAPSHOT_SCHEMA_VERSION =
  'evidence-product-snapshot/1' as const;
export const EVIDENCE_PRODUCT_CHANGE_SET_SCHEMA_VERSION =
  'evidence-product-change-set/1' as const;
export const EVIDENCE_ASSESSMENT_COMMAND_SCHEMA_VERSION =
  'evidence-assessment-command/1' as const;
export const EVIDENCE_CASE_OBJECT_BINDING_SCHEMA_VERSION =
  'evidence-case-object-binding/1' as const;

export const EvidenceCaseObjectKindSchema = z.enum([
  'workspace',
  'source',
  'observation',
  'relation',
  'open-question',
  'assessment',
  'change-set',
  'job',
  'review-decision',
  'artifact-representation',
  'artifact-envelope',
  'artifact-staging',
  'artifact-lifecycle',
  'security-audit',
  'text-import',
  'redaction-draft',
  'redaction-log',
  'review-assignment',
  'review-comment',
  'review-activity',
  'export-policy',
  'export-audit-record',
]);

export const EvidenceCaseObjectBindingSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_CASE_OBJECT_BINDING_SCHEMA_VERSION),
    caseId: EvidenceNonBlankStringSchema,
    workspaceId: EvidenceNonBlankStringSchema,
    objectKind: EvidenceCaseObjectKindSchema,
    objectId: EvidenceNonBlankStringSchema,
    boundAt: EvidenceIsoTimestampSchema,
  })
  .strict();

export const EvidenceCaseObjectScopeSchema = z
  .object({
    caseId: EvidenceNonBlankStringSchema,
    workspaceId: EvidenceNonBlankStringSchema,
    boundAt: EvidenceIsoTimestampSchema,
  })
  .strict();

export const EvidenceWorkspaceSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_WORKSPACE_SCHEMA_VERSION),
    workspaceId: EvidenceNonBlankStringSchema,
    label: EvidenceNonBlankStringSchema,
    dataPolicy: EvidenceCaseDataPolicySchema,
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

export const EvidenceLiveObservationJobPhaseSchema = z.enum([
  'queued',
  'hydrating',
  'observing',
  'projecting',
  'completed',
  'failed',
  'cancelled',
  'refused',
]);

export const EvidenceLiveObservationJobSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_LIVE_OBSERVATION_JOB_SCHEMA_VERSION),
    jobKind: z.literal('live-observation'),
    jobId: EvidenceNonBlankStringSchema,
    workspaceId: EvidenceNonBlankStringSchema,
    commandKey: EvidenceNonBlankStringSchema,
    artifactVersionId: EvidenceNonBlankStringSchema,
    task: z.literal('observe-artifact'),
    modelId: EvidenceNonBlankStringSchema,
    phase: EvidenceLiveObservationJobPhaseSchema,
    completedUnits: z.number().int().nonnegative(),
    totalUnits: z.literal(4),
    message: EvidenceNonBlankStringSchema,
    cancelRequested: z.boolean(),
    maxModelCalls: z.literal(1),
    actualModelCalls: z.number().int().min(0).max(1),
    costCeilingMinor: z.number().int().nonnegative().nullable(),
    currency: EvidenceNonBlankStringSchema.nullable(),
    reasonCode: EvidenceNonBlankStringSchema.nullable(),
    executionId: EvidenceNonBlankStringSchema.nullable(),
    createdAt: EvidenceIsoTimestampSchema,
    updatedAt: EvidenceIsoTimestampSchema,
  })
  .strict()
  .refine((value) => value.completedUnits <= value.totalUnits, {
    path: ['completedUnits'],
    message: 'Completed units cannot exceed total units.',
  });

export const EvidenceLiveRelationJobSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_LIVE_RELATION_JOB_SCHEMA_VERSION),
    jobKind: z.literal('live-relation'),
    jobId: EvidenceNonBlankStringSchema,
    workspaceId: EvidenceNonBlankStringSchema,
    commandKey: EvidenceNonBlankStringSchema,
    artifactVersionId: z.literal('case-observation-set'),
    observationIds: z.array(EvidenceNonBlankStringSchema).min(2),
    task: z.literal('relate-observations'),
    modelId: EvidenceNonBlankStringSchema,
    phase: z.enum([
      'queued',
      'preparing',
      'relating',
      'projecting',
      'completed',
      'failed',
      'cancelled',
      'refused',
    ]),
    completedUnits: z.number().int().nonnegative(),
    totalUnits: z.literal(4),
    message: EvidenceNonBlankStringSchema,
    cancelRequested: z.boolean(),
    maxModelCalls: z.literal(1),
    actualModelCalls: z.number().int().min(0).max(1),
    costCeilingMinor: z.number().int().nonnegative().nullable(),
    currency: EvidenceNonBlankStringSchema.nullable(),
    reasonCode: EvidenceNonBlankStringSchema.nullable(),
    executionId: EvidenceNonBlankStringSchema.nullable(),
    createdAt: EvidenceIsoTimestampSchema,
    updatedAt: EvidenceIsoTimestampSchema,
  })
  .strict()
  .refine((value) => value.completedUnits <= value.totalUnits, {
    path: ['completedUnits'],
    message: 'Completed units cannot exceed total units.',
  });

export const EvidenceAnyProductJobSchema = z.discriminatedUnion(
  'schemaVersion',
  [
    EvidenceProductJobSchema,
    EvidenceLiveObservationJobSchema,
    EvidenceLiveRelationJobSchema,
  ],
);

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

export const EvidenceCaseImportCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-case-import-command/1'),
    commandKey: EvidenceNonBlankStringSchema,
    artifactVersion: SourceArtifactVersionSchema,
    actorRoster: z.array(EvidenceActorRosterEntrySchema),
  })
  .strict();

export const EvidenceCaseAssessmentCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-case-assessment-command/1'),
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

export const EvidenceAuthenticatedReviewCommandSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_AUTHENTICATED_REVIEW_COMMAND_SCHEMA_VERSION,
    ),
    workspaceId: EvidenceNonBlankStringSchema,
    commandKey: EvidenceNonBlankStringSchema,
    targetKind: EvidenceReviewTargetKindSchema,
    targetVersionId: EvidenceNonBlankStringSchema,
    action: EvidenceReviewActionSchema,
    rationale: EvidenceNonBlankStringSchema,
    basisEvidenceRevision: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .superRefine(reviewBasisRule);

export const EvidenceCaseReviewCommandSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_CASE_REVIEW_COMMAND_SCHEMA_VERSION),
    commandKey: EvidenceNonBlankStringSchema,
    targetKind: EvidenceReviewTargetKindSchema,
    targetVersionId: EvidenceNonBlankStringSchema,
    action: EvidenceReviewActionSchema,
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

export const EvidenceAuthenticatedReviewDecisionSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_AUTHENTICATED_REVIEW_DECISION_SCHEMA_VERSION,
    ),
    reviewDecisionId: EvidenceNonBlankStringSchema,
    workspaceId: EvidenceNonBlankStringSchema,
    targetKind: EvidenceReviewTargetKindSchema,
    targetVersionId: EvidenceNonBlankStringSchema,
    action: EvidenceReviewActionSchema,
    principalRef: EvidenceNonBlankStringSchema,
    principalAssurance: z.literal('authenticated-session'),
    authorization: EvidenceAuthorizationContextSchema,
    rationale: EvidenceNonBlankStringSchema,
    decidedAt: EvidenceIsoTimestampSchema,
    commandKey: EvidenceNonBlankStringSchema,
    basisEvidenceRevision: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .superRefine(reviewBasisRule);

export const EvidenceCaseReviewDecisionSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_CASE_REVIEW_DECISION_SCHEMA_VERSION),
    reviewDecisionId: EvidenceNonBlankStringSchema,
    caseId: EvidenceNonBlankStringSchema,
    workspaceId: EvidenceNonBlankStringSchema,
    targetKind: EvidenceReviewTargetKindSchema,
    targetVersionId: EvidenceNonBlankStringSchema,
    action: EvidenceReviewActionSchema,
    principalRef: EvidenceNonBlankStringSchema,
    principalAssurance: z.literal('authenticated-case-session'),
    authorization: EvidenceCaseAuthorizationContextSchema,
    rationale: EvidenceNonBlankStringSchema,
    decidedAt: EvidenceIsoTimestampSchema,
    commandKey: EvidenceNonBlankStringSchema,
    basisEvidenceRevision: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .superRefine(reviewBasisRule);

export const EvidenceReviewDecisionRecordSchema = z.union([
  EvidenceReviewDecisionSchema,
  EvidenceAuthenticatedReviewDecisionSchema,
  EvidenceCaseReviewDecisionSchema,
]);

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
    jobs: z.array(EvidenceAnyProductJobSchema),
    reviewDecisions: z.array(EvidenceReviewDecisionRecordSchema),
    objectBindings: z.array(EvidenceCaseObjectBindingSchema).default([]),
    artifactRepresentations: z
      .array(EvidenceArtifactRepresentationSchema)
      .default([]),
    artifactEnvelopes: z
      .array(EvidenceArtifactObjectEnvelopeSchema)
      .default([]),
    artifactStaging: z.array(EvidenceArtifactStagingSchema).default([]),
    artifactLifecycle: z
      .array(EvidenceArtifactLifecycleEventSchema)
      .default([]),
    securityAudit: z.array(EvidenceSecurityAuditEventSchema).default([]),
    textImports: z.array(EvidenceTextImportRecordSchema).default([]),
    redactionDrafts: z.array(EvidenceRedactionDraftSchema).default([]),
    redactionLogs: z.array(EvidenceRedactionLogSchema).default([]),
    reviewAssignments: z.array(EvidenceReviewAssignmentSchema).default([]),
    reviewComments: z.array(EvidenceReviewCommentSchema).default([]),
    reviewActivity: z.array(EvidenceReviewActivitySchema).default([]),
    exportPolicies: z.array(EvidenceExportPolicySchema).default([]),
    exportAuditRecords: z.array(EvidenceExportAuditRecordSchema).default([]),
  })
  .strict();

export type EvidenceWorkspace = z.infer<typeof EvidenceWorkspaceSchema>;
export type EvidenceImportCommand = z.infer<typeof EvidenceImportCommandSchema>;
export type EvidenceSyntheticProductJob = z.infer<
  typeof EvidenceProductJobSchema
>;
export type EvidenceLiveObservationJob = z.infer<
  typeof EvidenceLiveObservationJobSchema
>;
export type EvidenceLiveRelationJob = z.infer<
  typeof EvidenceLiveRelationJobSchema
>;
export type EvidenceProductJob = z.infer<typeof EvidenceAnyProductJobSchema>;
export type EvidenceProductChangeSet = z.infer<
  typeof EvidenceProductChangeSetSchema
>;
export type EvidenceAssessmentCommand = z.infer<
  typeof EvidenceAssessmentCommandSchema
>;
export type EvidenceCaseImportCommand = z.infer<
  typeof EvidenceCaseImportCommandSchema
>;
export type EvidenceCaseAssessmentCommand = z.infer<
  typeof EvidenceCaseAssessmentCommandSchema
>;
export type EvidenceReviewCommand = z.infer<typeof EvidenceReviewCommandSchema>;
export type EvidenceAuthenticatedReviewCommand = z.infer<
  typeof EvidenceAuthenticatedReviewCommandSchema
>;
export type EvidenceCaseReviewCommand = z.infer<
  typeof EvidenceCaseReviewCommandSchema
>;
export type EvidenceLegacyReviewDecision = z.infer<
  typeof EvidenceReviewDecisionSchema
>;
export type EvidenceAuthenticatedReviewDecision = z.infer<
  typeof EvidenceAuthenticatedReviewDecisionSchema
>;
export type EvidenceReviewDecision = z.infer<
  typeof EvidenceReviewDecisionRecordSchema
>;
export type EvidenceProductSnapshot = z.infer<
  typeof EvidenceProductSnapshotSchema
>;
export type EvidenceCaseObjectKind = z.infer<
  typeof EvidenceCaseObjectKindSchema
>;
export type EvidenceCaseObjectBinding = z.infer<
  typeof EvidenceCaseObjectBindingSchema
>;
export type EvidenceCaseObjectScope = z.infer<
  typeof EvidenceCaseObjectScopeSchema
>;
