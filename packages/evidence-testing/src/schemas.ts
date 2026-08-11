import { z } from 'zod';

import {
  EVIDENCE_LOCATOR_SCHEME,
  EvidenceActorResolutionSchema,
  EvidenceActorSourceRoleSchema,
  EvidenceArtifactKindSchema,
  EvidenceLogicalArtifactIdSchema,
  EvidenceNonBlankStringSchema,
  EvidenceRelationKindSchema,
  EvidenceSha256Schema,
  EvidenceStandingSchema,
  EvidenceTemporalBoundSchema,
  EvidenceTemporalRoleSchema,
} from '@acme/module-evidence';

export const EVIDENCE_CORPUS_ID = 'rillford-annex-review-1' as const;
export const EVIDENCE_CORPUS_MANIFEST_SCHEMA_VERSION =
  'evidence-corpus-manifest/1' as const;
export const EVIDENCE_CORPUS_TRUTH_SCHEMA_VERSION =
  'evidence-corpus-truth/1' as const;
export const EVIDENCE_GOLDEN_RUN_SCHEMA_VERSION =
  'evidence-golden-run/1' as const;

export const EvidenceCorpusPartitionSchema = z.enum([
  'scratch',
  'development',
  'evaluation',
]);

function sortedUniqueStrings(minimum = 0) {
  return z
    .array(EvidenceNonBlankStringSchema)
    .min(minimum)
    .superRefine((values, context) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({ code: 'custom', message: 'Values must be unique.' });
      }
      if (
        values.some(
          (value, index) => index > 0 && (values[index - 1] as string) > value,
        )
      ) {
        context.addIssue({ code: 'custom', message: 'Values must be sorted.' });
      }
    });
}

const CorpusPartitionEntrySchema = z
  .object({
    id: EvidenceCorpusPartitionSchema,
    actorNamespace: EvidenceNonBlankStringSchema,
    eventNamespace: EvidenceNonBlankStringSchema,
  })
  .strict();

const CorpusArtifactSchema = z
  .object({
    partition: EvidenceCorpusPartitionSchema,
    logicalArtifactId: EvidenceLogicalArtifactIdSchema,
    title: EvidenceNonBlankStringSchema,
    kind: EvidenceArtifactKindSchema,
    versionOrdinals: z.array(z.number().int().positive()).min(1),
  })
  .strict();

export const CorpusVersionSchema = z
  .object({
    partition: EvidenceCorpusPartitionSchema,
    logicalArtifactId: EvidenceLogicalArtifactIdSchema,
    artifactVersionId: z.string().regex(/^evidence_artifact_[0-9a-f]{64}$/u),
    versionOrdinal: z.number().int().positive(),
    kind: EvidenceArtifactKindSchema,
    title: EvidenceNonBlankStringSchema,
    contentPath: EvidenceNonBlankStringSchema,
    contentSha256: EvidenceSha256Schema,
    locatorScheme: z.literal(EVIDENCE_LOCATOR_SCHEME),
    lineCount: z.number().int().positive(),
    predecessorVersionId: z
      .string()
      .regex(/^evidence_artifact_[0-9a-f]{64}$/u)
      .nullable(),
    correctionReason: z.literal('transcription-correction').nullable(),
  })
  .strict();

export const EvidenceCorpusManifestSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_CORPUS_MANIFEST_SCHEMA_VERSION),
    corpusId: z.literal(EVIDENCE_CORPUS_ID),
    fictionNotice: EvidenceNonBlankStringSchema,
    sourcePolicy: z
      .object({
        data: z.literal('synthetic-only'),
        media: z.literal('text-only'),
        context: z.literal('no-criminal-offence-context'),
      })
      .strict(),
    partitions: z.array(CorpusPartitionEntrySchema).length(3),
    artifacts: z.array(CorpusArtifactSchema).length(7),
    versions: z.array(CorpusVersionSchema).length(8),
  })
  .strict();

const TruthActorSchema = z
  .object({
    sourceLabel: EvidenceNonBlankStringSchema,
    sourceRole: EvidenceActorSourceRoleSchema,
    resolution: EvidenceActorResolutionSchema,
  })
  .strict();

const TruthTemporalSchema = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('exact'),
        role: EvidenceTemporalRoleSchema,
        at: EvidenceNonBlankStringSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal('range'),
        role: EvidenceTemporalRoleSchema,
        from: EvidenceNonBlankStringSchema,
        to: EvidenceNonBlankStringSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal('approximate'),
        role: EvidenceTemporalRoleSchema,
        center: EvidenceNonBlankStringSchema,
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
  ])
  .superRefine((value, context) => {
    if (value.kind === 'range' && value.from > value.to) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Temporal range end must not precede its start.',
      });
    }
  });

export const TruthObservationSchema = z
  .object({
    truthId: EvidenceNonBlankStringSchema,
    kind: z.enum(['statement-occurrence', 'exhibit-assertion']),
    logicalArtifactId: EvidenceLogicalArtifactIdSchema,
    versionOrdinal: z.number().int().positive(),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    exactQuote: EvidenceNonBlankStringSchema,
    meaning: EvidenceNonBlankStringSchema,
    sourceActor: TruthActorSchema.nullable(),
    temporalBound: TruthTemporalSchema,
    finalStanding: EvidenceStandingSchema,
  })
  .strict()
  .refine((value) => value.startLine <= value.endLine, {
    path: ['endLine'],
    message: 'Observation line range is inverted.',
  });

const TruthCorrectionSchema = z
  .object({
    truthId: EvidenceNonBlankStringSchema,
    predecessorObservationTruthId: EvidenceNonBlankStringSchema,
    successorObservationTruthId: EvidenceNonBlankStringSchema,
    reason: z.literal('transcription-correction'),
  })
  .strict();

const TruthActorResolutionSchema = z
  .object({
    truthId: EvidenceNonBlankStringSchema,
    observationTruthId: EvidenceNonBlankStringSchema,
    sourceLabel: EvidenceNonBlankStringSchema,
    resolution: EvidenceActorResolutionSchema,
  })
  .strict();

const TruthRelationEndpointSchema = z
  .object({
    kind: z.enum(['observation', 'actor']),
    ref: EvidenceNonBlankStringSchema,
  })
  .strict();

export const TruthRelationSchema = z
  .object({
    truthId: EvidenceNonBlankStringSchema,
    relationKind: EvidenceRelationKindSchema,
    endpoints: z.array(TruthRelationEndpointSchema).min(2),
    comparableScope: z
      .object({
        subject: EvidenceNonBlankStringSchema,
        aspect: EvidenceNonBlankStringSchema,
        actorReferenceTruthIds: sortedUniqueStrings(),
        temporalObservationTruthIds: sortedUniqueStrings(),
      })
      .strict(),
    rationaleCode: EvidenceNonBlankStringSchema,
    rationale: EvidenceNonBlankStringSchema,
    expectedStanding: EvidenceStandingSchema,
  })
  .strict();

export const TruthOpenQuestionSchema = z
  .object({
    truthId: EvidenceNonBlankStringSchema,
    questionCode: EvidenceNonBlankStringSchema,
    questionText: EvidenceNonBlankStringSchema,
    triggeringTruthIds: sortedUniqueStrings(1),
    expectedStanding: EvidenceStandingSchema,
  })
  .strict();

const TruthAssessmentClaimSchema = z
  .object({
    claimKey: EvidenceNonBlankStringSchema,
    text: EvidenceNonBlankStringSchema,
    supportObservationTruthIds: sortedUniqueStrings(),
    conflictRelationTruthIds: sortedUniqueStrings(),
    qualificationRelationTruthIds: sortedUniqueStrings(),
    supportUnresolved: z.boolean(),
    uncertainty: z.enum(['low', 'medium', 'high']),
    uncertaintyRationale: EvidenceNonBlankStringSchema,
  })
  .strict();

export const TruthAssessmentSchema = z
  .object({
    truthId: EvidenceNonBlankStringSchema,
    workspaceId: EvidenceNonBlankStringSchema,
    sequence: z.number().int().positive(),
    basisEvidenceRevision: z.number().int().nonnegative(),
    claims: z.array(TruthAssessmentClaimSchema).min(1),
    openQuestionTruthIds: sortedUniqueStrings(),
    citationTruthIds: sortedUniqueStrings(1),
    predecessorAssessmentTruthId: EvidenceNonBlankStringSchema.nullable(),
    reviewExpectation: z.enum(['accepted', 'reviewed-revision']),
  })
  .strict();

const TruthScenarioSchema = z
  .object({
    scenarioId: EvidenceNonBlankStringSchema,
    orderedSteps: z.array(EvidenceNonBlankStringSchema).min(1),
    inputArtifactVersionIds: sortedUniqueStrings(1),
    expectedEvidenceRevision: z.number().int().nonnegative(),
    expectedReviewOverlay: sortedUniqueStrings(),
    expectedRefusals: sortedUniqueStrings(),
    expectedReplayVerdicts: sortedUniqueStrings(),
  })
  .strict();

const TruthCouplingGroupSchema = z
  .object({
    groupId: EvidenceNonBlankStringSchema,
    truthIds: sortedUniqueStrings(2),
    rationale: EvidenceNonBlankStringSchema,
  })
  .strict();

export const EvidenceCorpusTruthSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_CORPUS_TRUTH_SCHEMA_VERSION),
    corpusId: z.literal(EVIDENCE_CORPUS_ID),
    partition: EvidenceCorpusPartitionSchema,
    annotation: z
      .object({
        status: z.enum(['open', 'sealed', 'scratch']),
        firstAnnotator: EvidenceNonBlankStringSchema,
        secondAnnotator: EvidenceNonBlankStringSchema,
        resolutionNote: EvidenceNonBlankStringSchema,
      })
      .strict(),
    observations: z.array(TruthObservationSchema),
    correctionLineage: z.array(TruthCorrectionSchema),
    actorResolutions: z.array(TruthActorResolutionSchema),
    relations: z.array(TruthRelationSchema),
    openQuestions: z.array(TruthOpenQuestionSchema),
    assessments: z.array(TruthAssessmentSchema),
    scenarios: z.array(TruthScenarioSchema).min(1),
    couplingGroups: z.array(TruthCouplingGroupSchema),
  })
  .strict();

export const EvidenceGoldenStandingSchema = z
  .object({
    objectKind: EvidenceNonBlankStringSchema,
    objectId: EvidenceNonBlankStringSchema,
    standing: EvidenceStandingSchema,
  })
  .strict();

export const EvidenceGoldenRunSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_GOLDEN_RUN_SCHEMA_VERSION),
    corpusId: z.literal(EVIDENCE_CORPUS_ID),
    partition: EvidenceCorpusPartitionSchema,
    scenarioId: EvidenceNonBlankStringSchema,
    inputArtifactVersionIds: sortedUniqueStrings(),
    expectedObservationIds: sortedUniqueStrings(),
    expectedRelationIds: sortedUniqueStrings(),
    expectedOpenQuestionIds: sortedUniqueStrings(),
    expectedAssessmentVersionIds: sortedUniqueStrings(),
    expectedStandings: z.array(EvidenceGoldenStandingSchema),
    expectedEvidenceRevision: z.number().int().nonnegative(),
    expectedReviewOverlay: sortedUniqueStrings(),
    expectedRefusals: sortedUniqueStrings(),
    expectedReplayVerdicts: sortedUniqueStrings(),
  })
  .strict();

const IdentityAlgorithmVectorSchema = z
  .object({
    algorithm: EvidenceNonBlankStringSchema,
    expected: EvidenceNonBlankStringSchema,
  })
  .passthrough();

export const EvidenceIdentityVectorsSchema = z
  .object({
    schemaVersion: z.literal('evidence-identity-vectors/1'),
    canonicalization: z
      .object({
        algorithm: z.literal('evidence-text-canonicalization-1'),
        input: z.string(),
        canonical: z.string(),
      })
      .strict(),
    contentHash: z
      .object({
        inputArtifactVersionId: EvidenceNonBlankStringSchema,
        expected: EvidenceSha256Schema,
      })
      .strict(),
    artifactVersion: IdentityAlgorithmVectorSchema,
    locator: IdentityAlgorithmVectorSchema,
    actorReference: IdentityAlgorithmVectorSchema,
    observation: IdentityAlgorithmVectorSchema,
    proposition: IdentityAlgorithmVectorSchema,
    event: z
      .object({
        algorithm: z.literal('evidence-event-id-1'),
        input: z
          .object({
            supportingObservationIds: sortedUniqueStrings(1),
            actorReferenceKeys: sortedUniqueStrings(),
            temporalBound: EvidenceTemporalBoundSchema,
          })
          .strict(),
        expected: EvidenceNonBlankStringSchema,
      })
      .strict(),
    relation: IdentityAlgorithmVectorSchema,
    openQuestion: IdentityAlgorithmVectorSchema,
    assessment: z
      .object({
        contentHashAlgorithm: z.literal('evidence-assessment-content-hash-1'),
        idAlgorithm: z.literal('evidence-assessment-id-1'),
        truthId: EvidenceNonBlankStringSchema,
        expectedContentHash: EvidenceSha256Schema,
        expectedId: EvidenceNonBlankStringSchema,
      })
      .strict(),
  })
  .strict();

export type EvidenceCorpusPartition = z.infer<
  typeof EvidenceCorpusPartitionSchema
>;
export type CorpusVersion = z.infer<typeof CorpusVersionSchema>;
export type EvidenceCorpusManifest = z.infer<
  typeof EvidenceCorpusManifestSchema
>;
export type TruthObservation = z.infer<typeof TruthObservationSchema>;
export type TruthRelation = z.infer<typeof TruthRelationSchema>;
export type EvidenceCorpusTruth = z.infer<typeof EvidenceCorpusTruthSchema>;
export type EvidenceGoldenRun = z.infer<typeof EvidenceGoldenRunSchema>;
export type EvidenceIdentityVectors = z.infer<
  typeof EvidenceIdentityVectorsSchema
>;
