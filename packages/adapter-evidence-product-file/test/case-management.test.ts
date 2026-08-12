import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createInMemoryEvidenceIdentityRepository } from '@acme/adapter-evidence-auth-memory';
import {
  authorizeEvidenceCaseAction,
  authorizeEvidenceOrganizationAction,
} from '@acme/evidence-auth';
import {
  changeEvidenceCaseLifecycle,
  createEvidenceCase,
  listVisibleEvidenceCases,
  putEvidenceCaseMembership,
  reconcileEvidenceCases,
  updateEvidenceCase,
} from '@acme/evidence-product-contracts';
import {
  developmentObserveArtifactInput,
  developmentObserveArtifactOutput,
} from '@acme/evidence-testing';
import {
  evidenceObserveArtifactTask,
  type EvidenceObservation,
} from '@acme/module-evidence';

import { createFileEvidenceProductRepository } from '../src/index.js';

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('file Evidence case management', () => {
  it('provisions, administers, archives and strictly scopes identical object ids', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'evidence-case-'));
    directories.push(directory);
    const identity = createInMemoryEvidenceIdentityRepository();
    const product = createFileEvidenceProductRepository({
      filePath: path.join(directory, 'product.json'),
    });
    const now = '2026-08-12T11:00:00.000Z';
    const clock = { now: () => now };
    await identity.putOrganization({
      schemaVersion: 'evidence-organization/1',
      organizationId: 'org-1',
      label: 'Synthetic organization',
      createdAt: now,
    });
    for (const principalRef of ['admin-1', 'reviewer-2']) {
      await identity.putPrincipal({
        schemaVersion: 'evidence-principal-profile/1',
        principalRef,
        issuer: 'https://auth.invalid/',
        subject: principalRef,
        displayLabel: principalRef,
        createdAt: now,
      });
      await identity.putMembership({
        schemaVersion: 'evidence-organization-membership/1',
        membershipId: `org-membership-${principalRef}`,
        organizationId: 'org-1',
        principalRef,
        role: principalRef === 'admin-1' ? 'organization-admin' : 'reviewer',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }
    const organizationAuthorization = authorizeEvidenceOrganizationAction({
      snapshot: await identity.snapshot(),
      principalRef: 'admin-1',
      organizationId: 'org-1',
      action: 'case.create',
      decidedAt: now,
    });
    const first = await createEvidenceCase({
      identityRepository: identity,
      productRepository: product,
      authorization: organizationAuthorization,
      organizationId: 'org-1',
      command: {
        schemaVersion: 'evidence-create-case-command/1',
        commandKey: 'first',
        title: 'First synthetic case',
        caseReference: 'CASE-1',
        metadata: { team: 'alpha' },
      },
      clock,
    });
    expect(
      await createEvidenceCase({
        identityRepository: identity,
        productRepository: product,
        authorization: organizationAuthorization,
        organizationId: 'org-1',
        command: {
          schemaVersion: 'evidence-create-case-command/1',
          commandKey: 'first',
          title: 'First synthetic case',
          caseReference: 'CASE-1',
          metadata: { team: 'alpha' },
        },
        clock,
      }),
    ).toEqual(first);
    expect(
      listVisibleEvidenceCases({
        snapshot: await identity.snapshot(),
        principalRef: 'admin-1',
        organizationId: 'org-1',
        query: 'case-1',
      }),
    ).toHaveLength(1);

    const caseAdmin = async (
      action: Parameters<typeof authorizeEvidenceCaseAction>[0]['action'],
    ) =>
      authorizeEvidenceCaseAction({
        snapshot: await identity.snapshot(),
        principalRef: 'admin-1',
        caseId: first.caseId,
        action,
        decidedAt: now,
      });
    const updated = await updateEvidenceCase({
      identityRepository: identity,
      authorization: await caseAdmin('case.metadata.manage'),
      command: {
        schemaVersion: 'evidence-update-case-command/1',
        expectedRevision: first.revision,
        title: 'First synthetic case — updated',
        caseReference: 'CASE-1',
        metadata: { team: 'alpha' },
      },
      clock,
    });
    await expect(
      updateEvidenceCase({
        identityRepository: identity,
        authorization: await caseAdmin('case.metadata.manage'),
        command: {
          schemaVersion: 'evidence-update-case-command/1',
          expectedRevision: first.revision,
          title: 'Stale update',
          caseReference: null,
          metadata: {},
        },
        clock,
      }),
    ).rejects.toThrow('revision conflict');
    const participant = await putEvidenceCaseMembership({
      identityRepository: identity,
      authorization: await caseAdmin('case-membership.manage'),
      command: {
        schemaVersion: 'evidence-case-membership-command/1',
        expectedCaseRevision: updated.revision,
        principalRef: 'reviewer-2',
        role: 'case-reviewer',
        status: 'active',
      },
      clock,
    });
    expect(participant.role).toBe('case-reviewer');
    await expect(
      putEvidenceCaseMembership({
        identityRepository: identity,
        authorization: await caseAdmin('case-membership.manage'),
        command: {
          schemaVersion: 'evidence-case-membership-command/1',
          expectedCaseRevision: updated.revision,
          principalRef: 'reviewer-2',
          role: 'case-viewer',
          status: 'active',
        },
        clock,
      }),
    ).rejects.toThrow('revision conflict');
    expect(
      (await identity.snapshot()).caseMemberships.find(
        (item) => item.principalRef === 'reviewer-2',
      )?.role,
    ).toBe('case-reviewer');
    expect(
      authorizeEvidenceCaseAction({
        snapshot: await identity.snapshot(),
        principalRef: 'reviewer-2',
        caseId: first.caseId,
        action: 'review.decide',
        decidedAt: now,
      }).effectiveCaseRole,
    ).toBe('case-reviewer');

    const archived = await changeEvidenceCaseLifecycle({
      identityRepository: identity,
      productRepository: product,
      authorization: await caseAdmin('case.lifecycle.manage'),
      command: {
        schemaVersion: 'evidence-case-lifecycle-command/1',
        expectedRevision: updated.revision + 1,
        action: 'archive',
      },
      clock,
    });
    expect(archived.status).toBe('archived');
    const archivedIdentity = await identity.snapshot();
    expect(() =>
      authorizeEvidenceCaseAction({
        snapshot: archivedIdentity,
        principalRef: 'reviewer-2',
        caseId: first.caseId,
        action: 'review.decide',
        decidedAt: now,
      }),
    ).toThrow('read-only');
    const restored = await changeEvidenceCaseLifecycle({
      identityRepository: identity,
      productRepository: product,
      authorization: await caseAdmin('case.lifecycle.manage'),
      command: {
        schemaVersion: 'evidence-case-lifecycle-command/1',
        expectedRevision: archived.revision,
        action: 'restore',
      },
      clock,
    });
    expect(restored.status).toBe('active');

    const second = await createEvidenceCase({
      identityRepository: identity,
      productRepository: product,
      authorization: organizationAuthorization,
      organizationId: 'org-1',
      command: {
        schemaVersion: 'evidence-create-case-command/1',
        commandKey: 'second',
        title: 'Second synthetic case',
        caseReference: 'CASE-2',
        metadata: {},
      },
      clock,
    });
    const source = developmentObserveArtifactInput().artifactVersion;
    const interpreted = await evidenceObserveArtifactTask.interpret(
      developmentObserveArtifactOutput(),
      developmentObserveArtifactInput(),
      {
        executionId: 'case-scope-test',
        entityId: first.workspaceId,
        now,
        state: null,
        memories: [],
        documents: [],
      },
    );
    const observations = interpreted.memories.map(
      ({ value }) => value as EvidenceObservation,
    );
    const firstScope = {
      caseId: first.caseId,
      workspaceId: first.workspaceId,
      boundAt: now,
    } as const;
    const secondScope = {
      caseId: second.caseId,
      workspaceId: second.workspaceId,
      boundAt: now,
    } as const;
    await product.putSource(source, firstScope);
    await product.putObservations(observations, firstScope);
    await expect(
      product.putObservations(observations, secondScope),
    ).rejects.toThrow('another case');
    expect(
      (await product.caseSnapshot(second.caseId, second.workspaceId))
        .observations,
    ).toHaveLength(0);
    await product.putSource(source, secondScope);
    await product.putObservations(observations, secondScope);
    expect(
      (await product.caseSnapshot(first.caseId, first.workspaceId)).sources[0]
        ?.artifactVersionId,
    ).toBe(source.artifactVersionId);
    expect(
      (await product.caseSnapshot(second.caseId, second.workspaceId)).sources[0]
        ?.artifactVersionId,
    ).toBe(source.artifactVersionId);
    await reconcileEvidenceCases({
      identity: await identity.snapshot(),
      product: await product.snapshot(),
    });
  });
});
