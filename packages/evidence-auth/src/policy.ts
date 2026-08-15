import type { Hashing } from '@acme/core';

import {
  EVIDENCE_AUTH_POLICY_VERSION,
  EVIDENCE_CASE_AUTH_POLICY_VERSION,
  EvidenceAuthorizationContextSchema,
  EvidenceCaseAuthorizationContextSchema,
  type EvidenceAuthorizationContext,
  type EvidenceCaseAuthorizationContext,
  type EvidenceCaseRole,
  type EvidenceIdentitySnapshot,
  type EvidenceOrganizationRole,
  type EvidenceProductAction,
} from './schemas.js';

const ALLOWED: Readonly<
  Record<EvidenceOrganizationRole, ReadonlySet<EvidenceProductAction>>
> = Object.freeze({
  viewer: new Set<EvidenceProductAction>([
    'workspace.read',
    'review-history.read',
    'export.download',
  ]),
  reviewer: new Set<EvidenceProductAction>([
    'workspace.read',
    'review-history.read',
    'export.download',
    'review.decide',
    'assessment.propose',
    'synthetic-fixture.run',
    'job.cancel',
  ]),
  'organization-admin': new Set<EvidenceProductAction>([
    'workspace.read',
    'review-history.read',
    'export.download',
    'review.decide',
    'assessment.propose',
    'synthetic-fixture.run',
    'job.cancel',
    'technical-audit.read',
    'organization-membership.manage',
  ]),
});

const CASE_ALLOWED: Readonly<
  Record<EvidenceCaseRole, ReadonlySet<EvidenceProductAction>>
> = Object.freeze({
  'case-viewer': new Set<EvidenceProductAction>([
    'case.read',
    'workspace.read',
    'review-history.read',
    'export.download',
  ]),
  'case-reviewer': new Set<EvidenceProductAction>([
    'case.read',
    'workspace.read',
    'review-history.read',
    'export.download',
    'review.decide',
    'assessment.propose',
    'synthetic-fixture.run',
    'job.cancel',
  ]),
  'case-admin': new Set<EvidenceProductAction>([
    'case.read',
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
    'case.metadata.manage',
    'case.lifecycle.manage',
    'case-membership.manage',
  ]),
});

const ARCHIVED_ALLOWED = new Set<EvidenceProductAction>([
  'case.read',
  'workspace.read',
  'review-history.read',
  'export.download',
  'technical-audit.read',
  'case.lifecycle.manage',
]);

export class EvidenceAuthenticationError extends Error {
  readonly status = 401;
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'EvidenceAuthenticationError';
  }
}

export class EvidenceAuthorizationError extends Error {
  constructor(
    readonly status: 403 | 404,
    message: string,
  ) {
    super(message);
    this.name = 'EvidenceAuthorizationError';
  }
}

export function deriveEvidencePrincipalRef(
  hashing: Hashing,
  issuer: string,
  subject: string,
): string {
  const canonicalIssuer = new URL(issuer).toString();
  return `evidence_principal_${hashing.sha256(`${canonicalIssuer}\u0000${subject}`)}`;
}

export function isEvidenceActionAllowed(
  role: EvidenceOrganizationRole,
  action: EvidenceProductAction,
): boolean {
  return ALLOWED[role].has(action);
}

export function isEvidenceCaseActionAllowed(
  role: EvidenceCaseRole,
  action: EvidenceProductAction,
): boolean {
  return CASE_ALLOWED[role].has(action);
}

function activeOrganizationMembership(input: {
  readonly snapshot: EvidenceIdentitySnapshot;
  readonly principalRef: string;
  readonly organizationId: string;
}) {
  const memberships = input.snapshot.memberships.filter(
    (item) =>
      item.principalRef === input.principalRef &&
      item.organizationId === input.organizationId,
  );
  const active = memberships.find((item) => item.status === 'active');
  if (active !== undefined) return active;
  if (memberships.length > 0)
    throw new EvidenceAuthorizationError(403, 'Forbidden.');
  throw new EvidenceAuthorizationError(404, 'Not found.');
}

export function authorizeEvidenceOrganizationAction(input: {
  readonly snapshot: EvidenceIdentitySnapshot;
  readonly principalRef: string;
  readonly organizationId: string;
  readonly action: 'case.catalog.read' | 'case.create';
  readonly decidedAt: string;
}): EvidenceCaseAuthorizationContext {
  const membership = activeOrganizationMembership(input);
  if (
    input.action === 'case.create' &&
    membership.role !== 'organization-admin'
  ) {
    throw new EvidenceAuthorizationError(403, 'Forbidden.');
  }
  return EvidenceCaseAuthorizationContextSchema.parse({
    schemaVersion: 'evidence-case-authorization-context/1',
    principalRef: input.principalRef,
    organizationId: input.organizationId,
    organizationMembershipId: membership.membershipId,
    effectiveOrganizationRole: membership.role,
    caseId: null,
    workspaceId: null,
    caseMembershipId: null,
    effectiveCaseRole: null,
    action: input.action,
    policyVersion: EVIDENCE_CASE_AUTH_POLICY_VERSION,
    decidedAt: input.decidedAt,
  });
}

export function authorizeEvidenceCaseAction(input: {
  readonly snapshot: EvidenceIdentitySnapshot;
  readonly principalRef: string;
  readonly caseId: string;
  readonly action: EvidenceProductAction;
  readonly decidedAt: string;
}): EvidenceCaseAuthorizationContext {
  const evidenceCase = input.snapshot.cases.find(
    (item) => item.caseId === input.caseId,
  );
  if (evidenceCase === undefined || evidenceCase.status === 'provisioning') {
    throw new EvidenceAuthorizationError(404, 'Not found.');
  }
  const organizationMembership = activeOrganizationMembership({
    snapshot: input.snapshot,
    principalRef: input.principalRef,
    organizationId: evidenceCase.organizationId,
  });
  const memberships = input.snapshot.caseMemberships.filter(
    (item) =>
      item.caseId === evidenceCase.caseId &&
      item.organizationId === evidenceCase.organizationId &&
      item.principalRef === input.principalRef,
  );
  const caseMembership = memberships.find((item) => item.status === 'active');
  const organizationRecovery =
    input.action === 'case-membership.manage' &&
    organizationMembership.role === 'organization-admin' &&
    evidenceCase.status === 'active';
  if (caseMembership === undefined && !organizationRecovery) {
    throw new EvidenceAuthorizationError(404, 'Not found.');
  }
  if (
    !organizationRecovery &&
    (caseMembership === undefined ||
      !isEvidenceCaseActionAllowed(caseMembership.role, input.action))
  ) {
    throw new EvidenceAuthorizationError(403, 'Forbidden.');
  }
  if (
    evidenceCase.status === 'archived' &&
    !ARCHIVED_ALLOWED.has(input.action)
  ) {
    throw new EvidenceAuthorizationError(403, 'Archived case is read-only.');
  }
  return EvidenceCaseAuthorizationContextSchema.parse({
    schemaVersion: 'evidence-case-authorization-context/1',
    principalRef: input.principalRef,
    organizationId: evidenceCase.organizationId,
    organizationMembershipId: organizationMembership.membershipId,
    effectiveOrganizationRole: organizationMembership.role,
    caseId: evidenceCase.caseId,
    workspaceId: evidenceCase.workspaceId,
    caseMembershipId: caseMembership?.caseMembershipId ?? null,
    effectiveCaseRole: caseMembership?.role ?? null,
    action: input.action,
    policyVersion: EVIDENCE_CASE_AUTH_POLICY_VERSION,
    decidedAt: input.decidedAt,
  });
}

export function authorizeEvidenceAction(input: {
  readonly snapshot: EvidenceIdentitySnapshot;
  readonly principalRef: string;
  readonly action: EvidenceProductAction;
  readonly workspaceId: string | null;
  readonly decidedAt: string;
}): EvidenceAuthorizationContext {
  const binding =
    input.workspaceId === null
      ? null
      : input.snapshot.workspaceBindings.find(
          (item) => item.workspaceId === input.workspaceId,
        );
  if (input.workspaceId !== null && binding === undefined) {
    throw new EvidenceAuthorizationError(404, 'Not found.');
  }
  const resolvedBinding = binding ?? null;
  const principalMemberships = input.snapshot.memberships.filter(
    (item) => item.principalRef === input.principalRef,
  );
  const memberships = principalMemberships.filter(
    (item) => item.status === 'active',
  );
  const membership =
    resolvedBinding === null
      ? memberships[0]
      : memberships.find(
          (item) => item.organizationId === resolvedBinding.organizationId,
        );
  if (membership === undefined) {
    if (
      resolvedBinding !== null &&
      principalMemberships.some(
        (item) => item.organizationId === resolvedBinding.organizationId,
      )
    ) {
      throw new EvidenceAuthorizationError(403, 'Forbidden.');
    }
    if (resolvedBinding !== null)
      throw new EvidenceAuthorizationError(404, 'Not found.');
    throw new EvidenceAuthorizationError(403, 'Forbidden.');
  }
  if (!isEvidenceActionAllowed(membership.role, input.action)) {
    throw new EvidenceAuthorizationError(403, 'Forbidden.');
  }
  return EvidenceAuthorizationContextSchema.parse({
    schemaVersion: 'evidence-authorization-context/1',
    principalRef: input.principalRef,
    organizationId: membership.organizationId,
    membershipId: membership.membershipId,
    effectiveRole: membership.role,
    workspaceId: input.workspaceId,
    action: input.action,
    policyVersion: EVIDENCE_AUTH_POLICY_VERSION,
    decidedAt: input.decidedAt,
  });
}
