import { describe, expect, it } from 'vitest';

import { createInMemoryEvidenceIdentityRepository } from '../src/index.js';

describe('in-memory Evidence identity repository', () => {
  it('retains organization bindings and updates one session without plaintext token fields', async () => {
    const repository = createInMemoryEvidenceIdentityRepository();
    await repository.putOrganization({
      schemaVersion: 'evidence-organization/1',
      organizationId: 'org-1',
      label: 'Synthetic',
      createdAt: '2026-08-12T00:00:00.000Z',
    });
    await repository.putWorkspaceBinding({
      schemaVersion: 'evidence-workspace-organization-binding/1',
      workspaceId: 'workspace-1',
      organizationId: 'org-1',
      boundAt: '2026-08-12T00:00:00.000Z',
    });
    const session = {
      schemaVersion: 'evidence-product-session/1' as const,
      sessionId: 'session-1',
      tokenDigest: 'a'.repeat(64),
      csrfDigest: 'b'.repeat(64),
      principalRef: 'principal-1',
      upstreamSessionId: 'upstream-1',
      protectedUpstreamSession: {
        v: 'acme-payload-envelope-1' as const,
        algorithm: 'aes-256-gcm' as const,
        keyId: 'key-1',
        iv: 'iv',
        authTag: 'tag',
        ciphertext: 'ciphertext',
      },
      createdAt: '2026-08-12T00:00:00.000Z',
      lastSeenAt: '2026-08-12T00:00:00.000Z',
      idleExpiresAt: '2026-08-12T00:30:00.000Z',
      absoluteExpiresAt: '2026-08-12T08:00:00.000Z',
      revokedAt: null,
    };
    await repository.putSession(session);
    await repository.putSession({
      ...session,
      revokedAt: '2026-08-12T00:05:00.000Z',
    });
    await expect(repository.putSession(session)).rejects.toThrow(
      'A revoked session cannot be restored.',
    );
    const snapshot = await repository.snapshot();
    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.sessions[0]?.revokedAt).not.toBeNull();
    expect(JSON.stringify(snapshot)).not.toContain('refresh-token');
  });
});
