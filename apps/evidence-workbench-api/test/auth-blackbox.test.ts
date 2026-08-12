import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  developmentObserveArtifactInput,
  evaluationAssessmentCases,
} from '@acme/evidence-testing';
import {
  createEvidenceChangeSet,
  deriveEvidenceActorReferenceKey,
  deriveEvidenceArtifactVersionId,
  deriveEvidenceAssessmentContentHash,
  deriveEvidenceAssessmentId,
  deriveEvidenceLocatorId,
  deriveEvidenceObservationId,
} from '@acme/module-evidence';

import { listenEvidenceWorkbenchApi } from '../src/index.js';
import { createLocalEvidenceWorkbench } from '../src/local.js';

const directories: string[] = [];

afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

function cookies(response: Response): {
  readonly header: string;
  readonly csrf: string;
} {
  const values = response.headers.getSetCookie();
  const parts = values.map((value) => value.split(';')[0]);
  const csrfPart = parts.find((value) => value?.startsWith('acme_csrf='));
  if (csrfPart === undefined) throw new Error('Missing CSRF cookie.');
  return {
    header: parts.join('; '),
    csrf: decodeURIComponent(csrfPart.slice('acme_csrf='.length)),
  };
}

describe('Evidence Workbench authorization boundary', () => {
  it('denies by default, derives the actor, isolates cases and revokes logout', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'evidence-auth-'));
    directories.push(directory);
    let reviewId = 0;
    const local = await createLocalEvidenceWorkbench({
      dataFile: path.join(directory, 'product.json'),
      clock: { now: () => '2026-08-12T10:00:00.000Z' },
      reviewIds: { next: () => `auth-review-${String(++reviewId)}` },
      secureCookies: true,
    });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    const origin = address.url.slice(0, -1);
    try {
      expect((await fetch(`${address.url}health`)).status).toBe(200);
      const shell = await fetch(address.url);
      expect(shell.status).toBe(200);
      const shellText = await shell.text();
      expect(shellText).not.toContain('accessToken');
      expect(shellText).not.toContain('refreshToken');
      expect(shellText).not.toContain('localStorage');
      expect(
        (
          await fetch(
            `${address.url}api/cases/${encodeURIComponent(local.caseId)}/work-queue`,
          )
        ).status,
      ).toBe(401);
      expect((await fetch(`${address.url}api/not-a-route`)).status).toBe(401);

      const wrongOrigin = await fetch(`${address.url}auth/session`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://attacker.invalid',
        },
        body: JSON.stringify(local.authCredentials),
      });
      expect(wrongOrigin.status).toBe(401);

      const login = await fetch(`${address.url}auth/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify(local.authCredentials),
      });
      expect(login.status).toBe(201);
      const loginBody = await login.clone().text();
      expect(loginBody).not.toContain('rawToken');
      expect(loginBody).not.toContain('csrfToken');
      expect(loginBody).not.toContain('access-');
      expect(loginBody).not.toContain('refresh-');
      const setCookies = login.headers.getSetCookie().join('\n');
      expect(setCookies).toContain('HttpOnly');
      expect(setCookies).toContain('Secure');
      expect(setCookies).toContain('SameSite=Strict');
      expect(setCookies).toContain('Path=/');
      expect(setCookies).not.toContain('Domain=');
      expect(setCookies).not.toContain('access-');
      expect(setCookies).not.toContain('refresh-');
      const authenticated = cookies(login);
      const casePath = (caseId: string, pathname: string) => {
        const target = new URL(`${address.url}${pathname}`);
        if (
          target.pathname.startsWith('/api/') &&
          !target.pathname.startsWith('/api/cases/') &&
          target.pathname !== '/api/session'
        ) {
          target.pathname = `/api/cases/${encodeURIComponent(caseId)}${target.pathname.slice(4)}`;
          target.searchParams.delete('workspaceId');
        }
        return target;
      };
      const getForCase = (caseId: string, pathname: string) =>
        fetch(casePath(caseId, pathname), {
          headers: { cookie: authenticated.header },
        });
      const get = (pathname: string) => getForCase(local.caseId, pathname);
      const post = (
        pathname: string,
        value: unknown,
        csrf = authenticated.csrf,
        caseId = local.caseId,
      ) => {
        const payload = structuredClone(value) as Record<string, unknown>;
        delete payload.workspaceId;
        if (payload.schemaVersion === 'evidence-review-command/2')
          payload.schemaVersion = 'evidence-review-command/3';
        if (payload.schemaVersion === 'evidence-assessment-command/1')
          payload.schemaVersion = 'evidence-case-assessment-command/1';
        if (payload.schemaVersion === 'evidence-import-command/1')
          payload.schemaVersion = 'evidence-case-import-command/1';
        return fetch(casePath(caseId, pathname), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: authenticated.header,
            origin,
            'x-acme-csrf': csrf,
          },
          body: JSON.stringify(payload),
        });
      };

      expect((await get('api/session')).status).toBe(200);
      expect((await get('api/technical/provenance')).status).toBe(404);
      const artifactBefore = (await local.productRepository.snapshot())
        .artifactRepresentations[0];
      if (artifactBefore === undefined)
        throw new Error('Missing secure artifact.');
      expect((await get('api/artifacts')).status).toBe(200);
      expect(
        (
          await post(
            `api/artifacts/${encodeURIComponent(artifactBefore.representationId)}`,
            {},
          )
        ).status,
      ).toBe(204);
      const securityAuditResponse = await get('api/security-audit');
      expect(securityAuditResponse.status).toBe(200);
      expect(await securityAuditResponse.text()).not.toContain(
        developmentObserveArtifactInput().artifactVersion.text,
      );
      const identity = await local.identityRepository.snapshot();
      const membership = identity.memberships[0];
      const caseMembership = identity.caseMemberships.find(
        (item) => item.caseId === local.caseId,
      );
      if (membership === undefined || caseMembership === undefined)
        throw new Error('Missing membership.');
      await local.identityRepository.putCaseMembership({
        ...caseMembership,
        role: 'case-viewer',
        updatedAt: '2026-08-12T10:01:00.000Z',
        updatedByPrincipalRef: membership.principalRef,
      });

      const queueResponse = await get(
        `api/work-queue?workspaceId=${local.workspaceId}`,
      );
      expect(queueResponse.status).toBe(200);
      const artifactAudit = (await local.productRepository.snapshot())
        .securityAudit;
      expect(artifactAudit).toContainEqual(
        expect.objectContaining({
          action: 'artifact.read',
          outcome: 'succeeded',
          principalRef: membership.principalRef,
        }),
      );
      const queue = (await queueResponse.json()) as {
        nextItems: { observationVersionId?: string }[];
      };
      const targetVersionId = queue.nextItems[0]?.observationVersionId;
      if (targetVersionId === undefined)
        throw new Error('Missing review target.');
      const command = {
        schemaVersion: 'evidence-review-command/2',
        workspaceId: local.workspaceId,
        commandKey: 'auth-boundary-review',
        targetKind: 'observation',
        targetVersionId,
        action: 'accept',
        rationale: 'Authenticated source review.',
        basisEvidenceRevision: null,
      };
      expect((await post('api/reviews', command)).status).toBe(403);
      expect((await get('api/technical/provenance')).status).toBe(403);
      expect((await get('api/security-audit')).status).toBe(403);
      expect((await get('api/artifacts')).status).toBe(403);

      await local.identityRepository.putCaseMembership({
        ...caseMembership,
        role: 'case-reviewer',
        updatedAt: '2026-08-12T10:02:00.000Z',
        updatedByPrincipalRef: membership.principalRef,
      });
      expect((await get('api/technical/provenance')).status).toBe(403);
      expect((await post('api/reviews', command, 'wrong-csrf')).status).toBe(
        401,
      );
      expect(
        (
          await post('api/reviews', {
            ...command,
            principalRef: 'attacker-selected-principal',
          })
        ).status,
      ).toBe(400);
      const reviewed = await post('api/reviews', command);
      expect(reviewed.status, await reviewed.clone().text()).toBe(201);
      const decision = (await reviewed.json()) as {
        principalRef: string;
        authorization: {
          effectiveCaseRole: string;
          organizationId: string;
        };
      };
      expect(decision.principalRef).not.toBe('attacker-selected-principal');
      expect(decision.authorization).toMatchObject({
        effectiveCaseRole: 'case-reviewer',
        organizationId: membership.organizationId,
      });

      const unknownWorkspace = await getForCase(
        'case-from-another-organization',
        'api/work-queue',
      );
      expect(unknownWorkspace.status).toBe(404);
      expect(await unknownWorkspace.text()).toBe('Not found.');

      const foreignWorkspaceId = 'workspace-foreign-organization';
      const foreignCaseId = 'case-foreign-organization';
      // A second case in the same organization is the Stage 3 isolation proof.
      // Organization membership alone must not disclose it.
      const foreignOrganizationId = membership.organizationId;
      await local.identityRepository.putWorkspaceBinding({
        schemaVersion: 'evidence-workspace-organization-binding/1',
        workspaceId: foreignWorkspaceId,
        organizationId: foreignOrganizationId,
        boundAt: '2026-08-12T10:03:00.000Z',
      });
      await local.identityRepository.putCase({
        schemaVersion: 'evidence-case/1',
        caseId: foreignCaseId,
        organizationId: foreignOrganizationId,
        workspaceId: foreignWorkspaceId,
        title: 'Foreign synthetic case',
        caseReference: null,
        metadata: {},
        dataPolicy: 'synthetic-only',
        status: 'active',
        revision: 1,
        createdAt: '2026-08-12T10:03:00.000Z',
        updatedAt: '2026-08-12T10:03:00.000Z',
        createdByPrincipalRef: membership.principalRef,
        updatedByPrincipalRef: membership.principalRef,
      });
      const foreignScope = {
        caseId: foreignCaseId,
        workspaceId: foreignWorkspaceId,
        boundAt: '2026-08-12T10:03:00.000Z',
      } as const;
      const product = await local.productRepository.snapshot();
      const source = product.sources[0];
      const observation = product.observations[0];
      if (
        source === undefined ||
        observation?.kind !== 'statement-occurrence'
      ) {
        throw new Error('Missing statement fixture for cross-org proof.');
      }
      const foreignSource = {
        ...source,
        corpusId: 'foreign-synthetic-corpus',
        logicalArtifactId: 'SCR-T99',
        artifactVersionId: deriveEvidenceArtifactVersionId({
          corpusId: 'foreign-synthetic-corpus',
          logicalArtifactId: 'SCR-T99',
          versionOrdinal: source.versionOrdinal,
          kind: source.kind,
          contentHash: source.contentHash,
          locatorScheme: source.locatorScheme,
          predecessorVersionId: null,
        }),
        title: 'Foreign organization source',
        predecessorVersionId: null,
        correctionReason: null,
      };
      const foreignLocatorId = deriveEvidenceLocatorId({
        artifactVersionId: foreignSource.artifactVersionId,
        startLine: observation.locator.startLine,
        endLine: observation.locator.endLine,
      });
      const foreignActorReference = {
        ...observation.actorReference,
        actorReferenceKey: deriveEvidenceActorReferenceKey({
          artifactVersionId: foreignSource.artifactVersionId,
          locatorId: foreignLocatorId,
          sourceLabel: observation.actorReference.sourceLabel,
          sourceRole: observation.actorReference.sourceRole,
        }),
        artifactVersionId: foreignSource.artifactVersionId,
        locatorId: foreignLocatorId,
      };
      const foreignObservation = {
        ...observation,
        observationId: deriveEvidenceObservationId({
          kind: observation.kind,
          artifactVersionId: foreignSource.artifactVersionId,
          locatorId: foreignLocatorId,
          exactQuote: observation.exactQuote,
          sourceActorReference: foreignActorReference,
          temporalBound: observation.temporalBound,
        }),
        artifactVersionId: foreignSource.artifactVersionId,
        locator: {
          ...observation.locator,
          locatorId: foreignLocatorId,
          artifactVersionId: foreignSource.artifactVersionId,
        },
        actorReference: foreignActorReference,
      };
      const assessmentCase = evaluationAssessmentCases()[0];
      if (assessmentCase === undefined)
        throw new Error('Missing assessment fixture for cross-org proof.');
      const assessmentContent = {
        claims: assessmentCase.output.claims.map((claim) => ({
          ...claim,
          supportObservationIds: [foreignObservation.observationId],
          conflictRelationIds: [],
          qualificationRelationIds: [],
        })),
        openQuestionIds: [],
        citations: [
          {
            evidenceId: foreignObservation.observationId,
            artifactVersionId: foreignSource.artifactVersionId,
            locatorId: foreignLocatorId,
          },
        ],
        predecessorAssessmentVersionId: null,
      };
      const assessmentContentHash = deriveEvidenceAssessmentContentHash(
        assessmentContent as never,
      );
      const foreignAssessmentVersionId = deriveEvidenceAssessmentId({
        workspaceId: foreignWorkspaceId,
        sequence: 1,
        basisEvidenceRevision: assessmentCase.input.basisEvidenceRevision,
        contentHash: assessmentContentHash,
      });
      await local.productRepository.putWorkspace(
        {
          schemaVersion: 'evidence-workspace/1',
          workspaceId: foreignWorkspaceId,
          label: 'Foreign synthetic workspace',
          dataPolicy: 'synthetic-only',
          evidenceRevision: assessmentCase.input.basisEvidenceRevision,
          createdAt: '2026-08-12T10:03:00.000Z',
        },
        foreignScope,
      );
      await local.productRepository.putSource(foreignSource, foreignScope);
      await local.productRepository.putObservations(
        [foreignObservation],
        foreignScope,
      );
      await local.productRepository.putChangeSet(
        {
          schemaVersion: 'evidence-product-change-set/1',
          workspaceId: foreignWorkspaceId,
          commandKey: 'foreign-import-change-set',
          recordedAt: '2026-08-12T10:03:00.000Z',
          changeSet: createEvidenceChangeSet({
            fromEvidenceRevision: 0,
            toEvidenceRevision: 1,
            addedArtifactVersionIds: [foreignSource.artifactVersionId],
            addedObservationIds: [foreignObservation.observationId],
            addedRelationIds: [],
            addedOpenQuestionIds: [],
            standingChanges: [],
            actorReferenceKeys: [foreignActorReference.actorReferenceKey],
            relationEndpointIds: [],
            temporalBounds:
              foreignObservation.temporalBound === null
                ? []
                : [foreignObservation.temporalBound],
          }),
        },
        foreignScope,
      );
      await local.productRepository.putAssessments(
        [
          {
            schemaVersion: 'evidence-assessment/1',
            assessmentVersionId: foreignAssessmentVersionId,
            workspaceId: foreignWorkspaceId,
            sequence: 1,
            basisEvidenceRevision: assessmentCase.input.basisEvidenceRevision,
            contentHash: assessmentContentHash,
            ...assessmentContent,
          },
        ],
        foreignScope,
      );
      const foreignJobId = 'job-foreign-organization';
      await local.productRepository.putJob(
        {
          schemaVersion: 'evidence-product-job/1',
          jobId: foreignJobId,
          workspaceId: foreignWorkspaceId,
          commandKey: 'foreign-import-job',
          artifactVersionId: foreignSource.artifactVersionId,
          phase: 'completed',
          completedUnits: 2,
          totalUnits: 2,
          message: 'Foreign synthetic import completed.',
          cancelRequested: false,
          createdAt: '2026-08-12T10:03:00.000Z',
          updatedAt: '2026-08-12T10:03:00.000Z',
        },
        foreignScope,
      );

      for (const route of [
        'api/work-queue',
        'api/observations',
        'api/accounts/compare',
        'api/relations',
        'api/timeline',
        'api/open-questions',
        'api/assessments/latest',
        'api/technical/provenance',
        'api/technical/replay',
      ]) {
        const denied = await getForCase(foreignCaseId, route);
        expect(denied.status, route).toBe(404);
        expect(await denied.text()).toBe('Not found.');
      }
      expect(
        (await local.productRepository.snapshot()).securityAudit,
      ).toContainEqual(
        expect.objectContaining({
          caseId: foreignCaseId,
          principalRef: membership.principalRef,
          action: 'artifact.read-denied',
          outcome: 'denied',
        }),
      );
      for (const route of [
        `api/sources/${foreignSource.artifactVersionId}?workspaceId=${local.workspaceId}`,
        `api/reviews/observation/${foreignObservation.observationId}?workspaceId=${local.workspaceId}`,
        `api/jobs/${foreignJobId}`,
        `api/jobs/${foreignJobId}/events`,
        `api/assessments/${foreignAssessmentVersionId}/export`,
      ]) {
        const denied = await get(route);
        expect(denied.status, route).toBe(404);
        expect(await denied.text()).toBe('Not found.');
      }
      expect(
        (
          await post(
            `api/jobs/${foreignJobId}/cancel`,
            {},
            authenticated.csrf,
            foreignCaseId,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await post(
            'api/imports',
            {
              schemaVersion: 'evidence-import-command/1',
              workspaceId: foreignWorkspaceId,
              commandKey: 'foreign-import-attempt',
              artifactVersion: foreignSource,
              actorRoster: [],
            },
            authenticated.csrf,
            foreignCaseId,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await post(
            'api/assessments',
            {
              schemaVersion: 'evidence-assessment-command/1',
              workspaceId: foreignWorkspaceId,
              commandKey: 'foreign-assessment-attempt',
              sequence: 2,
              predecessorAssessmentVersionId: foreignAssessmentVersionId,
            },
            authenticated.csrf,
            foreignCaseId,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await post('api/reviews', {
            ...command,
            commandKey: 'foreign-target-review-attempt',
            targetVersionId: foreignObservation.observationId,
          })
        ).status,
      ).toBe(404);
      const ownQueueText = await (
        await get(`api/work-queue?workspaceId=${local.workspaceId}`)
      ).text();
      expect(ownQueueText).not.toContain(foreignObservation.observationId);
      expect(ownQueueText).not.toContain(foreignSource.artifactVersionId);

      const logout = await fetch(`${address.url}auth/session`, {
        method: 'DELETE',
        headers: {
          cookie: authenticated.header,
          origin,
          'x-acme-csrf': authenticated.csrf,
        },
      });
      expect(logout.status).toBe(204);
      expect(
        (await get(`api/work-queue?workspaceId=${local.workspaceId}`)).status,
      ).toBe(401);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const refused = await fetch(`${address.url}auth/session`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin },
          body: JSON.stringify({
            email: local.authCredentials.email,
            password: `wrong-${String(attempt)}`,
          }),
        });
        expect(refused.status).toBe(401);
      }
      const limited = await fetch(`${address.url}auth/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify(local.authCredentials),
      });
      expect(limited.status).toBe(429);
    } finally {
      await local.close();
    }
  });
});
