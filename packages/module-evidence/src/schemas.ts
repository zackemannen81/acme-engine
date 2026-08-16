import { z } from 'zod';

import { canonicalizeEvidenceText } from './canonical-text.js';

export const EVIDENCE_NAMESPACE = 'evidence' as const;
export const EVIDENCE_SOURCE_ARTIFACT_VERSION_SCHEMA_VERSION =
  'evidence-source-artifact-version/1' as const;
export const EVIDENCE_LOCATOR_SCHEMA_VERSION = 'evidence-locator/1' as const;
export const EVIDENCE_ACTOR_REFERENCE_SCHEMA_VERSION =
  'evidence-actor-reference/1' as const;
export const EVIDENCE_TEMPORAL_BOUND_SCHEMA_VERSION =
  'evidence-temporal-bound/1' as const;
export const EVIDENCE_STATEMENT_OCCURRENCE_SCHEMA_VERSION =
  'evidence-statement-occurrence/1' as const;
export const EVIDENCE_EXHIBIT_ASSERTION_SCHEMA_VERSION =
  'evidence-exhibit-assertion/1' as const;
export const EVIDENCE_PROPOSITION_SCHEMA_VERSION =
  'evidence-proposition/1' as const;
export const EVIDENCE_EVENT_OCCURRENCE_SCHEMA_VERSION =
  'evidence-event-occurrence/1' as const;
export const EVIDENCE_RELATION_SCHEMA_VERSION = 'evidence-relation/1' as const;
export const EVIDENCE_OPEN_QUESTION_SCHEMA_VERSION =
  'evidence-open-question/1' as const;
export const EVIDENCE_ASSESSMENT_SCHEMA_VERSION =
  'evidence-assessment/1' as const;
export const EVIDENCE_STATE_SCHEMA_VERSION = 'evidence-state/1' as const;
export const EVIDENCE_DELTA_SCHEMA_VERSION = 'evidence-delta/1' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION =
  'evidence-observe-artifact-input/1' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION_V2 =
  'evidence-observe-artifact-input/2' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION_V1 =
  'evidence-observe-artifact-output/1' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION_V2 =
  'evidence-observe-artifact-output/2' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION_V3 =
  'evidence-observe-artifact-output/3' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION_V4 =
  'evidence-observe-artifact-output/4' as const;
export const EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION =
  'evidence-observe-artifact-output/5' as const;
export const EVIDENCE_SEGMENT_COVERAGE_STATUS = [
  'observations_extracted',
  'no_observation',
] as const;
export const EVIDENCE_RELATE_OBSERVATIONS_INPUT_SCHEMA_VERSION =
  'evidence-relate-observations-input/1' as const;
export const EVIDENCE_RELATE_OBSERVATIONS_OUTPUT_SCHEMA_VERSION =
  'evidence-relate-observations-output/1' as const;
export const EVIDENCE_BUILD_TIMELINE_INPUT_SCHEMA_VERSION =
  'evidence-build-timeline-input/1' as const;
export const EVIDENCE_BUILD_TIMELINE_OUTPUT_SCHEMA_VERSION =
  'evidence-build-timeline-output/1' as const;
export const EVIDENCE_PROPOSE_ASSESSMENT_INPUT_SCHEMA_VERSION =
  'evidence-propose-assessment-input/1' as const;
export const EVIDENCE_PROPOSE_ASSESSMENT_INPUT_SCHEMA_VERSION_V2 =
  'evidence-propose-assessment-input/2' as const;
export const EVIDENCE_PROPOSE_ASSESSMENT_OUTPUT_SCHEMA_VERSION =
  'evidence-propose-assessment-output/1' as const;
export const EVIDENCE_MEMORY_SCHEMA_VERSION = 'evidence-memory/1' as const;
export const EVIDENCE_LOCATOR_SCHEME = 'line-range-1' as const;

export const EvidenceNonBlankStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, {
    message: 'Expected a non-blank string.',
  });
export const EvidenceSha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
export const EvidenceDerivedIdSchema = z
  .string()
  .regex(/^evidence_[a-z]+_[0-9a-f]{64}$/u);
export const EvidenceLogicalArtifactIdSchema = z
  .string()
  .regex(/^(?:(?:SCR|DEV|EVAL)-(?:T|E)\d{2}|ART-[A-Z0-9][A-Z0-9-]{2,63})$/u);
export const EvidenceIsoTimestampSchema = EvidenceNonBlankStringSchema.refine(
  (value) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) &&
    !Number.isNaN(Date.parse(value)),
  'Expected a canonical UTC ISO-8601 timestamp.',
);

function sortedUniqueStrings(minimum = 0) {
  return z
    .array(EvidenceNonBlankStringSchema)
    .min(minimum)
    .superRefine((values, context) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: 'custom',
          message: 'Values must be unique.',
        });
      }
      if (
        values.some(
          (value, index) => index > 0 && (values[index - 1] as string) > value,
        )
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Values must be sorted.',
        });
      }
    });
}

export const EvidenceArtifactKindSchema = z.enum([
  'interview-transcript',
  'structured-exhibit-text',
]);

export const SourceArtifactVersionSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_SOURCE_ARTIFACT_VERSION_SCHEMA_VERSION),
    corpusId: EvidenceNonBlankStringSchema,
    logicalArtifactId: EvidenceLogicalArtifactIdSchema,
    artifactVersionId: EvidenceDerivedIdSchema,
    versionOrdinal: z.number().int().positive(),
    kind: EvidenceArtifactKindSchema,
    title: EvidenceNonBlankStringSchema,
    contentHash: EvidenceSha256Schema,
    locatorScheme: z.literal(EVIDENCE_LOCATOR_SCHEME),
    lineCount: z.number().int().positive(),
    predecessorVersionId: EvidenceDerivedIdSchema.nullable(),
    correctionReason: z
      .enum(['transcription-correction', 'redaction-derivative'])
      .nullable(),
    text: EvidenceNonBlankStringSchema.refine(
      (value) => canonicalizeEvidenceText(value) === value,
      'Source text must already be UTF-8/LF/NFC canonical text.',
    ),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.predecessorVersionId === null) !==
      (value.correctionReason === null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['correctionReason'],
        message:
          'Correction reason and predecessor version must either both exist or both be null.',
      });
    }
  });

export const EvidenceLocatorSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_LOCATOR_SCHEMA_VERSION),
    locatorId: EvidenceDerivedIdSchema,
    artifactVersionId: EvidenceDerivedIdSchema,
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  })
  .strict()
  .refine((value) => value.startLine <= value.endLine, {
    path: ['endLine'],
    message: 'Locator end line must not precede its start line.',
  });

export const EvidenceActorSourceRoleSchema = z.enum([
  'speaker',
  'referenced-actor',
  'operator-label',
]);

export const EvidenceActorResolutionSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('resolved'),
      actorKey: EvidenceNonBlankStringSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal('unresolved'),
      candidateActorKeys: sortedUniqueStrings(1),
    })
    .strict(),
]);

export const EvidenceActorReferenceSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_ACTOR_REFERENCE_SCHEMA_VERSION),
    actorReferenceKey: EvidenceDerivedIdSchema,
    artifactVersionId: EvidenceDerivedIdSchema,
    locatorId: EvidenceDerivedIdSchema,
    sourceLabel: EvidenceNonBlankStringSchema,
    sourceRole: EvidenceActorSourceRoleSchema,
    resolution: EvidenceActorResolutionSchema,
  })
  .strict();

export const EvidenceTemporalRoleSchema = z.enum([
  'utterance-time',
  'document-time',
  'claimed-event-time',
]);

const temporalProvenance = {
  schemaVersion: z.literal(EVIDENCE_TEMPORAL_BOUND_SCHEMA_VERSION),
  role: EvidenceTemporalRoleSchema,
  artifactVersionId: EvidenceDerivedIdSchema,
  locatorId: EvidenceDerivedIdSchema,
};

export const EvidenceTemporalBoundSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...temporalProvenance,
      kind: z.literal('exact'),
      at: EvidenceIsoTimestampSchema,
    })
    .strict(),
  z
    .object({
      ...temporalProvenance,
      kind: z.literal('range'),
      from: EvidenceIsoTimestampSchema,
      to: EvidenceIsoTimestampSchema,
    })
    .strict()
    .refine((value) => value.from <= value.to, {
      path: ['to'],
      message: 'Temporal range end must not precede its start.',
    }),
  z
    .object({
      ...temporalProvenance,
      kind: z.literal('approximate'),
      center: EvidenceIsoTimestampSchema,
      toleranceMinutes: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ...temporalProvenance,
      kind: z.literal('unknown'),
      reason: EvidenceNonBlankStringSchema,
    })
    .strict(),
]);

const observationBase = {
  observationId: EvidenceDerivedIdSchema,
  artifactVersionId: EvidenceDerivedIdSchema,
  locator: EvidenceLocatorSchema,
  exactQuote: EvidenceNonBlankStringSchema,
  temporalBound: EvidenceTemporalBoundSchema.nullable(),
};

export const EvidenceStatementOccurrenceSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_STATEMENT_OCCURRENCE_SCHEMA_VERSION),
    kind: z.literal('statement-occurrence'),
    ...observationBase,
    actorReference: EvidenceActorReferenceSchema,
  })
  .strict();

export const EvidenceExhibitAssertionSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_EXHIBIT_ASSERTION_SCHEMA_VERSION),
    kind: z.literal('exhibit-assertion'),
    ...observationBase,
    sourceActorReference: EvidenceActorReferenceSchema.nullable(),
  })
  .strict();

export const EvidenceObservationSchema = z.discriminatedUnion('kind', [
  EvidenceStatementOccurrenceSchema,
  EvidenceExhibitAssertionSchema,
]);

export const EvidencePropositionSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PROPOSITION_SCHEMA_VERSION),
    kind: z.literal('proposition'),
    propositionId: EvidenceDerivedIdSchema,
    observationIds: sortedUniqueStrings(1),
    normalizedProposition: EvidenceNonBlankStringSchema,
  })
  .strict();

export const EvidenceEventOccurrenceSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_EVENT_OCCURRENCE_SCHEMA_VERSION),
    kind: z.literal('event-occurrence'),
    eventId: EvidenceDerivedIdSchema,
    supportingObservationIds: sortedUniqueStrings(1),
    actorReferenceKeys: sortedUniqueStrings(),
    temporalBound: EvidenceTemporalBoundSchema,
    description: EvidenceNonBlankStringSchema,
  })
  .strict();

export const EvidenceRelationKindSchema = z.enum([
  'supports',
  'contradicts',
  'qualifies',
  'scope-mismatch',
  'duplicate',
  'correction',
  'unresolved',
]);

export const EvidenceRelationEndpointSchema = z
  .object({
    kind: z.enum([
      'observation',
      'proposition',
      'event',
      'relation',
      'actor-reference',
      'actor',
    ]),
    id: EvidenceNonBlankStringSchema,
  })
  .strict();

export const EvidenceComparableScopeSchema = z
  .object({
    subject: EvidenceNonBlankStringSchema,
    aspect: EvidenceNonBlankStringSchema,
    actorReferenceKeys: sortedUniqueStrings(),
    temporalBounds: z.array(EvidenceTemporalBoundSchema),
  })
  .strict();

export const EvidenceRelationSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_RELATION_SCHEMA_VERSION),
    kind: z.literal('evidence-relation'),
    relationId: EvidenceDerivedIdSchema,
    relationKind: EvidenceRelationKindSchema,
    endpoints: z.array(EvidenceRelationEndpointSchema).min(2),
    comparableScope: EvidenceComparableScopeSchema,
    rationaleCode: EvidenceNonBlankStringSchema,
    rationale: EvidenceNonBlankStringSchema,
    predecessorRelationId: EvidenceDerivedIdSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.endpoints.map(({ kind, id }) => `${kind}:${id}`);
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: 'custom',
        path: ['endpoints'],
        message: 'Relation endpoints must be distinct.',
      });
    }
    if (
      keys.some((key, index) => index > 0 && (keys[index - 1] as string) > key)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['endpoints'],
        message: 'Relation endpoints must be sorted by kind and id.',
      });
    }
  });

export const EvidenceOpenQuestionSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_OPEN_QUESTION_SCHEMA_VERSION),
    kind: z.literal('open-question'),
    openQuestionId: EvidenceDerivedIdSchema,
    triggeringEvidenceIds: sortedUniqueStrings(1),
    questionCode: EvidenceNonBlankStringSchema,
    questionText: EvidenceNonBlankStringSchema,
  })
  .strict();

export const EvidenceUncertaintySchema = z.enum(['low', 'medium', 'high']);

export const EvidenceAssessmentClaimSchema = z
  .object({
    claimKey: EvidenceNonBlankStringSchema,
    text: EvidenceNonBlankStringSchema,
    supportObservationIds: sortedUniqueStrings(),
    conflictRelationIds: sortedUniqueStrings(),
    qualificationRelationIds: sortedUniqueStrings(),
    supportUnresolved: z.boolean(),
    uncertainty: EvidenceUncertaintySchema,
    uncertaintyRationale: EvidenceNonBlankStringSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.supportUnresolved || value.supportObservationIds.length > 0,
    {
      path: ['supportObservationIds'],
      message:
        'An assessment claim needs accepted support or an explicit unresolved marker.',
    },
  );

export const EvidenceAssessmentCitationSchema = z
  .object({
    evidenceId: EvidenceNonBlankStringSchema,
    artifactVersionId: EvidenceDerivedIdSchema,
    locatorId: EvidenceDerivedIdSchema,
  })
  .strict();

export const EvidenceAssessmentSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_ASSESSMENT_SCHEMA_VERSION),
    assessmentVersionId: EvidenceDerivedIdSchema,
    workspaceId: EvidenceNonBlankStringSchema,
    sequence: z.number().int().positive(),
    basisEvidenceRevision: z.number().int().nonnegative(),
    contentHash: EvidenceSha256Schema,
    claims: z.array(EvidenceAssessmentClaimSchema).min(1),
    openQuestionIds: sortedUniqueStrings(),
    citations: z.array(EvidenceAssessmentCitationSchema),
    predecessorAssessmentVersionId: EvidenceDerivedIdSchema.nullable(),
  })
  .strict();

export const EvidenceObjectKindSchema = z.enum([
  'source-artifact-version',
  'statement-occurrence',
  'exhibit-assertion',
  'proposition',
  'event-occurrence',
  'evidence-relation',
  'open-question',
  'assessment-version',
]);
export const EvidenceStandingSchema = z.enum([
  'current',
  'contested',
  'superseded',
  'rejected',
]);

export const EvidenceObjectStandingSchema = z
  .object({
    objectKind: EvidenceObjectKindSchema,
    objectId: EvidenceNonBlankStringSchema,
    standing: EvidenceStandingSchema,
  })
  .strict();

function sortedStandingEntries() {
  return z
    .array(EvidenceObjectStandingSchema)
    .superRefine((values, context) => {
      const keys = values.map(
        ({ objectKind, objectId }) => `${objectKind}:${objectId}`,
      );
      if (new Set(keys).size !== keys.length) {
        context.addIssue({
          code: 'custom',
          message: 'Evidence standings must have unique object identities.',
        });
      }
      if (
        keys.some(
          (key, index) => index > 0 && (keys[index - 1] as string) > key,
        )
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Evidence standings must be sorted by kind and id.',
        });
      }
    });
}

export const EvidenceStateSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_STATE_SCHEMA_VERSION),
    evidenceRevision: z.number().int().nonnegative(),
    sourceDocumentIds: sortedUniqueStrings(),
    assessmentDocumentIds: sortedUniqueStrings(),
    memoryIds: sortedUniqueStrings(),
    standings: sortedStandingEntries(),
    currentRelationVersionIds: sortedUniqueStrings(),
    currentOpenQuestionIds: sortedUniqueStrings(),
  })
  .strict();

export const EvidenceCorrectionLineageSchema = z
  .object({
    logicalArtifactId: EvidenceLogicalArtifactIdSchema,
    predecessorArtifactVersionId: EvidenceDerivedIdSchema,
    successorArtifactVersionId: EvidenceDerivedIdSchema,
    successorObjectId: EvidenceDerivedIdSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.predecessorArtifactVersionId !== value.successorArtifactVersionId,
    {
      path: ['successorArtifactVersionId'],
      message: 'A correction successor must be a different artifact version.',
    },
  );

export const EvidenceStandingChangeSchema = z
  .object({
    objectKind: EvidenceObjectKindSchema,
    objectId: EvidenceNonBlankStringSchema,
    from: EvidenceStandingSchema.nullable(),
    to: EvidenceStandingSchema,
    transition: z.enum(['create', 'contest', 'correction', 'reject']),
    correctionLineage: EvidenceCorrectionLineageSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.transition === 'correction') !==
      (value.correctionLineage !== null)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['correctionLineage'],
        message: 'Only correction transitions carry correction lineage.',
      });
    }
    const expectedTarget = {
      create: 'current',
      contest: 'contested',
      correction: 'superseded',
      reject: 'rejected',
    }[value.transition];
    if (value.to !== expectedTarget) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: `Transition ${value.transition} requires target standing ${expectedTarget}.`,
      });
    }
    if (value.transition === 'create' && value.from !== null) {
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Create transitions must start without a standing.',
      });
    }
    if (value.transition !== 'create' && value.from === null) {
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'Non-create transitions require a prior standing.',
      });
    }
  });

export const EvidenceDeltaSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_DELTA_SCHEMA_VERSION),
    nextEvidenceRevision: z.number().int().nonnegative(),
    addSourceDocumentIds: sortedUniqueStrings(),
    addAssessmentDocumentIds: sortedUniqueStrings(),
    addMemoryIds: sortedUniqueStrings(),
    standingChanges: z.array(EvidenceStandingChangeSchema),
    currentRelationVersionIds: sortedUniqueStrings(),
    currentOpenQuestionIds: sortedUniqueStrings(),
  })
  .strict();

export const EvidenceActorRosterEntrySchema = z
  .object({
    actorKey: EvidenceNonBlankStringSchema,
    allowedSourceLabels: sortedUniqueStrings(1),
  })
  .strict();

export const EvidenceObserveArtifactInputV1Schema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION),
    artifactVersion: SourceArtifactVersionSchema,
    actorRoster: z.array(EvidenceActorRosterEntrySchema),
  })
  .strict();

export const EvidenceObservationCoverageWindowSchema = z
  .object({
    sourceSegmentIds: z
      .array(z.string().regex(/^line-[0-9]{6}-segment-[0-9]{4}$/u))
      .min(1)
      .max(64)
      .superRefine((values, context) => {
        if (new Set(values).size !== values.length) {
          context.addIssue({
            code: 'custom',
            message: 'Coverage window segment ids must be unique.',
          });
        }
      }),
  })
  .strict();

export const EvidenceObserveArtifactInputSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_OBSERVE_ARTIFACT_INPUT_SCHEMA_VERSION_V2),
    artifactVersion: SourceArtifactVersionSchema,
    actorRoster: z.array(EvidenceActorRosterEntrySchema),
    coverageWindow: EvidenceObservationCoverageWindowSchema,
  })
  .strict();

const actorReferenceCandidate = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('resolved'),
      sourceLabel: EvidenceNonBlankStringSchema,
      sourceRole: EvidenceActorSourceRoleSchema,
      actorKey: EvidenceNonBlankStringSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal('unresolved'),
      sourceLabel: EvidenceNonBlankStringSchema,
      sourceRole: EvidenceActorSourceRoleSchema,
      candidateActorKeys: sortedUniqueStrings(1),
    })
    .strict(),
]);

const temporalCandidate = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('exact'),
      role: EvidenceTemporalRoleSchema,
      at: EvidenceIsoTimestampSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('range'),
      role: EvidenceTemporalRoleSchema,
      from: EvidenceIsoTimestampSchema,
      to: EvidenceIsoTimestampSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('approximate'),
      role: EvidenceTemporalRoleSchema,
      center: EvidenceIsoTimestampSchema,
      toleranceMinutes: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('unknown'),
      role: EvidenceTemporalRoleSchema,
      reason: EvidenceNonBlankStringSchema,
    })
    .strict(),
]);

export const EvidenceStatementOccurrenceCandidateV1Schema = z
  .object({
    kind: z.literal('statement-occurrence'),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    exactQuote: EvidenceNonBlankStringSchema,
    actorReference: actorReferenceCandidate,
    temporalBound: temporalCandidate.nullable(),
  })
  .strict();

export const EvidenceExhibitAssertionCandidateV1Schema = z
  .object({
    kind: z.literal('exhibit-assertion'),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    exactQuote: EvidenceNonBlankStringSchema,
    sourceActorReference: actorReferenceCandidate.nullable(),
    temporalBound: temporalCandidate.nullable(),
  })
  .strict();

export const EvidenceObserveArtifactOutputV1Schema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION_V1,
    ),
    observations: z.array(
      z.discriminatedUnion('kind', [
        EvidenceStatementOccurrenceCandidateV1Schema,
        EvidenceExhibitAssertionCandidateV1Schema,
      ]),
    ),
  })
  .strict();

export const EvidenceStatementOccurrenceCandidateV2Schema = z
  .object({
    kind: z.literal('statement-occurrence'),
    exactQuote: EvidenceNonBlankStringSchema,
    actorReference: actorReferenceCandidate,
    temporalBound: temporalCandidate.nullable(),
  })
  .strict();

export const EvidenceExhibitAssertionCandidateV2Schema = z
  .object({
    kind: z.literal('exhibit-assertion'),
    exactQuote: EvidenceNonBlankStringSchema,
    sourceActorReference: actorReferenceCandidate.nullable(),
    temporalBound: temporalCandidate.nullable(),
  })
  .strict();

export const EvidenceObserveArtifactOutputV2Schema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION_V2,
    ),
    observations: z.array(
      z.discriminatedUnion('kind', [
        EvidenceStatementOccurrenceCandidateV2Schema,
        EvidenceExhibitAssertionCandidateV2Schema,
      ]),
    ),
  })
  .strict();

export const EvidenceSingleLineExactQuoteSchema =
  EvidenceNonBlankStringSchema.max(500).regex(
    /^[^\r\n]+$/u,
    'Exact quote must be one canonical source line.',
  );

export const EvidenceStatementOccurrenceCandidateV3Schema = z
  .object({
    kind: z.literal('statement-occurrence'),
    exactQuote: EvidenceSingleLineExactQuoteSchema,
    actorReference: actorReferenceCandidate,
    temporalBound: temporalCandidate.nullable(),
  })
  .strict();

export const EvidenceExhibitAssertionCandidateV3Schema = z
  .object({
    kind: z.literal('exhibit-assertion'),
    exactQuote: EvidenceSingleLineExactQuoteSchema,
    sourceActorReference: actorReferenceCandidate.nullable(),
    temporalBound: temporalCandidate.nullable(),
  })
  .strict();

export const EvidenceObserveArtifactOutputV3Schema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION_V3,
    ),
    observations: z.array(
      z.discriminatedUnion('kind', [
        EvidenceStatementOccurrenceCandidateV3Schema,
        EvidenceExhibitAssertionCandidateV3Schema,
      ]),
    ),
  })
  .strict();

export const EvidenceSourceSegmentIdSchema = z
  .string()
  .regex(/^line-[0-9]{6}-segment-[0-9]{4}$/u);

export const EvidenceStatementOccurrenceCandidateSchema = z
  .object({
    kind: z.literal('statement-occurrence'),
    sourceSegmentId: EvidenceSourceSegmentIdSchema,
    actorReference: actorReferenceCandidate,
    temporalBound: temporalCandidate.nullable(),
  })
  .strict();

export const EvidenceExhibitAssertionCandidateSchema = z
  .object({
    kind: z.literal('exhibit-assertion'),
    sourceSegmentId: EvidenceSourceSegmentIdSchema,
    sourceActorReference: actorReferenceCandidate.nullable(),
    temporalBound: temporalCandidate.nullable(),
  })
  .strict();

export const EvidenceObserveArtifactOutputV4Schema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION_V4,
    ),
    observations: z.array(
      z.discriminatedUnion('kind', [
        EvidenceStatementOccurrenceCandidateSchema,
        EvidenceExhibitAssertionCandidateSchema,
      ]),
    ),
  })
  .strict();

export const EvidenceSegmentCoverageEntrySchema = z
  .object({
    sourceSegmentId: EvidenceSourceSegmentIdSchema,
    status: z.enum(EVIDENCE_SEGMENT_COVERAGE_STATUS),
  })
  .strict();

export const EvidenceObserveArtifactOutputSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_OBSERVE_ARTIFACT_OUTPUT_SCHEMA_VERSION),
    observations: z.array(
      z.discriminatedUnion('kind', [
        EvidenceStatementOccurrenceCandidateSchema,
        EvidenceExhibitAssertionCandidateSchema,
      ]),
    ),
    segmentCoverage: z
      .array(EvidenceSegmentCoverageEntrySchema)
      .min(1)
      .max(64)
      .superRefine((values, context) => {
        const ids = values.map(({ sourceSegmentId }) => sourceSegmentId);
        if (new Set(ids).size !== ids.length) {
          context.addIssue({
            code: 'custom',
            message: 'Coverage ledger segment ids must be unique.',
          });
        }
      }),
  })
  .strict();

export const EvidenceObserveArtifactReplayOutputSchema = z.discriminatedUnion(
  'schemaVersion',
  [
    EvidenceObserveArtifactOutputV1Schema,
    EvidenceObserveArtifactOutputV2Schema,
    EvidenceObserveArtifactOutputV3Schema,
    EvidenceObserveArtifactOutputV4Schema,
    EvidenceObserveArtifactOutputSchema,
  ],
);

export const EvidenceRelateObservationsInputSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_RELATE_OBSERVATIONS_INPUT_SCHEMA_VERSION),
    observations: z.array(EvidenceObservationSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.observations.map(({ observationId }) => observationId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        path: ['observations'],
        message: 'Relate input observations must have unique observation ids.',
      });
    }
  });

export const EvidencePropositionCandidateSchema = z
  .object({
    observationIds: sortedUniqueStrings(1),
    normalizedProposition: EvidenceNonBlankStringSchema,
  })
  .strict();

export const EvidenceEventCandidateSchema = z
  .object({
    supportingObservationIds: sortedUniqueStrings(1),
    actorReferenceKeys: sortedUniqueStrings(),
    temporalObservationId: EvidenceNonBlankStringSchema,
    description: EvidenceNonBlankStringSchema,
  })
  .strict();

export const EvidenceRelationComparableScopeCandidateSchema = z
  .object({
    subject: EvidenceNonBlankStringSchema,
    aspect: EvidenceNonBlankStringSchema,
    actorReferenceKeys: sortedUniqueStrings(),
    temporalObservationIds: sortedUniqueStrings(),
  })
  .strict();

export const EvidenceRelationCandidateSchema = z
  .object({
    relationKind: EvidenceRelationKindSchema,
    endpoints: z.array(EvidenceRelationEndpointSchema).min(2),
    comparableScope: EvidenceRelationComparableScopeCandidateSchema,
    rationaleCode: EvidenceNonBlankStringSchema,
    rationale: EvidenceNonBlankStringSchema,
  })
  .strict();

export const EvidenceOpenQuestionCandidateSchema = z
  .object({
    questionCode: EvidenceNonBlankStringSchema,
    questionText: EvidenceNonBlankStringSchema,
    triggeringObservationIds: sortedUniqueStrings(),
    triggeringRelationRationaleCodes: sortedUniqueStrings(),
  })
  .strict()
  .refine(
    (value) =>
      value.triggeringObservationIds.length +
        value.triggeringRelationRationaleCodes.length >
      0,
    {
      message:
        'An open question must cite at least one observation or relation.',
    },
  );

export const EvidenceRelateObservationsOutputSchema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_RELATE_OBSERVATIONS_OUTPUT_SCHEMA_VERSION,
    ),
    propositions: z.array(EvidencePropositionCandidateSchema),
    events: z.array(EvidenceEventCandidateSchema),
    relations: z.array(EvidenceRelationCandidateSchema),
    openQuestions: z.array(EvidenceOpenQuestionCandidateSchema),
  })
  .strict();

export const EvidenceBuildTimelineInputSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_BUILD_TIMELINE_INPUT_SCHEMA_VERSION),
    observations: z
      .array(
        z
          .object({
            observationId: EvidenceNonBlankStringSchema,
            temporalBound: EvidenceTemporalBoundSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

/** Empty model payload — timeline is derived purely from input. */
export const EvidenceBuildTimelineOutputSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_BUILD_TIMELINE_OUTPUT_SCHEMA_VERSION),
  })
  .strict();

export const EvidenceProposeAssessmentInputV1Schema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PROPOSE_ASSESSMENT_INPUT_SCHEMA_VERSION),
    workspaceId: EvidenceNonBlankStringSchema,
    sequence: z.number().int().positive(),
    basisEvidenceRevision: z.number().int().nonnegative(),
    acceptedObservationIds: sortedUniqueStrings(1),
    acceptedRelationIds: sortedUniqueStrings(),
    acceptedOpenQuestionIds: sortedUniqueStrings(),
    predecessorAssessmentVersionId: EvidenceDerivedIdSchema.nullable(),
  })
  .strict();

export const EvidenceProposeAssessmentInputV2Schema = z
  .object({
    schemaVersion: z.literal(
      EVIDENCE_PROPOSE_ASSESSMENT_INPUT_SCHEMA_VERSION_V2,
    ),
    workspaceId: EvidenceNonBlankStringSchema,
    sequence: z.number().int().positive(),
    basisEvidenceRevision: z.number().int().nonnegative(),
    acceptedObservations: z.array(EvidenceObservationSchema).min(1),
    acceptedRelations: z.array(EvidenceRelationSchema),
    acceptedOpenQuestions: z.array(EvidenceOpenQuestionSchema),
    predecessorAssessmentVersionId: EvidenceDerivedIdSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [path, ids] of [
      [
        'acceptedObservations',
        value.acceptedObservations.map((item) => item.observationId),
      ],
      [
        'acceptedRelations',
        value.acceptedRelations.map((item) => item.relationId),
      ],
      [
        'acceptedOpenQuestions',
        value.acceptedOpenQuestions.map((item) => item.openQuestionId),
      ],
    ] as const) {
      if (
        new Set(ids).size !== ids.length ||
        ids.some((id, index) => index > 0 && (ids[index - 1] as string) > id)
      )
        context.addIssue({
          code: 'custom',
          path: [path],
          message: 'Accepted evidence must be unique and sorted by identity.',
        });
    }
  });

export const EvidenceProposeAssessmentInputSchema = z.discriminatedUnion(
  'schemaVersion',
  [
    EvidenceProposeAssessmentInputV1Schema,
    EvidenceProposeAssessmentInputV2Schema,
  ],
);

export const EvidenceProposeAssessmentOutputSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_PROPOSE_ASSESSMENT_OUTPUT_SCHEMA_VERSION),
    claims: z.array(EvidenceAssessmentClaimSchema).min(1),
    openQuestionIds: sortedUniqueStrings(),
    citations: z.array(EvidenceAssessmentCitationSchema),
  })
  .strict();

export const EvidenceMemoryValueSchema = z.discriminatedUnion('kind', [
  EvidenceStatementOccurrenceSchema,
  EvidenceExhibitAssertionSchema,
  EvidencePropositionSchema,
  EvidenceEventOccurrenceSchema,
  EvidenceRelationSchema,
  EvidenceOpenQuestionSchema,
]);

export type EvidenceArtifactKind = z.infer<typeof EvidenceArtifactKindSchema>;
export type SourceArtifactVersion = z.infer<typeof SourceArtifactVersionSchema>;
export type EvidenceLocator = z.infer<typeof EvidenceLocatorSchema>;
export type EvidenceActorResolution = z.infer<
  typeof EvidenceActorResolutionSchema
>;
export type EvidenceActorReference = z.infer<
  typeof EvidenceActorReferenceSchema
>;
export type EvidenceTemporalBound = z.infer<typeof EvidenceTemporalBoundSchema>;
export type EvidenceStatementOccurrence = z.infer<
  typeof EvidenceStatementOccurrenceSchema
>;
export type EvidenceExhibitAssertion = z.infer<
  typeof EvidenceExhibitAssertionSchema
>;
export type EvidenceObservation = z.infer<typeof EvidenceObservationSchema>;
export type EvidenceProposition = z.infer<typeof EvidencePropositionSchema>;
export type EvidenceEventOccurrence = z.infer<
  typeof EvidenceEventOccurrenceSchema
>;
export type EvidenceComparableScope = z.infer<
  typeof EvidenceComparableScopeSchema
>;
export type EvidenceRelation = z.infer<typeof EvidenceRelationSchema>;
export type EvidenceOpenQuestion = z.infer<typeof EvidenceOpenQuestionSchema>;
export type EvidenceAssessment = z.infer<typeof EvidenceAssessmentSchema>;
export type EvidenceObjectKind = z.infer<typeof EvidenceObjectKindSchema>;
export type EvidenceStanding = z.infer<typeof EvidenceStandingSchema>;
export type EvidenceObjectStanding = z.infer<
  typeof EvidenceObjectStandingSchema
>;
export type EvidenceState = z.infer<typeof EvidenceStateSchema>;
export type EvidenceStandingChange = z.infer<
  typeof EvidenceStandingChangeSchema
>;
export type EvidenceDelta = z.infer<typeof EvidenceDeltaSchema>;
export type EvidenceObserveArtifactInputV1 = z.infer<
  typeof EvidenceObserveArtifactInputV1Schema
>;
export type EvidenceObserveArtifactInput = z.infer<
  typeof EvidenceObserveArtifactInputSchema
>;
export type EvidenceObserveArtifactOutput = z.infer<
  typeof EvidenceObserveArtifactOutputSchema
>;
export type EvidenceObserveArtifactOutputV1 = z.infer<
  typeof EvidenceObserveArtifactOutputV1Schema
>;
export type EvidenceObserveArtifactOutputV2 = z.infer<
  typeof EvidenceObserveArtifactOutputV2Schema
>;
export type EvidenceObserveArtifactOutputV3 = z.infer<
  typeof EvidenceObserveArtifactOutputV3Schema
>;
export type EvidenceObserveArtifactOutputV4 = z.infer<
  typeof EvidenceObserveArtifactOutputV4Schema
>;
export type EvidenceObserveArtifactReplayOutput = z.infer<
  typeof EvidenceObserveArtifactReplayOutputSchema
>;
export type EvidenceRelateObservationsInput = z.infer<
  typeof EvidenceRelateObservationsInputSchema
>;
export type EvidenceRelateObservationsOutput = z.infer<
  typeof EvidenceRelateObservationsOutputSchema
>;
export type EvidenceBuildTimelineInput = z.infer<
  typeof EvidenceBuildTimelineInputSchema
>;
export type EvidenceBuildTimelineOutput = z.infer<
  typeof EvidenceBuildTimelineOutputSchema
>;
export type EvidenceProposeAssessmentInput = z.infer<
  typeof EvidenceProposeAssessmentInputSchema
>;
export type EvidenceProposeAssessmentInputV1 = z.infer<
  typeof EvidenceProposeAssessmentInputV1Schema
>;
export type EvidenceProposeAssessmentOutput = z.infer<
  typeof EvidenceProposeAssessmentOutputSchema
>;
export type EvidenceMemoryValue = z.infer<typeof EvidenceMemoryValueSchema>;
