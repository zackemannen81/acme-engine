import { afterAll, describe, expect, it } from 'vitest';

import {
  createPostgresEvidenceIdentityRepository,
  dropEvidenceIdentitySchema,
  migrateEvidenceIdentitySchema,
} from '../../packages/adapter-evidence-auth-postgres/src/index.js';
import { createSharedPool, randomSchema } from './harness.js';

const pool = createSharedPool();
const schemas: string[] = [];
const now = '2026-08-12T00:00:00.000Z';

afterAll(async () => {
  for (const schema of schemas) await dropEvidenceIdentitySchema(pool, schema);
  await pool.end();
});

describe('Evidence identity PostgreSQL adapter', () => {
  it('migrates concurrently and survives repository restart without plaintext secrets', async () => {
    const schema = randomSchema('evidence_identity_test');
    schemas.push(schema);
    await Promise.all([
      migrateEvidenceIdentitySchema({ pool, schema, appliedAt: now }),
      migrateEvidenceIdentitySchema({ pool, schema, appliedAt: now }),
    ]);
    const repository = createPostgresEvidenceIdentityRepository({
      pool,
      schema,
    });
    await repository.putOrganization({
      schemaVersion: 'evidence-organization/1',
      organizationId: 'org-1',
      label: 'Synthetic organization',
      createdAt: now,
    });
    await repository.putPrincipal({
      schemaVersion: 'evidence-principal-profile/1',
      principalRef: 'principal-1',
      issuer: 'https://auth.example.invalid/',
      subject: 'subject-1',
      displayLabel: 'Reviewer',
      createdAt: now,
    });
    await repository.putMembership({
      schemaVersion: 'evidence-organization-membership/1',
      membershipId: 'membership-1',
      organizationId: 'org-1',
      principalRef: 'principal-1',
      role: 'reviewer',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await repository.putWorkspaceBinding({
      schemaVersion: 'evidence-workspace-organization-binding/1',
      workspaceId: 'workspace-1',
      organizationId: 'org-1',
      boundAt: now,
    });
    await repository.putCase({
      schemaVersion: 'evidence-case/1',
      caseId: 'case-1',
      organizationId: 'org-1',
      workspaceId: 'workspace-1',
      title: 'Synthetic case',
      caseReference: 'CASE-1',
      metadata: {},
      dataPolicy: 'synthetic-only',
      status: 'active',
      revision: 1,
      createdAt: now,
      updatedAt: now,
      createdByPrincipalRef: 'principal-1',
      updatedByPrincipalRef: 'principal-1',
    });
    await repository.putCaseMembership({
      schemaVersion: 'evidence-case-membership/1',
      caseMembershipId: 'case-membership-1',
      caseId: 'case-1',
      organizationId: 'org-1',
      principalRef: 'principal-1',
      role: 'case-reviewer',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      updatedByPrincipalRef: 'principal-1',
    });
    await repository.putSession({
      schemaVersion: 'evidence-product-session/1',
      sessionId: 'session-1',
      tokenDigest: 'a'.repeat(64),
      csrfDigest: 'b'.repeat(64),
      principalRef: 'principal-1',
      upstreamSessionId: 'upstream-1',
      protectedUpstreamSession: {
        v: 'acme-payload-envelope-1',
        algorithm: 'aes-256-gcm',
        keyId: 'session-key',
        iv: 'test-iv',
        authTag: 'test-auth-tag',
        ciphertext: 'protected-ciphertext',
      },
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt: '2026-08-12T00:30:00.000Z',
      absoluteExpiresAt: '2026-08-12T08:00:00.000Z',
      revokedAt: null,
    });

    const restarted = createPostgresEvidenceIdentityRepository({
      pool,
      schema,
    });
    const snapshot = await restarted.snapshot();
    expect(snapshot.organizations).toHaveLength(1);
    expect(snapshot.memberships[0]?.role).toBe('reviewer');
    expect(snapshot.workspaceBindings[0]?.organizationId).toBe('org-1');
    expect(snapshot.cases[0]?.workspaceId).toBe('workspace-1');
    expect(snapshot.caseMemberships[0]?.role).toBe('case-reviewer');
    const storedCase = snapshot.cases[0];
    if (storedCase === undefined) throw new Error('Missing stored case.');
    await expect(
      restarted.putCase({ ...storedCase, title: 'Revision reuse attack' }),
    ).rejects.toThrow('monotonic persistence policy');
    const storedSession = snapshot.sessions[0];
    if (storedSession === undefined) throw new Error('Missing stored session.');
    expect(storedSession.sessionId).toBe('session-1');
    await restarted.putSession({
      ...storedSession,
      revokedAt: '2026-08-12T00:05:00.000Z',
    });
    await expect(restarted.putSession(storedSession)).rejects.toThrow(
      'monotonic persistence policy',
    );
    const persisted = await pool.query<{ record_json: string }>(
      `SELECT record_json FROM "${schema}".sessions`,
    );
    expect(persisted.rows[0]?.record_json).not.toContain('raw-session-token');
    expect(persisted.rows[0]?.record_json).not.toContain(
      'upstream-access-token',
    );
    expect(persisted.rows[0]?.record_json).not.toContain(
      'upstream-refresh-token',
    );
  });

  it('enforces identity references and unique token digests', async () => {
    const schema = randomSchema('evidence_identity_constraints');
    schemas.push(schema);
    await migrateEvidenceIdentitySchema({ pool, schema, appliedAt: now });
    const repository = createPostgresEvidenceIdentityRepository({
      pool,
      schema,
    });
    await expect(
      repository.putWorkspaceBinding({
        schemaVersion: 'evidence-workspace-organization-binding/1',
        workspaceId: 'orphan-workspace',
        organizationId: 'missing-organization',
        boundAt: now,
      }),
    ).rejects.toThrow();
    await repository.putOrganization({
      schemaVersion: 'evidence-organization/1',
      organizationId: 'org-constraint',
      label: 'Constraint organization',
      createdAt: now,
    });
    await repository.putPrincipal({
      schemaVersion: 'evidence-principal-profile/1',
      principalRef: 'principal-constraint',
      issuer: 'https://auth.example.invalid/',
      subject: 'constraint-subject',
      displayLabel: 'Constraint reviewer',
      createdAt: now,
    });
    const session = {
      schemaVersion: 'evidence-product-session/1' as const,
      sessionId: 'constraint-session-1',
      tokenDigest: 'c'.repeat(64),
      csrfDigest: 'd'.repeat(64),
      principalRef: 'principal-constraint',
      upstreamSessionId: 'upstream-constraint',
      protectedUpstreamSession: {
        v: 'acme-payload-envelope-1' as const,
        algorithm: 'aes-256-gcm' as const,
        keyId: 'session-key',
        iv: 'test-iv',
        authTag: 'test-auth-tag',
        ciphertext: 'protected-ciphertext',
      },
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt: '2026-08-12T00:30:00.000Z',
      absoluteExpiresAt: '2026-08-12T08:00:00.000Z',
      revokedAt: null,
    };
    await repository.putSession(session);
    await expect(
      repository.putSession({ ...session, sessionId: 'constraint-session-2' }),
    ).rejects.toThrow();
  });
});
