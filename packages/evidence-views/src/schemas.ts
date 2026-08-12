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
export const EVIDENCE_PRIMARY_OBSERVATION_LEDGER_VIEW_SCHEMA_VERSION =
  'evidence-primary-observation-ledger-view/1' as const;
export const EVIDENCE_PRIMARY_ACCOUNT_COMPARISON_VIEW_SCHEMA_VERSION =
  'evidence-primary-account-comparison-view/1' as const;
export const EVIDENCE_PRIMARY_RELATION_REVIEW_VIEW_SCHEMA_VERSION =
  'evidence-primary-relation-review-view/1' as const;
export const EVIDENCE_PRIMARY_TIMELINE_VIEW_SCHEMA_VERSION =
  'evidence-primary-timeline-view/1' as const;
export const EVIDENCE_PRIMARY_OPEN_QUESTIONS_VIEW_SCHEMA_VERSION =
  'evidence-primary-open-questions-view/1' as const;
export const EVIDENCE_PRIMARY_ASSESSMENT_VIEW_SCHEMA_VERSION =
  'evidence-primary-assessment-view/1' as const;
export const EVIDENCE_PRIMARY_REVIEW_HISTORY_VIEW_SCHEMA_VERSION =
  'evidence-primary-review-history-view/2' as const;
export const EVIDENCE_TECHNICAL_PROVENANCE_VIEW_SCHEMA_VERSION =
  'evidence-technical-provenance-view/1' as const;
export const EVIDENCE_TECHNICAL_REPLAY_VIEW_SCHEMA_VERSION =
  'evidence-technical-replay-view/1' as const;

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

const EvidenceStandingSchema = z.enum([
  'current',
  'contested',
  'superseded',
  'rejected',
]);

const SourceSummarySchema = z
  .object({
    artifactVersionId: EvidenceNonBlankStringSchema,
    logicalArtifactId: EvidenceNonBlankStringSchema,
    title: EvidenceNonBlankStringSchema,
    versionOrdinal: z.number().int().positive(),
    predecessorVersionId: EvidenceNonBlankStringSchema.nullable(),
    sourcePath: EvidenceNonBlankStringSchema,
  })
  .strict();

const NewEvidenceNoticeSchema = z
  .object({
    noticeId: EvidenceNonBlankStringSchema,
    assessmentVersionId: EvidenceNonBlankStringSchema,
    fromEvidenceRevision: z.number().int().nonnegative(),
    toEvidenceRevision: z.number().int().positive(),
    attentionTier: z.enum(['A', 'B']),
    message: z.literal(
      'New evidence was added after this assessment was reviewed.',
    ),
    addedArtifactVersionIds: z.array(EvidenceNonBlankStringSchema),
    addedObservationIds: z.array(EvidenceNonBlankStringSchema),
    addedRelationIds: z.array(EvidenceNonBlankStringSchema),
    addedOpenQuestionIds: z.array(EvidenceNonBlankStringSchema),
  })
  .strict();

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
      z.discriminatedUnion('kind', [
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
        z
          .object({
            itemId: EvidenceNonBlankStringSchema,
            kind: z.literal('relation-review'),
            relationVersionId: EvidenceNonBlankStringSchema,
            relationKind: EvidenceNonBlankStringSchema,
            reason: z.enum(['new-relation', 'decision-requested']),
            summary: EvidenceNonBlankStringSchema,
            targetPath: EvidenceNonBlankStringSchema,
          })
          .strict(),
        z
          .object({
            itemId: EvidenceNonBlankStringSchema,
            kind: z.literal('assessment-review'),
            assessmentVersionId: EvidenceNonBlankStringSchema,
            sequence: z.number().int().positive(),
            reason: z.enum(['new-assessment', 'decision-requested']),
            summary: EvidenceNonBlankStringSchema,
            targetPath: EvidenceNonBlankStringSchema,
          })
          .strict(),
        z
          .object({
            itemId: EvidenceNonBlankStringSchema,
            kind: z.literal('assessment-attention'),
            assessmentVersionId: EvidenceNonBlankStringSchema,
            sequence: z.number().int().positive(),
            reason: z.literal('new-evidence'),
            summary: EvidenceNonBlankStringSchema,
            targetPath: EvidenceNonBlankStringSchema,
          })
          .strict(),
      ]),
    ),
    newEvidenceNotices: z.array(NewEvidenceNoticeSchema),
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

export const EvidencePrimaryObservationLedgerViewSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_PRIMARY_OBSERVATION_LEDGER_VIEW_SCHEMA_VERSION,
    ),
    workspace: z
      .object({
        workspaceId: EvidenceNonBlankStringSchema,
        label: EvidenceNonBlankStringSchema,
        evidenceRevision: z.number().int().nonnegative(),
      })
      .strict(),
    heading: z.literal('Observation ledger'),
    summary: z
      .object({
        total: z.number().int().nonnegative(),
        current: z.number().int().nonnegative(),
        contested: z.number().int().nonnegative(),
        superseded: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
      })
      .strict(),
    entries: z.array(
      z
        .object({
          observationVersionId: EvidenceNonBlankStringSchema,
          source: SourceSummarySchema,
          exactQuote: EvidenceNonBlankStringSchema,
          citation: CitationSchema,
          actorLabel: EvidenceNonBlankStringSchema.nullable(),
          timeDisplay: EvidenceNonBlankStringSchema.nullable(),
          standing: EvidenceStandingSchema,
          versionRole: z.enum([
            'original-version',
            'corrected-version',
            'independent-source',
          ]),
        })
        .strict(),
    ),
  })
  .strict();

export const EvidencePrimaryAccountComparisonViewSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_PRIMARY_ACCOUNT_COMPARISON_VIEW_SCHEMA_VERSION,
    ),
    workspaceId: EvidenceNonBlankStringSchema,
    heading: z.literal('Account comparison'),
    explanation: z.literal(
      'A corrected transcript replaces only its paired earlier occurrences. A later account remains separately visible.',
    ),
    correction: z
      .object({
        logicalArtifactId: EvidenceNonBlankStringSchema,
        originalSource: SourceSummarySchema,
        correctedSource: SourceSummarySchema,
        pairs: z.array(
          z
            .object({
              predecessorObservationVersionId: EvidenceNonBlankStringSchema,
              successorObservationVersionId: EvidenceNonBlankStringSchema,
              predecessorCitation: CitationSchema,
              successorCitation: CitationSchema,
              predecessorQuote: EvidenceNonBlankStringSchema,
              successorQuote: EvidenceNonBlankStringSchema,
              predecessorStanding: z.literal('superseded'),
              successorStanding: z.enum(['current', 'contested']),
            })
            .strict(),
        ),
      })
      .strict(),
    laterAccounts: z.array(
      z
        .object({
          source: SourceSummarySchema,
          label: z.literal('Later changed account — retained separately'),
          observations: z.array(
            z
              .object({
                observationVersionId: EvidenceNonBlankStringSchema,
                exactQuote: EvidenceNonBlankStringSchema,
                citation: CitationSchema,
                standing: z.enum(['current', 'contested']),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    priorVersionNavigation: z.array(
      z
        .object({
          label: EvidenceNonBlankStringSchema,
          sourcePath: EvidenceNonBlankStringSchema,
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
export type EvidencePrimaryObservationLedgerView = z.infer<
  typeof EvidencePrimaryObservationLedgerViewSchema
>;
export type EvidencePrimaryAccountComparisonView = z.infer<
  typeof EvidencePrimaryAccountComparisonViewSchema
>;

export const EvidencePrimaryRelationReviewViewSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_PRIMARY_RELATION_REVIEW_VIEW_SCHEMA_VERSION,
    ),
    workspace: z
      .object({
        workspaceId: EvidenceNonBlankStringSchema,
        label: EvidenceNonBlankStringSchema,
        evidenceRevision: z.number().int().nonnegative(),
      })
      .strict(),
    heading: z.literal('Relation review'),
    explanation: z.literal(
      'Relations connect exact endpoints with a scoped comparison. Accept, reject or leave each one unresolved without overwriting the linked observations.',
    ),
    metrics: z
      .object({
        relationTotal: z.number().int().nonnegative(),
        byKind: z
          .object({
            supports: z.number().int().nonnegative(),
            contradicts: z.number().int().nonnegative(),
            qualifies: z.number().int().nonnegative(),
            'scope-mismatch': z.number().int().nonnegative(),
            duplicate: z.number().int().nonnegative(),
            correction: z.number().int().nonnegative(),
            unresolved: z.number().int().nonnegative(),
          })
          .strict(),
        unresolvedActorRelations: z.number().int().nonnegative(),
        openQuestionTotal: z.number().int().nonnegative(),
        awaitingReview: z.number().int().nonnegative(),
      })
      .strict(),
    relations: z.array(
      z
        .object({
          relationVersionId: EvidenceNonBlankStringSchema,
          relationKind: z.enum([
            'supports',
            'contradicts',
            'qualifies',
            'scope-mismatch',
            'duplicate',
            'correction',
            'unresolved',
          ]),
          endpoints: z.array(
            z
              .object({
                kind: EvidenceNonBlankStringSchema,
                id: EvidenceNonBlankStringSchema,
                display: EvidenceNonBlankStringSchema,
              })
              .strict(),
          ),
          scopeSubject: EvidenceNonBlankStringSchema,
          scopeAspect: EvidenceNonBlankStringSchema,
          rationaleCode: EvidenceNonBlankStringSchema,
          rationale: EvidenceNonBlankStringSchema,
          standing: EvidenceStandingSchema,
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
    openQuestions: z.array(
      z
        .object({
          openQuestionId: EvidenceNonBlankStringSchema,
          questionCode: EvidenceNonBlankStringSchema,
          questionText: EvidenceNonBlankStringSchema,
          triggeringEvidenceIds: z.array(EvidenceNonBlankStringSchema),
          standing: EvidenceStandingSchema,
        })
        .strict(),
    ),
  })
  .strict();

export type EvidencePrimaryRelationReviewView = z.infer<
  typeof EvidencePrimaryRelationReviewViewSchema
>;

export const EvidencePrimaryTimelineViewSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PRIMARY_TIMELINE_VIEW_SCHEMA_VERSION),
    workspace: z
      .object({
        workspaceId: EvidenceNonBlankStringSchema,
        label: EvidenceNonBlankStringSchema,
        evidenceRevision: z.number().int().nonnegative(),
      })
      .strict(),
    heading: z.literal('Timeline'),
    explanation: z.literal(
      'Entries keep exact, range, approximate and unknown labels. Overlapping non-exact bounds form ambiguity bands. Precision is never invented.',
    ),
    entries: z.array(
      z
        .object({
          entryId: EvidenceNonBlankStringSchema,
          bandKind: z.enum([
            'exact',
            'range',
            'approximate',
            'unknown',
            'ambiguity',
          ]),
          display: EvidenceNonBlankStringSchema,
          observationVersionIds: z.array(EvidenceNonBlankStringSchema),
          sourceLinks: z.array(
            z
              .object({
                observationVersionId: EvidenceNonBlankStringSchema,
                citation: CitationSchema,
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export const EvidencePrimaryOpenQuestionsViewSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_PRIMARY_OPEN_QUESTIONS_VIEW_SCHEMA_VERSION,
    ),
    workspace: z
      .object({
        workspaceId: EvidenceNonBlankStringSchema,
        label: EvidenceNonBlankStringSchema,
        evidenceRevision: z.number().int().nonnegative(),
      })
      .strict(),
    heading: z.literal('Open questions'),
    explanation: z.literal(
      'Open questions mark gaps exposed by the evidence. Absence of an answer is not treated as falsity.',
    ),
    questions: z.array(
      z
        .object({
          openQuestionId: EvidenceNonBlankStringSchema,
          questionCode: EvidenceNonBlankStringSchema,
          questionText: EvidenceNonBlankStringSchema,
          standing: EvidenceStandingSchema,
          triggeringEvidenceIds: z.array(EvidenceNonBlankStringSchema),
          sourceLinks: z.array(
            z
              .object({
                observationVersionId: EvidenceNonBlankStringSchema,
                citation: CitationSchema,
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export type EvidencePrimaryTimelineView = z.infer<
  typeof EvidencePrimaryTimelineViewSchema
>;
export type EvidencePrimaryOpenQuestionsView = z.infer<
  typeof EvidencePrimaryOpenQuestionsViewSchema
>;

export const EvidencePrimaryAssessmentViewSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PRIMARY_ASSESSMENT_VIEW_SCHEMA_VERSION),
    workspace: z
      .object({
        workspaceId: EvidenceNonBlankStringSchema,
        label: EvidenceNonBlankStringSchema,
        evidenceRevision: z.number().int().nonnegative(),
      })
      .strict(),
    heading: z.literal('Reviewed evidence assessment'),
    assessment: z
      .object({
        assessmentVersionId: EvidenceNonBlankStringSchema,
        sequence: z.number().int().positive(),
        basisEvidenceRevision: z.number().int().nonnegative(),
        effectiveBasisEvidenceRevision: z.number().int().nonnegative(),
        contentHash: EvidenceSha256Schema,
        predecessorAssessmentVersionId: EvidenceNonBlankStringSchema.nullable(),
      })
      .strict(),
    claims: z.array(
      z
        .object({
          claimKey: EvidenceNonBlankStringSchema,
          text: EvidenceNonBlankStringSchema,
          supportUnresolved: z.boolean(),
          uncertainty: z.enum(['low', 'medium', 'high']),
          uncertaintyRationale: EvidenceNonBlankStringSchema,
          supportCitations: z.array(CitationSchema),
          conflictCitations: z.array(CitationSchema),
          qualificationCitations: z.array(CitationSchema),
        })
        .strict(),
    ),
    openQuestions: z.array(
      z
        .object({
          openQuestionId: EvidenceNonBlankStringSchema,
          questionCode: EvidenceNonBlankStringSchema,
          questionText: EvidenceNonBlankStringSchema,
          sourceCitations: z.array(CitationSchema),
        })
        .strict(),
    ),
    reviewStanding: ReviewStandingSchema,
    shareable: z.boolean(),
    dueForAttention: z.boolean(),
    newEvidenceNotices: z.array(NewEvidenceNoticeSchema),
    reviewChoices: z.array(
      z.enum(['accept', 'reject', 'request-revision', 'reaffirm']),
    ),
    reviewHistoryPath: EvidenceNonBlankStringSchema,
    exportPath: EvidenceNonBlankStringSchema.nullable(),
  })
  .strict();

export const EvidencePrimaryReviewHistoryViewSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_PRIMARY_REVIEW_HISTORY_VIEW_SCHEMA_VERSION,
    ),
    workspaceId: EvidenceNonBlankStringSchema,
    heading: z.literal('Review history'),
    target: z
      .object({
        targetKind: z.enum(['observation', 'relation', 'assessment']),
        targetVersionId: EvidenceNonBlankStringSchema,
        immutableObjectPath: EvidenceNonBlankStringSchema,
      })
      .strict(),
    decisions: z.array(
      z
        .object({
          reviewDecisionId: EvidenceNonBlankStringSchema,
          reviewerRef: EvidenceNonBlankStringSchema,
          principalAssurance: z.enum([
            'unauthenticated-local',
            'authenticated-session',
            'authenticated-case-session',
          ]),
          action: EvidenceReviewActionSchema,
          rationale: EvidenceNonBlankStringSchema,
          decidedAt: EvidenceNonBlankStringSchema,
          basisEvidenceRevision: z.number().int().nonnegative().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export type EvidencePrimaryAssessmentView = z.infer<
  typeof EvidencePrimaryAssessmentViewSchema
>;
export type EvidencePrimaryReviewHistoryView = z.infer<
  typeof EvidencePrimaryReviewHistoryViewSchema
>;

export const EvidenceTechnicalProvenanceViewSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_TECHNICAL_PROVENANCE_VIEW_SCHEMA_VERSION),
    classification: z.literal('technical-audit'),
    domainObjectId: EvidenceNonBlankStringSchema,
    executionId: EvidenceNonBlankStringSchema,
    contractId: EvidenceNonBlankStringSchema,
    contractVersion: EvidenceNonBlankStringSchema,
    contractFingerprint: EvidenceNonBlankStringSchema,
    operationDigest: EvidenceNonBlankStringSchema.nullable(),
    retainedCallAvailable: z.boolean(),
  })
  .strict();

export const EvidenceTechnicalReplayViewSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_TECHNICAL_REPLAY_VIEW_SCHEMA_VERSION),
    classification: z.literal('technical-audit'),
    executionId: EvidenceNonBlankStringSchema,
    replayVerdict: z.enum(['match', 'different', 'unavailable']),
    recordedDigest: EvidenceNonBlankStringSchema.nullable(),
    currentDigest: EvidenceNonBlankStringSchema.nullable(),
    reason: EvidenceNonBlankStringSchema,
    providerCallCount: z.literal(0),
  })
  .strict();

export type EvidenceTechnicalProvenanceView = z.infer<
  typeof EvidenceTechnicalProvenanceViewSchema
>;
export type EvidenceTechnicalReplayView = z.infer<
  typeof EvidenceTechnicalReplayViewSchema
>;
