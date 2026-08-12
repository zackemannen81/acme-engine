import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { listenEvidenceWorkbenchApi } from '../src/index.js';
import { createLocalEvidenceWorkbench } from '../src/local.js';

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('Evidence case-management HTTP boundary', () => {
  it('creates, searches, updates, assigns, archives and restores without workspace authority', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'evidence-cases-'));
    directories.push(directory);
    const local = await createLocalEvidenceWorkbench({
      dataFile: path.join(directory, 'product.json'),
      seedMode: 'none',
      clock: { now: () => '2026-08-12T12:00:00.000Z' },
    });
    const address = await listenEvidenceWorkbenchApi(local.server, { port: 0 });
    const origin = address.url.slice(0, -1);
    try {
      const login = await fetch(`${address.url}auth/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify(local.authCredentials),
      });
      expect(login.status).toBe(201);
      const cookies = login.headers.getSetCookie();
      const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
      const csrfPart = cookies
        .map((value) => value.split(';')[0])
        .find((value) => value?.startsWith('acme_csrf='));
      if (csrfPart === undefined) throw new Error('Missing CSRF cookie.');
      const csrf = decodeURIComponent(csrfPart.slice('acme_csrf='.length));
      const request = (
        pathname: string,
        init: RequestInit = {},
      ): Promise<Response> => {
        const method = init.method ?? 'GET';
        const headers = new Headers(init.headers);
        headers.set('cookie', cookie);
        if (!['GET', 'HEAD'].includes(method)) {
          headers.set('origin', origin);
          headers.set('x-acme-csrf', csrf);
        }
        return fetch(`${address.url}${pathname}`, { ...init, headers });
      };
      const identity = await local.identityRepository.snapshot();
      const organizationId = identity.organizations[0]?.organizationId;
      const adminPrincipal = identity.principals[0]?.principalRef;
      if (organizationId === undefined || adminPrincipal === undefined)
        throw new Error('Missing local identity seed.');

      const createdResponse = await request(
        `api/organizations/${organizationId}/cases`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 'evidence-create-case-command/1',
            commandKey: 'http-case-2',
            title: 'Second synthetic matter',
            caseReference: 'MATTER-002',
            metadata: { team: 'review-beta' },
          }),
        },
      );
      expect(createdResponse.status, await createdResponse.clone().text()).toBe(
        201,
      );
      const created = (await createdResponse.json()) as {
        caseId: string;
        workspaceId: string;
        revision: number;
      };
      expect(created.caseId).not.toBe(created.workspaceId);

      const catalog = await request(
        `api/cases?organizationId=${organizationId}&q=matter-002&status=active`,
      );
      expect(catalog.status).toBe(200);
      expect(
        ((await catalog.json()) as { cases: { caseId: string }[] }).cases.map(
          (item) => item.caseId,
        ),
      ).toEqual([created.caseId]);
      expect(
        (
          await request(
            `api/cases/${created.caseId}/work-queue?workspaceId=${created.workspaceId}`,
          )
        ).status,
      ).toBe(400);
      expect((await request('api/work-queue')).status).toBe(404);

      const updatedResponse = await request(`api/cases/${created.caseId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 'evidence-update-case-command/1',
          expectedRevision: created.revision,
          title: 'Second synthetic matter — scoped',
          caseReference: 'MATTER-002',
          metadata: { team: 'review-beta' },
        }),
      });
      expect(updatedResponse.status).toBe(200);
      const updated = (await updatedResponse.json()) as { revision: number };

      await local.identityRepository.putPrincipal({
        schemaVersion: 'evidence-principal-profile/1',
        principalRef: 'principal-case-reviewer',
        issuer: 'https://local.auth.invalid/',
        subject: 'case-reviewer-2',
        displayLabel: 'Case reviewer 2',
        createdAt: '2026-08-12T12:00:00.000Z',
      });
      await local.identityRepository.putMembership({
        schemaVersion: 'evidence-organization-membership/1',
        membershipId: 'membership-case-reviewer-2',
        organizationId,
        principalRef: 'principal-case-reviewer',
        role: 'reviewer',
        status: 'active',
        createdAt: '2026-08-12T12:00:00.000Z',
        updatedAt: '2026-08-12T12:00:00.000Z',
      });
      const participant = await request(
        `api/cases/${created.caseId}/participants/principal-case-reviewer`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedCaseRevision: updated.revision,
            role: 'case-reviewer',
            status: 'active',
          }),
        },
      );
      expect(participant.status).toBe(200);
      expect(
        (
          (await (
            await request(`api/cases/${created.caseId}/participants`)
          ).json()) as { participants: { principalRef: string }[] }
        ).participants.map((item) => item.principalRef),
      ).toContain('principal-case-reviewer');

      const archivedResponse = await request(
        `api/cases/${created.caseId}/archive`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ expectedRevision: updated.revision + 1 }),
        },
      );
      expect(archivedResponse.status).toBe(200);
      const archived = (await archivedResponse.json()) as { revision: number };
      expect((await request(`api/cases/${created.caseId}`)).status).toBe(200);
      expect(
        (
          await request(`api/cases/${created.caseId}/reviews`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              schemaVersion: 'evidence-review-command/3',
              commandKey: 'archived-write',
              targetKind: 'observation',
              targetVersionId: 'known-or-guessed-id',
              action: 'accept',
              rationale: 'Must be refused before target lookup.',
              basisEvidenceRevision: null,
            }),
          })
        ).status,
      ).toBe(403);
      const restored = await request(`api/cases/${created.caseId}/restore`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: archived.revision }),
      });
      expect(restored.status).toBe(200);
      expect(((await restored.json()) as { status: string }).status).toBe(
        'active',
      );
      expect(adminPrincipal).not.toBe('principal-case-reviewer');
    } finally {
      await new Promise<void>((resolve, reject) =>
        local.server.close((error) => (error ? reject(error) : resolve())),
      );
      await local.close();
    }
  });
});
