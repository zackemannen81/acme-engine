import { canonicalJson, sha256 } from '@acme/core';
import { z } from 'zod';

import { effectiveReviewDecision } from './review.js';
import type { EvidenceProductSnapshot } from './schemas.js';

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

export const EvidenceReviewAssignmentCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-review-assignment-command/1'),
    commandKey: NonBlank,
    targetKind: EvidenceReviewWorkTargetKindSchema,
    targetVersionId: NonBlank,
    assigneePrincipalRef: NonBlank,
    status: z.enum(['waiting', 'in-progress', 'completed']),
    expectedRevision: z.number().int().min(-1),
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

export const EvidenceReviewCommentCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-review-comment-command/1'),
    commandKey: NonBlank,
    targetKind: EvidenceReviewWorkTargetKindSchema,
    targetVersionId: NonBlank,
    body: NonBlank.max(4_000),
  })
  .strict();

export const EvidenceBulkReviewCommandSchema = z
  .object({
    schemaVersion: z.literal('evidence-bulk-review-command/1'),
    commandKey: NonBlank,
    targets: z
      .array(
        z
          .object({
            targetKind: EvidenceReviewWorkTargetKindSchema,
            targetVersionId: NonBlank,
          })
          .strict(),
      )
      .min(1)
      .max(50),
    action: z.enum([
      'accept',
      'reject',
      'leave-unresolved',
      'request-revision',
      'reaffirm',
    ]),
    rationale: NonBlank.max(4_000),
    basisEvidenceRevision: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.targets.map(
      (item) => `${item.targetKind}:${item.targetVersionId}`,
    );
    if (new Set(keys).size !== keys.length)
      context.addIssue({ code: 'custom', path: ['targets'], message: 'Bulk targets must be unique.' });
    if (
      (value.action === 'reaffirm') !==
      (value.basisEvidenceRevision !== null)
    )
      context.addIssue({
        code: 'custom',
        path: ['basisEvidenceRevision'],
        message: 'Only reaffirm requires a basis evidence revision.',
      });
  });

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

export const EvidenceCaseSearchQuerySchema = z
  .object({
    schemaVersion: z.literal('evidence-case-search-query/1'),
    text: z.string().trim().max(200).default(''),
    kinds: z.array(z.enum(['source', 'observation', 'relation', 'open-question', 'assessment'])).max(5).default([]),
    reviewStanding: z.enum(['awaiting-review', 'accepted', 'rejected', 'needs-re-review']).nullable().default(null),
    relationKind: z
      .enum([
        'supports',
        'contradicts',
        'qualifies',
        'scope-mismatch',
        'duplicate',
        'correction',
        'unresolved',
      ])
      .nullable()
      .default(null),
    assigneePrincipalRef: NonBlank.nullable().default(null),
    pageSize: z.number().int().min(1).max(100).default(50),
    cursor: z.string().regex(/^offset:\d+$/u).nullable().default(null),
  })
  .strict();

export const EvidenceCaseSearchResultSchema = z
  .object({
    schemaVersion: z.literal('evidence-case-search-result/1'),
    queryDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    items: z.array(
      z
        .object({
          kind: z.enum(['source', 'observation', 'relation', 'open-question', 'assessment']),
          id: NonBlank,
          title: NonBlank,
          summary: NonBlank,
          artifactVersionId: NonBlank.nullable(),
          locatorId: NonBlank.nullable(),
          reviewStanding: z.enum(['awaiting-review', 'accepted', 'rejected', 'needs-re-review']).nullable(),
          assigneePrincipalRef: NonBlank.nullable(),
        })
        .strict(),
    ),
  })
  .strict();

type SearchItem = z.infer<typeof EvidenceCaseSearchResultSchema>['items'][number];

function standing(
  snapshot: EvidenceProductSnapshot,
  kind: 'observation' | 'relation' | 'assessment',
  id: string,
): SearchItem['reviewStanding'] {
  const decision = effectiveReviewDecision(
    snapshot.reviewDecisions.filter((item) => item.targetKind === kind),
    id,
  );
  if (decision === null) return 'awaiting-review';
  if (decision.action === 'reject') return 'rejected';
  if (decision.action === 'request-revision') return 'needs-re-review';
  return 'accepted';
}

function assignmentFor(
  snapshot: EvidenceProductSnapshot,
  kind: string,
  id: string,
): string | null {
  return (
    snapshot.reviewAssignments.find(
      (item) => item.targetKind === kind && item.targetVersionId === id,
    )?.assigneePrincipalRef ?? null
  );
}

export function searchEvidenceCase(
  snapshotInput: EvidenceProductSnapshot,
  queryInput: z.input<typeof EvidenceCaseSearchQuerySchema>,
): z.infer<typeof EvidenceCaseSearchResultSchema> {
  const snapshot = snapshotInput;
  const query = EvidenceCaseSearchQuerySchema.parse(queryInput);
  const wanted = new Set(query.kinds);
  const includesKind = (kind: SearchItem['kind']) => wanted.size === 0 || wanted.has(kind);
  const items: SearchItem[] = [];
  if (includesKind('source'))
    for (const source of snapshot.sources)
      items.push({ kind: 'source', id: source.artifactVersionId, title: source.title, summary: `${source.logicalArtifactId} version ${String(source.versionOrdinal)}`, artifactVersionId: source.artifactVersionId, locatorId: null, reviewStanding: null, assigneePrincipalRef: null });
  if (includesKind('observation'))
    for (const item of snapshot.observations) {
      const actor =
        item.kind === 'statement-occurrence'
          ? item.actorReference.sourceLabel
          : (item.sourceActorReference?.sourceLabel ?? '');
      items.push({ kind: 'observation', id: item.observationId, title: actor || 'Source observation', summary: `${item.exactQuote} ${actor}`.trim(), artifactVersionId: item.artifactVersionId, locatorId: item.locator.locatorId, reviewStanding: standing(snapshot, 'observation', item.observationId), assigneePrincipalRef: assignmentFor(snapshot, 'observation', item.observationId) });
    }
  if (includesKind('relation'))
    for (const item of snapshot.relations) {
      if (query.relationKind !== null && item.relationKind !== query.relationKind) continue;
      items.push({ kind: 'relation', id: item.relationId, title: item.relationKind, summary: `${item.comparableScope.subject} ${item.comparableScope.aspect} ${item.rationale}`, artifactVersionId: null, locatorId: null, reviewStanding: standing(snapshot, 'relation', item.relationId), assigneePrincipalRef: assignmentFor(snapshot, 'relation', item.relationId) });
    }
  if (includesKind('open-question'))
    for (const item of snapshot.openQuestions)
      items.push({ kind: 'open-question', id: item.openQuestionId, title: item.questionCode, summary: item.questionText, artifactVersionId: null, locatorId: null, reviewStanding: null, assigneePrincipalRef: null });
  if (includesKind('assessment'))
    for (const item of snapshot.assessments)
      items.push({ kind: 'assessment', id: item.assessmentVersionId, title: `Assessment ${String(item.sequence)}`, summary: item.claims.map((claim) => claim.text).join(' '), artifactVersionId: null, locatorId: null, reviewStanding: standing(snapshot, 'assessment', item.assessmentVersionId), assigneePrincipalRef: assignmentFor(snapshot, 'assessment', item.assessmentVersionId) });

  const needle = query.text.toLocaleLowerCase('en-US');
  const filtered = items
    .filter((item) => needle.length === 0 || `${item.title}\n${item.summary}\n${item.id}`.toLocaleLowerCase('en-US').includes(needle))
    .filter((item) => query.reviewStanding === null || item.reviewStanding === query.reviewStanding)
    .filter((item) => query.assigneePrincipalRef === null || item.assigneePrincipalRef === query.assigneePrincipalRef)
    .sort((left, right) => `${left.kind}\u0000${left.title}\u0000${left.id}`.localeCompare(`${right.kind}\u0000${right.title}\u0000${right.id}`));
  const offset = query.cursor === null ? 0 : Number(query.cursor.slice('offset:'.length));
  const page = filtered.slice(offset, offset + query.pageSize);
  const nextOffset = offset + page.length;
  return EvidenceCaseSearchResultSchema.parse({
    schemaVersion: 'evidence-case-search-result/1',
    queryDigest: sha256(canonicalJson(query as never)),
    total: filtered.length,
    nextCursor: nextOffset < filtered.length ? `offset:${String(nextOffset)}` : null,
    items: page,
  });
}

export function deriveEvidenceReviewOperationId(
  prefix: 'assignment' | 'comment' | 'activity' | 'decision',
  input: Record<string, string>,
): string {
  return `evidence-${prefix}-${sha256(canonicalJson({ algorithm: 'evidence-review-operation-id/1', prefix, ...input }))}`;
}

export type EvidenceReviewAssignment = z.infer<typeof EvidenceReviewAssignmentSchema>;
export type EvidenceReviewAssignmentCommand = z.infer<typeof EvidenceReviewAssignmentCommandSchema>;
export type EvidenceReviewComment = z.infer<typeof EvidenceReviewCommentSchema>;
export type EvidenceReviewCommentCommand = z.infer<typeof EvidenceReviewCommentCommandSchema>;
export type EvidenceReviewActivity = z.infer<typeof EvidenceReviewActivitySchema>;
export type EvidenceBulkReviewCommand = z.infer<typeof EvidenceBulkReviewCommandSchema>;
export type EvidenceCaseSearchQuery = z.infer<typeof EvidenceCaseSearchQuerySchema>;
export type EvidenceCaseSearchResult = z.infer<typeof EvidenceCaseSearchResultSchema>;
