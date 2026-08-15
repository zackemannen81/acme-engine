import { z } from 'zod';

const NonBlank = z.string().trim().min(1);
const Sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const Base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/u);

export const EVIDENCE_ARTIFACT_REPRESENTATION_SCHEMA_VERSION =
  'evidence-artifact-representation/1' as const;
export const EVIDENCE_ARTIFACT_ENVELOPE_SCHEMA_VERSION =
  'evidence-artifact-object-envelope/1' as const;
export const EVIDENCE_ARTIFACT_STAGING_SCHEMA_VERSION =
  'evidence-artifact-staging/1' as const;
export const EVIDENCE_ARTIFACT_LIFECYCLE_SCHEMA_VERSION =
  'evidence-artifact-lifecycle-event/1' as const;
export const EVIDENCE_SECURITY_AUDIT_SCHEMA_VERSION =
  'evidence-security-audit-event/1' as const;

export const EvidenceArtifactRepresentationSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_ARTIFACT_REPRESENTATION_SCHEMA_VERSION),
    representationId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    artifactVersionId: NonBlank,
    kind: z.enum(['original', 'canonical-text', 'redacted-text']),
    mediaType: NonBlank.max(200),
    plaintextSha256: Sha256,
    plaintextByteLength: z.number().int().nonnegative(),
    predecessorRepresentationId: NonBlank.nullable(),
    transformationContract: NonBlank,
    transformationVersion: NonBlank,
    producingCommandKey: NonBlank,
    producingPrincipalRef: NonBlank,
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const EvidenceArtifactObjectEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_ARTIFACT_ENVELOPE_SCHEMA_VERSION),
    representationId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    objectKey: NonBlank,
    algorithm: z.literal('A256GCM'),
    nonceBase64: Base64,
    authenticationTagBase64: Base64,
    wrappedDekBase64: Base64,
    wrapNonceBase64: Base64,
    keyId: NonBlank,
    keyVersion: z.number().int().positive(),
    ciphertextSha256: Sha256,
    ciphertextByteLength: z.number().int().nonnegative(),
    activatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const EvidenceArtifactStagingSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_ARTIFACT_STAGING_SCHEMA_VERSION),
    stagingId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    representationId: NonBlank,
    objectKey: NonBlank,
    commandKey: NonBlank,
    plaintextSha256: Sha256,
    state: z.enum(['staging', 'quarantined', 'activated']),
    stagedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    representation: EvidenceArtifactRepresentationSchema,
    pendingEnvelope: EvidenceArtifactObjectEnvelopeSchema,
  })
  .strict();

export const EvidenceArtifactLifecycleEventSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_ARTIFACT_LIFECYCLE_SCHEMA_VERSION),
    lifecycleEventId: NonBlank,
    caseId: NonBlank,
    workspaceId: NonBlank,
    representationId: NonBlank,
    action: z.enum([
      'activated',
      'deletion-requested',
      'deleted',
      'quarantined',
      'key-rewrapped',
    ]),
    reason: NonBlank,
    principalRef: NonBlank,
    occurredAt: z.iso.datetime({ offset: true }),
    expectedRevision: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const EvidenceSecurityAuditEventV1Schema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_SECURITY_AUDIT_SCHEMA_VERSION),
    auditEventId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank.nullable(),
    principalRef: NonBlank,
    action: z.enum([
      'artifact.stage',
      'artifact.activate',
      'artifact.read',
      'artifact.read-denied',
      'artifact.integrity-failed',
      'artifact.quarantine',
      'artifact.delete',
      'artifact.key-rewrap',
      'artifact.export',
      'artifact.restore-verify',
      'import.requested',
      'import.refused',
      'import.activated',
      'import.cancelled',
      'redaction.draft',
      'redaction.applied',
      'redaction.refused',
    ]),
    outcome: z.enum(['succeeded', 'denied', 'failed']),
    reasonCode: NonBlank,
    resourceKind: z.enum([
      'artifact-representation',
      'artifact-object',
      'case',
    ]),
    resourceId: NonBlank,
    requestId: NonBlank,
    policyVersion: NonBlank,
    keyId: NonBlank.nullable(),
    keyVersion: z.number().int().positive().nullable(),
    beforeDigest: Sha256.nullable(),
    afterDigest: Sha256.nullable(),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const EvidenceLiveSecurityAuditEventSchema = z
  .object({
    schemaVersion: z.literal('evidence-security-audit-event/2'),
    auditEventId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank,
    principalRef: NonBlank,
    action: z.enum([
      'live.refused',
      'live.started',
      'live.completed',
      'live.failed',
    ]),
    outcome: z.enum(['succeeded', 'denied', 'failed']),
    reasonCode: NonBlank,
    resourceKind: z.enum(['live-execution', 'case']),
    resourceId: NonBlank,
    requestId: NonBlank,
    policyVersion: NonBlank,
    keyId: z.null(),
    keyVersion: z.null(),
    beforeDigest: z.null(),
    afterDigest: z.null(),
    occurredAt: z.iso.datetime({ offset: true }),
    task: z.literal('observe-artifact'),
    modelId: NonBlank,
    maxModelCalls: z.literal(1),
    actualModelCalls: z.number().int().min(0).max(1),
    costCeilingMinor: z.number().int().nonnegative().nullable(),
    currency: NonBlank.nullable(),
  })
  .strict();

export const EvidenceLiveRelationSecurityAuditEventSchema = z
  .object({
    schemaVersion: z.literal('evidence-security-audit-event/3'),
    auditEventId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank,
    principalRef: NonBlank,
    action: z.enum([
      'live-relation.refused',
      'live-relation.started',
      'live-relation.completed',
      'live-relation.failed',
    ]),
    outcome: z.enum(['succeeded', 'denied', 'failed']),
    reasonCode: NonBlank,
    resourceKind: z.enum(['live-execution', 'case']),
    resourceId: NonBlank,
    requestId: NonBlank,
    policyVersion: NonBlank,
    keyId: z.null(),
    keyVersion: z.null(),
    beforeDigest: z.null(),
    afterDigest: z.null(),
    occurredAt: z.iso.datetime({ offset: true }),
    task: z.literal('relate-observations'),
    modelId: NonBlank,
    maxModelCalls: z.literal(1),
    actualModelCalls: z.number().int().min(0).max(1),
    costCeilingMinor: z.number().int().nonnegative().nullable(),
    currency: NonBlank.nullable(),
  })
  .strict();

export const EvidenceLiveAssessmentSecurityAuditEventSchema = z
  .object({
    schemaVersion: z.literal('evidence-security-audit-event/4'),
    auditEventId: NonBlank,
    organizationId: NonBlank,
    caseId: NonBlank,
    principalRef: NonBlank,
    action: z.enum([
      'live-assessment.refused',
      'live-assessment.started',
      'live-assessment.completed',
      'live-assessment.failed',
    ]),
    outcome: z.enum(['succeeded', 'denied', 'failed']),
    reasonCode: NonBlank,
    resourceKind: z.enum(['live-execution', 'case']),
    resourceId: NonBlank,
    requestId: NonBlank,
    policyVersion: NonBlank,
    keyId: z.null(),
    keyVersion: z.null(),
    beforeDigest: z.null(),
    afterDigest: z.null(),
    occurredAt: z.iso.datetime({ offset: true }),
    task: z.literal('propose-assessment'),
    modelId: NonBlank,
    maxModelCalls: z.literal(1),
    actualModelCalls: z.number().int().min(0).max(1),
    costCeilingMinor: z.number().int().nonnegative().nullable(),
    currency: NonBlank.nullable(),
  })
  .strict();

export const EvidenceSecurityAuditEventSchema = z.discriminatedUnion(
  'schemaVersion',
  [
    EvidenceSecurityAuditEventV1Schema,
    EvidenceLiveSecurityAuditEventSchema,
    EvidenceLiveRelationSecurityAuditEventSchema,
    EvidenceLiveAssessmentSecurityAuditEventSchema,
  ],
);

export const EvidenceArtifactBackupManifestSchema = z
  .object({
    schemaVersion: z.literal('evidence-artifact-backup-manifest/1'),
    createdAt: z.iso.datetime({ offset: true }),
    objects: z
      .array(
        z
          .object({
            caseId: NonBlank,
            representationId: NonBlank,
            objectKey: NonBlank,
            ciphertextSha256: Sha256,
            ciphertextByteLength: z.number().int().nonnegative(),
            keyId: NonBlank,
            keyVersion: z.number().int().positive(),
          })
          .strict(),
      )
      .readonly(),
    tombstonedRepresentationIds: z.array(NonBlank).readonly(),
    manifestSha256: Sha256,
  })
  .strict();

export type EvidenceArtifactRepresentation = z.infer<
  typeof EvidenceArtifactRepresentationSchema
>;
export type EvidenceArtifactObjectEnvelope = z.infer<
  typeof EvidenceArtifactObjectEnvelopeSchema
>;
export type EvidenceArtifactStaging = z.infer<
  typeof EvidenceArtifactStagingSchema
>;
export type EvidenceArtifactLifecycleEvent = z.infer<
  typeof EvidenceArtifactLifecycleEventSchema
>;
export type EvidenceSecurityAuditEvent = z.infer<
  typeof EvidenceSecurityAuditEventSchema
>;
export type EvidenceArtifactBackupManifest = z.infer<
  typeof EvidenceArtifactBackupManifestSchema
>;
