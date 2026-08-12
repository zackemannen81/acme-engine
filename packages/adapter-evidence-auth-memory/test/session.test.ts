import { describe, expect, it } from 'vitest';

import { createAes256GcmPayloadEncryptor, nodeHashing } from '@acme/core';
import {
  EvidenceAuthenticationError,
  createEvidenceSessionService,
  deriveEvidencePrincipalRef,
} from '@acme/evidence-auth';

import {
  createDeterministicEvidenceAuthenticator,
  createInMemoryEvidenceIdentityRepository,
} from '../src/index.js';

describe('Evidence BFF session service', () => {
  it('stores only digests/protected upstream tokens and revokes before logout', async () => {
    const now = '2026-08-12T00:00:00.000Z';
    const issuer = 'https://auth.example.test/';
    const principalRef = deriveEvidencePrincipalRef(
      nodeHashing,
      issuer,
      'user-1',
    );
    const repository = createInMemoryEvidenceIdentityRepository({
      schemaVersion: 'evidence-identity-snapshot/1',
      organizations: [
        {
          schemaVersion: 'evidence-organization/1',
          organizationId: 'org-1',
          label: 'Org',
          createdAt: now,
        },
      ],
      principals: [
        {
          schemaVersion: 'evidence-principal-profile/1',
          principalRef,
          issuer,
          subject: 'user-1',
          displayLabel: 'Reviewer',
          createdAt: now,
        },
      ],
      memberships: [
        {
          schemaVersion: 'evidence-organization-membership/1',
          membershipId: 'member-1',
          organizationId: 'org-1',
          principalRef,
          role: 'reviewer',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
      ],
      workspaceBindings: [],
      sessions: [],
    });
    const authenticator = createDeterministicEvidenceAuthenticator({
      issuer,
      accounts: [
        {
          email: 'reviewer@example.invalid',
          password: 'test-only-password',
          subject: 'user-1',
          displayLabel: 'Reviewer',
        },
      ],
      expiresAt: '2026-08-12T00:15:00.000Z',
    });
    let upstreamLogoutAttempted = false;
    let counter = 0;
    const service = createEvidenceSessionService({
      repository,
      authenticator: {
        ...authenticator,
        async signOut() {
          upstreamLogoutAttempted = true;
          throw new Error('Injected upstream logout outage.');
        },
      },
      clock: { now: () => now },
      secrets: { nextToken: (kind) => `${kind}-secret-${++counter}` },
      hashing: nodeHashing,
      protector: createAes256GcmPayloadEncryptor({
        key: new Uint8Array(32).fill(7),
        keyId: 'session-key',
      }),
    });
    const login = await service.login({
      email: 'reviewer@example.invalid',
      password: 'test-only-password',
    });
    const stored = JSON.stringify(await repository.snapshot());
    expect(stored).not.toContain(login.rawToken);
    expect(stored).not.toContain('access-user-1');
    expect(stored).not.toContain('refresh-user-1');
    await expect(
      service.resolve(login.rawToken, login.csrfToken),
    ).resolves.toMatchObject({ principal: { principalRef } });
    await service.logout(login.rawToken);
    await expect(service.resolve(login.rawToken)).rejects.toBeInstanceOf(
      EvidenceAuthenticationError,
    );
    expect(upstreamLogoutAttempted).toBe(true);
  });

  it('refreshes across service restart and enforces idle expiry', async () => {
    let current = '2026-08-12T00:00:00.000Z';
    const issuer = 'https://auth.example.test/';
    const principalRef = deriveEvidencePrincipalRef(
      nodeHashing,
      issuer,
      'user-2',
    );
    const repository = createInMemoryEvidenceIdentityRepository({
      schemaVersion: 'evidence-identity-snapshot/1',
      organizations: [
        {
          schemaVersion: 'evidence-organization/1',
          organizationId: 'org-2',
          label: 'Org',
          createdAt: current,
        },
      ],
      principals: [
        {
          schemaVersion: 'evidence-principal-profile/1',
          principalRef,
          issuer,
          subject: 'user-2',
          displayLabel: 'Reviewer',
          createdAt: current,
        },
      ],
      memberships: [
        {
          schemaVersion: 'evidence-organization-membership/1',
          membershipId: 'member-2',
          organizationId: 'org-2',
          principalRef,
          role: 'reviewer',
          status: 'active',
          createdAt: current,
          updatedAt: current,
        },
      ],
      workspaceBindings: [],
      sessions: [],
    });
    let refreshes = 0;
    const authenticator = {
      async signIn() {
        return {
          accessToken: 'access-before-refresh',
          refreshToken: 'refresh-user-2',
          expiresAt: '2026-08-12T00:01:00.000Z',
          issuer,
          subject: 'user-2',
          sessionId: 'upstream-user-2',
          displayLabel: 'Reviewer',
        };
      },
      async refresh() {
        refreshes += 1;
        return {
          accessToken: 'access-after-refresh',
          refreshToken: 'refresh-user-2-next',
          expiresAt: '2026-08-12T00:20:00.000Z',
          issuer,
          subject: 'user-2',
          sessionId: 'upstream-user-2',
          displayLabel: 'Reviewer',
        };
      },
      async signOut() {},
    };
    const protector = createAes256GcmPayloadEncryptor({
      key: new Uint8Array(32).fill(9),
      keyId: 'restart-key',
    });
    let token = 0;
    const createService = () =>
      createEvidenceSessionService({
        repository,
        authenticator,
        clock: { now: () => current },
        secrets: { nextToken: (kind) => `${kind}-restart-${++token}` },
        hashing: nodeHashing,
        protector,
      });
    const login = await createService().login({
      email: 'ignored',
      password: 'ignored',
    });
    current = '2026-08-12T00:02:00.000Z';
    await expect(
      createService().resolve(login.rawToken),
    ).resolves.toMatchObject({
      principal: { principalRef },
    });
    expect(refreshes).toBe(1);
    const refreshedRecord = (await repository.snapshot()).sessions[0];
    if (refreshedRecord === undefined)
      throw new Error('Missing refreshed session record.');
    expect(
      protector.decrypt(refreshedRecord.protectedUpstreamSession),
    ).toMatchObject({
      accessToken: 'access-after-refresh',
      refreshToken: 'refresh-user-2-next',
    });
    current = '2026-08-12T00:33:00.000Z';
    await expect(
      createService().resolve(login.rawToken),
    ).rejects.toBeInstanceOf(EvidenceAuthenticationError);
  });

  it('refuses malformed, refresh-failed and absolute-expired sessions', async () => {
    let current = '2026-08-12T00:00:00.000Z';
    let rejectRefresh = true;
    const issuer = 'https://auth.example.test/';
    const subject = 'user-absolute';
    const principalRef = deriveEvidencePrincipalRef(
      nodeHashing,
      issuer,
      subject,
    );
    const repository = createInMemoryEvidenceIdentityRepository({
      schemaVersion: 'evidence-identity-snapshot/1',
      organizations: [
        {
          schemaVersion: 'evidence-organization/1',
          organizationId: 'org-absolute',
          label: 'Absolute expiry organization',
          createdAt: current,
        },
      ],
      principals: [
        {
          schemaVersion: 'evidence-principal-profile/1',
          principalRef,
          issuer,
          subject,
          displayLabel: 'Absolute reviewer',
          createdAt: current,
        },
      ],
      memberships: [
        {
          schemaVersion: 'evidence-organization-membership/1',
          membershipId: 'member-absolute',
          organizationId: 'org-absolute',
          principalRef,
          role: 'reviewer',
          status: 'active',
          createdAt: current,
          updatedAt: current,
        },
      ],
      workspaceBindings: [],
      sessions: [],
    });
    const upstream = {
      accessToken: 'absolute-access',
      refreshToken: 'absolute-refresh',
      expiresAt: '2026-08-12T00:01:00.000Z',
      issuer,
      subject,
      sessionId: 'absolute-upstream-session',
      displayLabel: 'Absolute reviewer',
    };
    const service = createEvidenceSessionService({
      repository,
      authenticator: {
        async signIn() {
          return upstream;
        },
        async refresh() {
          if (rejectRefresh) throw new Error('Injected refresh failure.');
          return {
            ...upstream,
            accessToken: 'absolute-access-rotated',
            refreshToken: 'absolute-refresh-rotated',
            expiresAt: '2026-08-12T09:00:00.000Z',
          };
        },
        async signOut() {},
      },
      clock: { now: () => current },
      secrets: { nextToken: (kind) => `${kind}-absolute-secret` },
      hashing: nodeHashing,
      protector: createAes256GcmPayloadEncryptor({
        key: new Uint8Array(32).fill(11),
        keyId: 'absolute-key',
      }),
    });
    const login = await service.login({
      email: 'ignored',
      password: 'ignored',
    });
    await expect(
      service.resolve('malformed-session-token'),
    ).rejects.toBeInstanceOf(EvidenceAuthenticationError);
    current = '2026-08-12T00:02:00.000Z';
    await expect(service.resolve(login.rawToken)).rejects.toMatchObject({
      status: 401,
      message: 'Session refresh failed.',
    });
    rejectRefresh = false;
    for (let minute = 2; minute < 480; minute += 29) {
      current = new Date(
        Date.parse('2026-08-12T00:00:00.000Z') + minute * 60 * 1_000,
      ).toISOString();
      await expect(service.resolve(login.rawToken)).resolves.toBeDefined();
    }
    current = '2026-08-12T08:00:00.000Z';
    await expect(service.resolve(login.rawToken)).rejects.toBeInstanceOf(
      EvidenceAuthenticationError,
    );
  });
});
