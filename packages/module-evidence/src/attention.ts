import { z } from 'zod';

import { immutableEvidence } from './immutable.js';
import { evidenceTemporalOverlap } from './temporal.js';
import {
  EvidenceNonBlankStringSchema,
  EvidenceTemporalBoundSchema,
  type EvidenceTemporalBound,
} from './schemas.js';

export const EVIDENCE_CHANGE_SET_SCHEMA_VERSION =
  'evidence-change-set/1' as const;
export const EVIDENCE_ATTENTION_TIER_ALGORITHM =
  'evidence-attention-tier-1' as const;

const sortedUniqueStrings = z
  .array(EvidenceNonBlankStringSchema)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: 'custom', message: 'Values must be unique.' });
    }
    if (
      values.some((value, index) => {
        const previous = values[index - 1];
        return index > 0 && previous !== undefined && previous > value;
      })
    ) {
      context.addIssue({ code: 'custom', message: 'Values must be sorted.' });
    }
  });

export const EvidenceChangeSetSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_CHANGE_SET_SCHEMA_VERSION),
    fromEvidenceRevision: z.number().int().nonnegative(),
    toEvidenceRevision: z.number().int().positive(),
    addedArtifactVersionIds: sortedUniqueStrings,
    addedObservationIds: sortedUniqueStrings,
    addedRelationIds: sortedUniqueStrings,
    addedOpenQuestionIds: sortedUniqueStrings,
    standingChanges: z.array(
      z
        .object({
          objectId: EvidenceNonBlankStringSchema,
          from: EvidenceNonBlankStringSchema.nullable(),
          to: EvidenceNonBlankStringSchema,
        })
        .strict(),
    ),
    actorReferenceKeys: sortedUniqueStrings,
    relationEndpointIds: sortedUniqueStrings,
    temporalBounds: z.array(EvidenceTemporalBoundSchema),
  })
  .strict()
  .refine((value) => value.toEvidenceRevision > value.fromEvidenceRevision, {
    path: ['toEvidenceRevision'],
    message: 'A change set must advance the evidence revision.',
  });

export type EvidenceChangeSet = z.infer<typeof EvidenceChangeSetSchema>;

export type EvidenceAttentionTier = 'A' | 'B' | 'none';

export interface EvidenceAssessmentAttentionInput {
  readonly assessmentVersionId: string;
  readonly basisEvidenceRevision: number;
  readonly effectiveBasisEvidenceRevision: number;
  readonly workspaceEvidenceRevision: number;
  readonly citedArtifactVersionIds: readonly string[];
  readonly citedActorReferenceKeys: readonly string[];
  readonly citedRelationEndpointIds: readonly string[];
  readonly citedTemporalBounds: readonly EvidenceTemporalBound[];
}

export function evidenceAssessmentDueForAttention(input: {
  readonly workspaceEvidenceRevision: number;
  readonly effectiveBasisEvidenceRevision: number;
}): boolean {
  return input.workspaceEvidenceRevision > input.effectiveBasisEvidenceRevision;
}

export function evidenceAttentionTier(
  assessment: EvidenceAssessmentAttentionInput,
  changeSet: EvidenceChangeSet,
): EvidenceAttentionTier {
  if (
    !evidenceAssessmentDueForAttention({
      workspaceEvidenceRevision: assessment.workspaceEvidenceRevision,
      effectiveBasisEvidenceRevision: assessment.effectiveBasisEvidenceRevision,
    })
  ) {
    return 'none';
  }
  const artifactHit = assessment.citedArtifactVersionIds.some((id) =>
    changeSet.addedArtifactVersionIds.includes(id),
  );
  const actorHit = assessment.citedActorReferenceKeys.some((key) =>
    changeSet.actorReferenceKeys.includes(key),
  );
  const endpointHit = assessment.citedRelationEndpointIds.some((id) =>
    changeSet.relationEndpointIds.includes(id),
  );
  const temporalHit = assessment.citedTemporalBounds.some((left) =>
    changeSet.temporalBounds.some((right) =>
      evidenceTemporalOverlap(left, right),
    ),
  );
  if (artifactHit || actorHit || endpointHit || temporalHit) return 'A';
  return 'B';
}

export function createEvidenceChangeSet(
  value: Omit<EvidenceChangeSet, 'schemaVersion'>,
): EvidenceChangeSet {
  return immutableEvidence(
    EvidenceChangeSetSchema.parse({
      schemaVersion: EVIDENCE_CHANGE_SET_SCHEMA_VERSION,
      ...value,
      addedArtifactVersionIds: [
        ...new Set(value.addedArtifactVersionIds),
      ].sort(),
      addedObservationIds: [...new Set(value.addedObservationIds)].sort(),
      addedRelationIds: [...new Set(value.addedRelationIds)].sort(),
      addedOpenQuestionIds: [...new Set(value.addedOpenQuestionIds)].sort(),
      actorReferenceKeys: [...new Set(value.actorReferenceKeys)].sort(),
      relationEndpointIds: [...new Set(value.relationEndpointIds)].sort(),
    }),
  );
}
