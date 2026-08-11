import { canonicalJson, sha256, type JsonValue } from '@acme/core';
import { z } from 'zod';

import { evidenceTextBytes } from './canonical-text.js';
import {
  EvidenceActorReferenceSchema,
  EvidenceActorSourceRoleSchema,
  EvidenceArtifactKindSchema,
  EvidenceComparableScopeSchema,
  EvidenceDerivedIdSchema,
  EvidenceLogicalArtifactIdSchema,
  EvidenceMemoryValueSchema,
  EvidenceNonBlankStringSchema,
  EvidenceRelationEndpointSchema,
  EvidenceSha256Schema,
  EvidenceTemporalBoundSchema,
  type EvidenceActorReference,
  type EvidenceArtifactKind,
  type EvidenceAssessment,
  type EvidenceComparableScope,
  type EvidenceMemoryValue,
  type EvidenceRelation,
  type EvidenceTemporalBound,
  type SourceArtifactVersion,
} from './schemas.js';

const sortedUniqueDerivedIds = (minimum = 0) =>
  z
    .array(EvidenceDerivedIdSchema)
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

const ArtifactVersionIdentityInputSchema = z
  .object({
    corpusId: EvidenceNonBlankStringSchema,
    logicalArtifactId: EvidenceLogicalArtifactIdSchema,
    versionOrdinal: z.number().int().positive(),
    kind: EvidenceArtifactKindSchema,
    contentHash: EvidenceSha256Schema,
    locatorScheme: z.literal('line-range-1'),
    predecessorVersionId: EvidenceDerivedIdSchema.nullable(),
  })
  .strict();

const LocatorIdentityInputSchema = z
  .object({
    artifactVersionId: EvidenceDerivedIdSchema,
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  })
  .strict()
  .refine((value) => value.startLine <= value.endLine, {
    path: ['endLine'],
    message: 'Locator end line must not precede its start line.',
  });

const ActorReferenceIdentityInputSchema = z
  .object({
    artifactVersionId: EvidenceDerivedIdSchema,
    locatorId: EvidenceDerivedIdSchema,
    sourceLabel: EvidenceNonBlankStringSchema,
    sourceRole: EvidenceActorSourceRoleSchema,
  })
  .strict();

const PropositionIdentityInputSchema = z
  .object({
    observationIds: sortedUniqueDerivedIds(1),
    normalizedProposition: EvidenceNonBlankStringSchema,
  })
  .strict();

const EventIdentityInputSchema = z
  .object({
    supportingObservationIds: sortedUniqueDerivedIds(1),
    actorReferenceKeys: sortedUniqueDerivedIds(),
    temporalBound: EvidenceTemporalBoundSchema,
  })
  .strict();

const OpenQuestionIdentityInputSchema = z
  .object({
    triggeringEvidenceIds: sortedUniqueDerivedIds(1),
    questionCode: EvidenceNonBlankStringSchema,
    questionText: EvidenceNonBlankStringSchema,
  })
  .strict();

const AssessmentIdentityInputSchema = z
  .object({
    workspaceId: EvidenceNonBlankStringSchema,
    sequence: z.number().int().positive(),
    basisEvidenceRevision: z.number().int().nonnegative(),
    contentHash: EvidenceSha256Schema,
  })
  .strict();

export const EVIDENCE_ARTIFACT_VERSION_ID_ALGORITHM =
  'evidence-artifact-version-id-1' as const;
export const EVIDENCE_LOCATOR_ID_ALGORITHM = 'evidence-locator-id-1' as const;
export const EVIDENCE_ACTOR_REFERENCE_KEY_ALGORITHM =
  'evidence-actor-reference-key-1' as const;
export const EVIDENCE_OBSERVATION_ID_ALGORITHM =
  'evidence-observation-id-1' as const;
export const EVIDENCE_PROPOSITION_ID_ALGORITHM =
  'evidence-proposition-id-1' as const;
export const EVIDENCE_EVENT_ID_ALGORITHM = 'evidence-event-id-1' as const;
export const EVIDENCE_RELATION_ID_ALGORITHM = 'evidence-relation-id-1' as const;
export const EVIDENCE_OPEN_QUESTION_ID_ALGORITHM =
  'evidence-open-question-id-1' as const;
export const EVIDENCE_ASSESSMENT_CONTENT_HASH_ALGORITHM =
  'evidence-assessment-content-hash-1' as const;
export const EVIDENCE_ASSESSMENT_ID_ALGORITHM =
  'evidence-assessment-id-1' as const;

function identity(prefix: string, preimage: JsonValue): string {
  return `${prefix}_${sha256(canonicalJson(preimage))}`;
}

export function deriveEvidenceContentHash(text: string): string {
  return sha256(evidenceTextBytes(text));
}

export interface EvidenceArtifactVersionIdentityInput {
  readonly corpusId: string;
  readonly logicalArtifactId: string;
  readonly versionOrdinal: number;
  readonly kind: EvidenceArtifactKind;
  readonly contentHash: string;
  readonly locatorScheme: 'line-range-1';
  readonly predecessorVersionId: string | null;
}

export function deriveEvidenceArtifactVersionId(
  input: EvidenceArtifactVersionIdentityInput,
): string {
  const parsed = ArtifactVersionIdentityInputSchema.parse({
    corpusId: input.corpusId,
    logicalArtifactId: input.logicalArtifactId,
    versionOrdinal: input.versionOrdinal,
    kind: input.kind,
    contentHash: input.contentHash,
    locatorScheme: input.locatorScheme,
    predecessorVersionId: input.predecessorVersionId,
  });
  return identity('evidence_artifact', {
    algorithm: EVIDENCE_ARTIFACT_VERSION_ID_ALGORITHM,
    ...parsed,
  });
}

export function deriveEvidenceLocatorId(input: {
  readonly artifactVersionId: string;
  readonly startLine: number;
  readonly endLine: number;
}): string {
  const parsed = LocatorIdentityInputSchema.parse({
    artifactVersionId: input.artifactVersionId,
    startLine: input.startLine,
    endLine: input.endLine,
  });
  return identity('evidence_locator', {
    algorithm: EVIDENCE_LOCATOR_ID_ALGORITHM,
    ...parsed,
  });
}

export function deriveEvidenceActorReferenceKey(input: {
  readonly artifactVersionId: string;
  readonly locatorId: string;
  readonly sourceLabel: string;
  readonly sourceRole: EvidenceActorReference['sourceRole'];
}): string {
  const parsed = ActorReferenceIdentityInputSchema.parse({
    artifactVersionId: input.artifactVersionId,
    locatorId: input.locatorId,
    sourceLabel: input.sourceLabel,
    sourceRole: input.sourceRole,
  });
  return identity('evidence_actor', {
    algorithm: EVIDENCE_ACTOR_REFERENCE_KEY_ALGORITHM,
    ...parsed,
  });
}

export function deriveEvidenceObservationId(input: {
  readonly kind: 'statement-occurrence' | 'exhibit-assertion';
  readonly artifactVersionId: string;
  readonly locatorId: string;
  readonly exactQuote: string;
  readonly sourceActorReference: EvidenceActorReference | null;
  readonly temporalBound: EvidenceTemporalBound | null;
}): string {
  const sourceActorReference =
    input.sourceActorReference === null
      ? null
      : EvidenceActorReferenceSchema.parse(input.sourceActorReference);
  const temporalBound =
    input.temporalBound === null
      ? null
      : EvidenceTemporalBoundSchema.parse(input.temporalBound);
  return identity('evidence_observation', {
    algorithm: EVIDENCE_OBSERVATION_ID_ALGORITHM,
    kind: input.kind,
    artifactVersionId: input.artifactVersionId,
    locatorId: input.locatorId,
    exactQuote: input.exactQuote,
    sourceActorReference: sourceActorReference as unknown as JsonValue,
    temporalBound: temporalBound as unknown as JsonValue,
  });
}

export function deriveEvidencePropositionId(input: {
  readonly observationIds: readonly string[];
  readonly normalizedProposition: string;
}): string {
  const parsed = PropositionIdentityInputSchema.parse({
    observationIds: [...input.observationIds].sort(),
    normalizedProposition: input.normalizedProposition,
  });
  return identity('evidence_proposition', {
    algorithm: EVIDENCE_PROPOSITION_ID_ALGORITHM,
    ...parsed,
  });
}

function canonicalTemporalBounds(
  values: readonly EvidenceTemporalBound[],
): readonly JsonValue[] {
  return values
    .map(
      (value) =>
        EvidenceTemporalBoundSchema.parse(value) as unknown as JsonValue,
    )
    .sort((left, right) =>
      canonicalJson(left).localeCompare(canonicalJson(right)),
    );
}

export function deriveEvidenceEventId(input: {
  readonly supportingObservationIds: readonly string[];
  readonly actorReferenceKeys: readonly string[];
  readonly temporalBound: EvidenceTemporalBound;
}): string {
  const parsed = EventIdentityInputSchema.parse({
    supportingObservationIds: [...input.supportingObservationIds].sort(),
    actorReferenceKeys: [...input.actorReferenceKeys].sort(),
    temporalBound: input.temporalBound,
  });
  return identity('evidence_event', {
    algorithm: EVIDENCE_EVENT_ID_ALGORITHM,
    ...parsed,
  } as unknown as JsonValue);
}

function canonicalEndpoints(
  endpoints: EvidenceRelation['endpoints'],
): readonly JsonValue[] {
  return endpoints
    .map((value) => EvidenceRelationEndpointSchema.parse(value))
    .sort((left, right) =>
      `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`),
    ) as unknown as readonly JsonValue[];
}

function canonicalScope(scope: EvidenceComparableScope): JsonValue {
  const parsed = EvidenceComparableScopeSchema.parse(scope);
  return {
    subject: parsed.subject,
    aspect: parsed.aspect,
    actorReferenceKeys: [...parsed.actorReferenceKeys].sort(),
    temporalBounds: canonicalTemporalBounds(parsed.temporalBounds),
  };
}

export function deriveEvidenceRelationId(input: {
  readonly relationKind: EvidenceRelation['relationKind'];
  readonly endpoints: EvidenceRelation['endpoints'];
  readonly comparableScope: EvidenceComparableScope;
  readonly rationale: string;
  readonly predecessorRelationId: string | null;
}): string {
  return identity('evidence_relation', {
    algorithm: EVIDENCE_RELATION_ID_ALGORITHM,
    relationKind: input.relationKind,
    endpoints: canonicalEndpoints(input.endpoints),
    comparableScope: canonicalScope(input.comparableScope),
    rationale: input.rationale,
    predecessorRelationId: input.predecessorRelationId,
  });
}

export function deriveEvidenceOpenQuestionId(input: {
  readonly triggeringEvidenceIds: readonly string[];
  readonly questionCode: string;
  readonly questionText: string;
}): string {
  const parsed = OpenQuestionIdentityInputSchema.parse({
    triggeringEvidenceIds: [...input.triggeringEvidenceIds].sort(),
    questionCode: input.questionCode,
    questionText: input.questionText,
  });
  return identity('evidence_question', {
    algorithm: EVIDENCE_OPEN_QUESTION_ID_ALGORITHM,
    ...parsed,
  });
}

export function deriveEvidenceAssessmentContentHash(
  content: JsonValue,
): string {
  return sha256(
    canonicalJson({
      algorithm: EVIDENCE_ASSESSMENT_CONTENT_HASH_ALGORITHM,
      content,
    }),
  );
}

export function deriveEvidenceAssessmentId(input: {
  readonly workspaceId: string;
  readonly sequence: number;
  readonly basisEvidenceRevision: number;
  readonly contentHash: string;
}): string {
  const parsed = AssessmentIdentityInputSchema.parse({
    workspaceId: input.workspaceId,
    sequence: input.sequence,
    basisEvidenceRevision: input.basisEvidenceRevision,
    contentHash: input.contentHash,
  });
  return identity('evidence_assessment', {
    algorithm: EVIDENCE_ASSESSMENT_ID_ALGORITHM,
    ...parsed,
  });
}

export function evidenceMemoryIdentity(value: EvidenceMemoryValue): string {
  const parsed = EvidenceMemoryValueSchema.parse(value);
  switch (parsed.kind) {
    case 'statement-occurrence':
    case 'exhibit-assertion':
      return parsed.observationId;
    case 'proposition':
      return parsed.propositionId;
    case 'event-occurrence':
      return parsed.eventId;
    case 'evidence-relation':
      return parsed.relationId;
    case 'open-question':
      return parsed.openQuestionId;
  }
}

export function evidenceArtifactIdentityInput(
  value: SourceArtifactVersion,
): EvidenceArtifactVersionIdentityInput {
  return {
    corpusId: value.corpusId,
    logicalArtifactId: value.logicalArtifactId,
    versionOrdinal: value.versionOrdinal,
    kind: value.kind,
    contentHash: value.contentHash,
    locatorScheme: value.locatorScheme,
    predecessorVersionId: value.predecessorVersionId,
  };
}

export function evidenceAssessmentIdentityInput(
  value: EvidenceAssessment,
): Parameters<typeof deriveEvidenceAssessmentId>[0] {
  return {
    workspaceId: value.workspaceId,
    sequence: value.sequence,
    basisEvidenceRevision: value.basisEvidenceRevision,
    contentHash: value.contentHash,
  };
}
