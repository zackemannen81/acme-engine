import { describe, expect, it } from 'vitest';

import { nodeHashing } from '@acme/core';

import {
  EvidenceAuthorizationError,
  authorizeEvidenceAction,
  authorizeEvidenceCaseAction,
  authorizeEvidenceOrganizationAction,
  deriveEvidencePrincipalRef,
  isEvidenceActionAllowed,
  isEvidenceCaseActionAllowed,
  type EvidenceCaseRole,
  type EvidenceIdentitySnapshot,
  type EvidenceOrganizationRole,
  type EvidenceProductAction,
} from '../src/index.js';

const actions: readonly EvidenceProductAction[] = [
  'workspace.read',
  'review-history.read',
  'export.download',
  'review.decide',
  'assessment.propose',
  'synthetic-fixture.run',
  'job.cancel',
  'technical-audit.read',
  'organization-membership.manage',
];

const expected: Record<
  EvidenceOrganizationRole,
  readonly EvidenceProductAction[]
> = {
  viewer: ['workspace.read', 'review-history.read', 'export.download'],
  reviewer: [
    'workspace.read',
    'review-history.read',
    'export.download',
    'review.decide',
    'assessment.propose',
    'synthetic-fixture.run',
    'job.cancel',
  ],
  'organization-admin': actions,
};

function snapshot(role: EvidenceOrganizationRole): EvidenceIdentitySnapshot {
  return {
    schemaVersion: 'evidence-identity-snapshot/1',
    organizations: [
      {
        schemaVersion: 'evidence-organization/1',
        organizationId: 'org-1',
        label: 'Synthetic organization',
        createdAt: '2026-08-12T00:00:00.000Z',
      },
    ],
    principals: [],
    memberships: [
      {
        schemaVersion: 'evidence-organization-membership/1',
        membershipId: 'membership-1',
        organizationId: 'org-1',
        principalRef: 'principal-1',
        role,
        status: 'active',
        createdAt: '2026-08-12T00:00:00.000Z',
        updatedAt: '2026-08-12T00:00:00.000Z',
      },
    ],
    workspaceBindings: [
      {
        schemaVersion: 'evidence-workspace-organization-binding/1',
        workspaceId: 'workspace-1',
        organizationId: 'org-1',
        boundAt: '2026-08-12T00:00:00.000Z',
      },
      {
        schemaVersion: 'evidence-workspace-organization-binding/1',
        workspaceId: 'workspace-other',
        organizationId: 'org-other',
        boundAt: '2026-08-12T00:00:00.000Z',
      },
    ],
    cases: [],
    caseMemberships: [],
    sessions: [],
  };
}

describe('Evidence authorization policy', () => {
  it.each(
    Object.entries(expected) as [
      EvidenceOrganizationRole,
      EvidenceProductAction[],
    ][],
  )('pins the %s role matrix', (role, allowed) => {
    for (const action of actions) {
      expect(isEvidenceActionAllowed(role, action)).toBe(
        allowed.includes(action),
      );
    }
  });

  it.each([
    [
      'case-viewer',
      ['case.read', 'workspace.read', 'review-history.read', 'export.download'],
    ],
    [
      'case-reviewer',
      [
        'case.read',
        'workspace.read',
        'review-history.read',
        'export.download',
        'review.decide',
        'assessment.propose',
        'synthetic-fixture.run',
        'job.cancel',
      ],
    ],
    [
      'case-admin',
      [
        'case.read',
        'workspace.read',
        'review-history.read',
        'export.download',
        'review.decide',
        'assessment.propose',
        'synthetic-fixture.run',
        'job.cancel',
        'technical-audit.read',
        'case.metadata.manage',
        'case.lifecycle.manage',
        'case-membership.manage',
      ],
    ],
  ] as const)('pins the %s case-role matrix', (role, allowed) => {
    for (const action of [
      ...actions,
      'case.read',
      'case.metadata.manage',
      'case.lifecycle.manage',
      'case-membership.manage',
      'case.create',
    ] as const)
      expect(isEvidenceCaseActionAllowed(role, action)).toBe(
        allowed.includes(action as never),
      );
  });

  it('requires explicit case membership even for organization admins', () => {
    const base = snapshot('organization-admin');
    const withCase: EvidenceIdentitySnapshot = {
      ...base,
      cases: [
        {
          schemaVersion: 'evidence-case/1',
          caseId: 'case-1',
          organizationId: 'org-1',
          workspaceId: 'workspace-1',
          title: 'Synthetic case',
          caseReference: null,
          metadata: {},
          dataPolicy: 'synthetic-only',
          status: 'active',
          revision: 1,
          createdAt: '2026-08-12T00:00:00.000Z',
          updatedAt: '2026-08-12T00:00:00.000Z',
          createdByPrincipalRef: 'principal-1',
          updatedByPrincipalRef: 'principal-1',
        },
      ],
    };
    expect(() =>
      authorizeEvidenceCaseAction({
        snapshot: withCase,
        principalRef: 'principal-1',
        caseId: 'case-1',
        action: 'workspace.read',
        decidedAt: '2026-08-12T01:00:00.000Z',
      }),
    ).toThrowError(new EvidenceAuthorizationError(404, 'Not found.'));
    expect(
      authorizeEvidenceCaseAction({
        snapshot: withCase,
        principalRef: 'principal-1',
        caseId: 'case-1',
        action: 'case-membership.manage',
        decidedAt: '2026-08-12T01:00:00.000Z',
      }),
    ).toMatchObject({ effectiveCaseRole: null });
    expect(
      authorizeEvidenceOrganizationAction({
        snapshot: withCase,
        principalRef: 'principal-1',
        organizationId: 'org-1',
        action: 'case.create',
        decidedAt: '2026-08-12T01:00:00.000Z',
      }),
    ).toMatchObject({ action: 'case.create', caseId: null });
  });

  it.each(['case-viewer', 'case-reviewer', 'case-admin'] as EvidenceCaseRole[])(
    'records exact %s case context and keeps archived cases read-only',
    (role) => {
      const base = snapshot('reviewer');
      const withCase: EvidenceIdentitySnapshot = {
        ...base,
        cases: [
          {
            schemaVersion: 'evidence-case/1',
            caseId: 'case-1',
            organizationId: 'org-1',
            workspaceId: 'workspace-1',
            title: 'Synthetic case',
            caseReference: null,
            metadata: {},
            dataPolicy: 'synthetic-only',
            status: 'archived',
            revision: 2,
            createdAt: '2026-08-12T00:00:00.000Z',
            updatedAt: '2026-08-12T00:00:00.000Z',
            createdByPrincipalRef: 'principal-1',
            updatedByPrincipalRef: 'principal-1',
          },
        ],
        caseMemberships: [
          {
            schemaVersion: 'evidence-case-membership/1',
            caseMembershipId: 'case-membership-1',
            caseId: 'case-1',
            organizationId: 'org-1',
            principalRef: 'principal-1',
            role,
            status: 'active',
            createdAt: '2026-08-12T00:00:00.000Z',
            updatedAt: '2026-08-12T00:00:00.000Z',
            updatedByPrincipalRef: 'principal-1',
          },
        ],
      };
      expect(
        authorizeEvidenceCaseAction({
          snapshot: withCase,
          principalRef: 'principal-1',
          caseId: 'case-1',
          action: 'workspace.read',
          decidedAt: '2026-08-12T01:00:00.000Z',
        }),
      ).toMatchObject({
        effectiveCaseRole: role,
        caseId: 'case-1',
        workspaceId: 'workspace-1',
      });
      expect(() =>
        authorizeEvidenceCaseAction({
          snapshot: withCase,
          principalRef: 'principal-1',
          caseId: 'case-1',
          action: 'review.decide',
          decidedAt: '2026-08-12T01:00:00.000Z',
        }),
      ).toThrow();
    },
  );

  it('derives stable issuer/subject identity and not display identity', () => {
    expect(
      deriveEvidencePrincipalRef(
        nodeHashing,
        'https://auth.example.test/',
        'subject-1',
      ),
    ).toBe(
      deriveEvidencePrincipalRef(
        nodeHashing,
        'https://auth.example.test',
        'subject-1',
      ),
    );
  });

  it('authorizes the bound organization and records exact policy context', () => {
    expect(
      authorizeEvidenceAction({
        snapshot: snapshot('reviewer'),
        principalRef: 'principal-1',
        action: 'review.decide',
        workspaceId: 'workspace-1',
        decidedAt: '2026-08-12T01:00:00.000Z',
      }),
    ).toMatchObject({
      principalRef: 'principal-1',
      organizationId: 'org-1',
      effectiveRole: 'reviewer',
      action: 'review.decide',
      policyVersion: 'evidence-auth-policy/1',
    });
  });

  it('does not disclose a cross-organization or unknown workspace', () => {
    for (const workspaceId of ['workspace-other', 'workspace-missing']) {
      expect(() =>
        authorizeEvidenceAction({
          snapshot: snapshot('organization-admin'),
          principalRef: 'principal-1',
          action: 'workspace.read',
          workspaceId,
          decidedAt: '2026-08-12T01:00:00.000Z',
        }),
      ).toThrowError(new EvidenceAuthorizationError(404, 'Not found.'));
    }
  });

  it('denies suspended membership and rejects unknown typed policy inputs', () => {
    const suspended = snapshot('reviewer');
    expect(() =>
      authorizeEvidenceAction({
        snapshot: {
          ...suspended,
          memberships: suspended.memberships.map((item) => ({
            ...item,
            status: 'suspended' as const,
          })),
        },
        principalRef: 'principal-1',
        action: 'workspace.read',
        workspaceId: 'workspace-1',
        decidedAt: '2026-08-12T01:00:00.000Z',
      }),
    ).toThrowError(new EvidenceAuthorizationError(403, 'Forbidden.'));
    expect(() =>
      isEvidenceActionAllowed(
        'reviewer',
        'unregistered.action' as EvidenceProductAction,
      ),
    ).not.toThrow();
    expect(
      isEvidenceActionAllowed(
        'reviewer',
        'unregistered.action' as EvidenceProductAction,
      ),
    ).toBe(false);
  });
});
