import { z } from 'zod';

const NonBlank = z.string().trim().min(1);
const Timestamp = z.iso.datetime({ offset: true });

export const EvidenceReviewWorkTargetKindSchema = z.enum([
  'observation',
  'relation',
  'assessment',
]);

export const EvidenceReviewAssignmentSchema = z
  .object({
    schemaVersion: z.literal('evidence-review-assignment/1'),
    assignmentId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    targetKind: EvidenceReviewWorkTargetKindSchema,
    targetVersionId: NonBlank,
    assigneePrincipalRef: NonBlank,
    status: z.enum(['waiting', 'in-progress', 'completed']),
    assignedByPrincipalRef: NonBlank,
    commandKey: NonBlank,
    revision: z.number().int().nonnegative(),
    createdAt: Timestamp,
    updatedAt: Timestamp,
  })
  .strict();

export const EvidenceReviewCommentSchema = z
  .object({
    schemaVersion: z.literal('evidence-review-comment/1'),
    commentId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    targetKind: EvidenceReviewWorkTargetKindSchema,
    targetVersionId: NonBlank,
    principalRef: NonBlank,
    body: NonBlank.max(4_000),
    commandKey: NonBlank,
    createdAt: Timestamp,
  })
  .strict();

export const EvidenceReviewActivitySchema = z
  .object({
    schemaVersion: z.literal('evidence-review-activity/1'),
    activityId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    targetKind: EvidenceReviewWorkTargetKindSchema,
    targetVersionId: NonBlank,
    action: z.enum([
      'assigned',
      'reassigned',
      'status-changed',
      'commented',
      'decided',
      'bulk-decided',
    ]),
    principalRef: NonBlank,
    subjectPrincipalRef: NonBlank.nullable(),
    commandKey: NonBlank,
    occurredAt: Timestamp,
  })
  .strict();

export type EvidenceReviewAssignment = z.infer<
  typeof EvidenceReviewAssignmentSchema
>;
export type EvidenceReviewComment = z.infer<typeof EvidenceReviewCommentSchema>;
export type EvidenceReviewActivity = z.infer<
  typeof EvidenceReviewActivitySchema
>;
