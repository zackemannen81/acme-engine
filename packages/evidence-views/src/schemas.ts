import { z } from 'zod';

import { EvidenceReviewActionSchema } from '@acme/evidence-product-contracts';
import {
  EvidenceNonBlankStringSchema,
  EvidenceSha256Schema,
} from '@acme/module-evidence';

export const EVIDENCE_PRIMARY_WORK_QUEUE_VIEW_SCHEMA_VERSION =
  'evidence-primary-work-queue-view/1' as const;
export const EVIDENCE_PRIMARY_SOURCE_REVIEW_VIEW_SCHEMA_VERSION =
  'evidence-primary-source-review-view/1' as const;

const CitationSchema = z
  .object({
    display: EvidenceNonBlankStringSchema,
    artifactVersionId: EvidenceNonBlankStringSchema,
    locatorId: EvidenceNonBlankStringSchema,
    contentHash: EvidenceSha256Schema,
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  })
  .strict();

const ReviewStandingSchema = z.enum([
  'awaiting-review',
  'accepted',
  'rejected',
  'unresolved',
  'revision-requested',
]);

export const EvidencePrimaryWorkQueueViewSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PRIMARY_WORK_QUEUE_VIEW_SCHEMA_VERSION),
    workspace: z
      .object({
        workspaceId: EvidenceNonBlankStringSchema,
        label: EvidenceNonBlankStringSchema,
        evidenceRevision: z.number().int().nonnegative(),
      })
      .strict(),
    heading: z.literal('Review queue'),
    nextItems: z.array(
      z
        .object({
          itemId: EvidenceNonBlankStringSchema,
          kind: z.literal('source-observation'),
          observationVersionId: EvidenceNonBlankStringSchema,
          sourceTitle: EvidenceNonBlankStringSchema,
          reason: z.enum(['new-source-observation', 'decision-requested']),
          citation: CitationSchema,
          targetPath: EvidenceNonBlankStringSchema,
        })
        .strict(),
    ),
    mostRecentAction: z
      .object({
        targetVersionId: EvidenceNonBlankStringSchema,
        action: EvidenceReviewActionSchema,
        reviewerRef: EvidenceNonBlankStringSchema,
        rationale: EvidenceNonBlankStringSchema,
        decidedAt: EvidenceNonBlankStringSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();

export const EvidencePrimarySourceReviewViewSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_PRIMARY_SOURCE_REVIEW_VIEW_SCHEMA_VERSION,
    ),
    workspaceId: EvidenceNonBlankStringSchema,
    source: z
      .object({
        artifactVersionId: EvidenceNonBlankStringSchema,
        logicalArtifactId: EvidenceNonBlankStringSchema,
        title: EvidenceNonBlankStringSchema,
        kind: z.enum(['interview-transcript', 'structured-exhibit-text']),
        versionOrdinal: z.number().int().positive(),
        contentHash: EvidenceSha256Schema,
        predecessorVersionId: EvidenceNonBlankStringSchema.nullable(),
        lines: z.array(
          z
            .object({
              lineNumber: z.number().int().positive(),
              text: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
    heading: z.literal('Source review'),
    observations: z.array(
      z
        .object({
          observationVersionId: EvidenceNonBlankStringSchema,
          kind: z.enum(['statement-occurrence', 'exhibit-assertion']),
          exactQuote: EvidenceNonBlankStringSchema,
          citation: CitationSchema,
          actor: z
            .object({
              sourceLabel: EvidenceNonBlankStringSchema,
              sourceRole: z.enum([
                'speaker',
                'referenced-actor',
                'operator-label',
              ]),
              resolution: z.enum(['resolved', 'unresolved']),
            })
            .strict()
            .nullable(),
          time: z
            .object({
              kind: z.enum(['exact', 'range', 'approximate', 'unknown']),
              role: z.enum([
                'utterance-time',
                'document-time',
                'claimed-event-time',
              ]),
              display: EvidenceNonBlankStringSchema,
            })
            .strict()
            .nullable(),
          reviewStanding: ReviewStandingSchema,
          reviewChoices: z.array(
            z.enum([
              'accept',
              'reject',
              'leave-unresolved',
              'request-revision',
            ]),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export type EvidencePrimaryWorkQueueView = z.infer<
  typeof EvidencePrimaryWorkQueueViewSchema
>;
export type EvidencePrimarySourceReviewView = z.infer<
  typeof EvidencePrimarySourceReviewViewSchema
>;
