import { immutableEvidence } from './immutable.js';
import { evidenceTemporalOverlap } from './temporal.js';
import type { EvidenceTemporalBound } from './schemas.js';

export const EVIDENCE_CHANGE_SET_SCHEMA_VERSION =
  'evidence-change-set/1' as const;
export const EVIDENCE_ATTENTION_TIER_ALGORITHM =
  'evidence-attention-tier-1' as const;

export interface EvidenceChangeSet {
  readonly schemaVersion: typeof EVIDENCE_CHANGE_SET_SCHEMA_VERSION;
  readonly fromEvidenceRevision: number;
  readonly toEvidenceRevision: number;
  readonly addedArtifactVersionIds: readonly string[];
  readonly addedObservationIds: readonly string[];
  readonly addedRelationIds: readonly string[];
  readonly addedOpenQuestionIds: readonly string[];
  readonly standingChanges: readonly {
    readonly objectId: string;
    readonly from: string | null;
    readonly to: string;
  }[];
  readonly actorReferenceKeys: readonly string[];
  readonly relationEndpointIds: readonly string[];
  readonly temporalBounds: readonly EvidenceTemporalBound[];
}

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
  return immutableEvidence({
    schemaVersion: EVIDENCE_CHANGE_SET_SCHEMA_VERSION,
    ...value,
    addedArtifactVersionIds: [...value.addedArtifactVersionIds].sort(),
    addedObservationIds: [...value.addedObservationIds].sort(),
    addedRelationIds: [...value.addedRelationIds].sort(),
    addedOpenQuestionIds: [...value.addedOpenQuestionIds].sort(),
    actorReferenceKeys: [...value.actorReferenceKeys].sort(),
    relationEndpointIds: [...value.relationEndpointIds].sort(),
  });
}
