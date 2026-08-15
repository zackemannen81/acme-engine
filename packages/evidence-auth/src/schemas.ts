import { z } from 'zod';

const NonBlank = z.string().trim().min(1);
const Timestamp = z.iso.datetime({ offset: true });

export const EVIDENCE_AUTH_POLICY_VERSION = 'evidence-auth-policy/1' as const;
export const EVIDENCE_CASE_AUTH_POLICY_VERSION =
  'evidence-case-auth-policy/1' as const;
export const EvidenceOrganizationRoleSchema = z.enum([
  'viewer',
  'reviewer',
  'organization-admin',
]);
export const EvidenceProductActionSchema = z.enum([
  'workspace.read',
  'review-history.read',
  'export.download',
  'review.decide',
  'assessment.propose',
  'synthetic-fixture.run',
  'source.import',
  'live-model.run',
  'job.cancel',
  'technical-audit.read',
  'organization-membership.manage',
  'case.catalog.read',
  'case.create',
  'case.read',
  'case.metadata.manage',
  'case.lifecycle.manage',
  'case-membership.manage',
]);

export const EvidenceCaseRoleSchema = z.enum([
  'case-viewer',
  'case-reviewer',
  'case-admin',
]);

export const EvidenceCaseStatusSchema = z.enum([
  'provisioning',
  'active',
  'archived',
]);
export const EvidenceCaseDataPolicySchema = z.enum([
  'synthetic-only',
  'stage-a-authorized-judicial-text',
]);

export const EvidenceCaseSchema = z
  .object({
    schemaVersion: z.literal('evidence-case/1'),
    caseId: NonBlank,
    organizationId: NonBlank,
    workspaceId: NonBlank,
    title: NonBlank.max(200),
    caseReference: NonBlank.max(100).nullable(),
    metadata: z.record(NonBlank.max(64), z.string().max(500)).default({}),
    dataPolicy: EvidenceCaseDataPolicySchema,
    status: EvidenceCaseStatusSchema,
    revision: z.number().int().nonnegative(),
    createdAt: Timestamp,
    updatedAt: Timestamp,
    createdByPrincipalRef: NonBlank,
    updatedByPrincipalRef: NonBlank,
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value.metadata).length > 20) {
      context.addIssue({
        code: 'custom',
        path: ['metadata'],
        message: 'Case metadata is limited to 20 fields.',
      });
    }
  });

export const EvidenceCaseMembershipSchema = z
  .object({
    schemaVersion: z.literal('evidence-case-membership/1'),
    caseMembershipId: NonBlank,
    caseId: NonBlank,
    organizationId: NonBlank,
    principalRef: NonBlank,
    role: EvidenceCaseRoleSchema,
    status: z.enum(['active', 'suspended']),
    createdAt: Timestamp,
    updatedAt: Timestamp,
    updatedByPrincipalRef: NonBlank,
  })
  .strict();

export const EvidenceOrganizationSchema = z
  .object({
    schemaVersion: z.literal('evidence-organization/1'),
    organizationId: NonBlank,
    label: NonBlank,
    createdAt: Timestamp,
  })
  .strict();

export const EvidencePrincipalProfileSchema = z
  .object({
    schemaVersion: z.literal('evidence-principal-profile/1'),
    principalRef: NonBlank,
    issuer: z.url(),
    subject: NonBlank,
    displayLabel: NonBlank,
    createdAt: Timestamp,
  })
  .strict();

export const EvidenceOrganizationMembershipSchema = z
  .object({
    schemaVersion: z.literal('evidence-organization-membership/1'),
    membershipId: NonBlank,
    organizationId: NonBlank,
    principalRef: NonBlank,
    role: EvidenceOrganizationRoleSchema,
    status: z.enum(['active', 'suspended']),
    createdAt: Timestamp,
    updatedAt: Timestamp,
  })
  .strict();

export const EvidenceWorkspaceOrganizationBindingSchema = z
  .object({
    schemaVersion: z.literal('evidence-workspace-organization-binding/1'),
    workspaceId: NonBlank,
    organizationId: NonBlank,
    boundAt: Timestamp,
  })
  .strict();

const ProtectedPayloadEnvelopeSchema = z
  .object({
    v: z.literal('acme-payload-envelope-1'),
    algorithm: z.literal('aes-256-gcm'),
    keyId: NonBlank,
    iv: NonBlank,
    authTag: NonBlank,
    ciphertext: NonBlank,
  })
  .strict();

export const EvidenceProductSessionSchema = z
  .object({
    schemaVersion: z.literal('evidence-product-session/1'),
    sessionId: NonBlank,
    tokenDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    csrfDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    principalRef: NonBlank,
    upstreamSessionId: NonBlank,
    protectedUpstreamSession: ProtectedPayloadEnvelopeSchema,
    createdAt: Timestamp,
    lastSeenAt: Timestamp,
    idleExpiresAt: Timestamp,
    absoluteExpiresAt: Timestamp,
    revokedAt: Timestamp.nullable(),
  })
  .strict();

export const EvidenceIdentitySnapshotSchema = z
  .object({
    schemaVersion: z.literal('evidence-identity-snapshot/1'),
    organizations: z.array(EvidenceOrganizationSchema),
    principals: z.array(EvidencePrincipalProfileSchema),
    memberships: z.array(EvidenceOrganizationMembershipSchema),
    workspaceBindings: z.array(EvidenceWorkspaceOrganizationBindingSchema),
    cases: z.array(EvidenceCaseSchema).default([]),
    caseMemberships: z.array(EvidenceCaseMembershipSchema).default([]),
    sessions: z.array(EvidenceProductSessionSchema),
  })
  .strict();

export const EvidenceAuthorizationContextSchema = z
  .object({
    schemaVersion: z.literal('evidence-authorization-context/1'),
    principalRef: NonBlank,
    organizationId: NonBlank,
    membershipId: NonBlank,
    effectiveRole: EvidenceOrganizationRoleSchema,
    workspaceId: NonBlank.nullable(),
    action: EvidenceProductActionSchema,
    policyVersion: z.literal(EVIDENCE_AUTH_POLICY_VERSION),
    decidedAt: Timestamp,
  })
  .strict();

export const EvidenceCaseAuthorizationContextSchema = z
  .object({
    schemaVersion: z.literal('evidence-case-authorization-context/1'),
    principalRef: NonBlank,
    organizationId: NonBlank,
    organizationMembershipId: NonBlank,
    effectiveOrganizationRole: EvidenceOrganizationRoleSchema,
    caseId: NonBlank.nullable(),
    workspaceId: NonBlank.nullable(),
    caseMembershipId: NonBlank.nullable(),
    effectiveCaseRole: EvidenceCaseRoleSchema.nullable(),
    action: EvidenceProductActionSchema,
    policyVersion: z.literal(EVIDENCE_CASE_AUTH_POLICY_VERSION),
    decidedAt: Timestamp,
  })
  .strict();

export type EvidenceOrganizationRole = z.infer<
  typeof EvidenceOrganizationRoleSchema
>;
export type EvidenceCaseRole = z.infer<typeof EvidenceCaseRoleSchema>;
export type EvidenceCaseStatus = z.infer<typeof EvidenceCaseStatusSchema>;
export type EvidenceCaseDataPolicy = z.infer<
  typeof EvidenceCaseDataPolicySchema
>;
export type EvidenceCase = z.infer<typeof EvidenceCaseSchema>;
export type EvidenceCaseMembership = z.infer<
  typeof EvidenceCaseMembershipSchema
>;
export type EvidenceProductAction = z.infer<typeof EvidenceProductActionSchema>;
export type EvidenceOrganization = z.infer<typeof EvidenceOrganizationSchema>;
export type EvidencePrincipalProfile = z.infer<
  typeof EvidencePrincipalProfileSchema
>;
export type EvidenceOrganizationMembership = z.infer<
  typeof EvidenceOrganizationMembershipSchema
>;
export type EvidenceWorkspaceOrganizationBinding = z.infer<
  typeof EvidenceWorkspaceOrganizationBindingSchema
>;
export type EvidenceProductSession = z.infer<
  typeof EvidenceProductSessionSchema
>;
export type EvidenceIdentitySnapshot = z.infer<
  typeof EvidenceIdentitySnapshotSchema
>;
export type EvidenceAuthorizationContext = z.infer<
  typeof EvidenceAuthorizationContextSchema
>;
export type EvidenceCaseAuthorizationContext = z.infer<
  typeof EvidenceCaseAuthorizationContextSchema
>;
