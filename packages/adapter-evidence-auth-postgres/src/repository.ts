import { canonicalJson } from '@acme/core';
import {
  EvidenceIdentitySnapshotSchema,
  EvidenceCaseMembershipSchema,
  EvidenceCaseSchema,
  EvidenceOrganizationMembershipSchema,
  EvidenceOrganizationSchema,
  EvidencePrincipalProfileSchema,
  EvidenceProductSessionSchema,
  EvidenceWorkspaceOrganizationBindingSchema,
  type EvidenceIdentityRepository,
} from '@acme/evidence-auth';
import type { Pool } from 'pg';

function validSchema(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(value))
    throw new Error('Invalid identity schema name.');
  return `"${value}"`;
}

export function createPostgresEvidenceIdentityRepository(options: {
  readonly pool: Pool;
  readonly schema?: string;
}): EvidenceIdentityRepository {
  const s = validSchema(options.schema ?? 'evidence_identity');
  const records = async (table: string): Promise<unknown[]> =>
    (
      await options.pool.query<{ record_json: string }>(
        `SELECT record_json FROM ${s}.${table}`,
      )
    ).rows.map((row) => JSON.parse(row.record_json) as unknown);
  return {
    async snapshot() {
      const [
        organizations,
        principals,
        memberships,
        workspaceBindings,
        cases,
        caseMemberships,
        sessions,
      ] = await Promise.all([
        records('organizations'),
        records('principals'),
        records('memberships'),
        records('workspace_bindings'),
        records('cases'),
        records('case_memberships'),
        records('sessions'),
      ]);
      return EvidenceIdentitySnapshotSchema.parse({
        schemaVersion: 'evidence-identity-snapshot/1',
        organizations,
        principals,
        memberships,
        workspaceBindings,
        cases,
        caseMemberships,
        sessions,
      });
    },
    async putOrganization(input) {
      const value = EvidenceOrganizationSchema.parse(input);
      await options.pool.query(
        `INSERT INTO ${s}.organizations (organization_id, record_json) VALUES ($1,$2) ON CONFLICT (organization_id) DO UPDATE SET record_json=EXCLUDED.record_json`,
        [value.organizationId, canonicalJson(value as never)],
      );
      return value;
    },
    async putPrincipal(input) {
      const value = EvidencePrincipalProfileSchema.parse(input);
      await options.pool.query(
        `INSERT INTO ${s}.principals (principal_ref, issuer, subject, record_json) VALUES ($1,$2,$3,$4) ON CONFLICT (principal_ref) DO UPDATE SET issuer=EXCLUDED.issuer, subject=EXCLUDED.subject, record_json=EXCLUDED.record_json`,
        [
          value.principalRef,
          value.issuer,
          value.subject,
          canonicalJson(value as never),
        ],
      );
      return value;
    },
    async putMembership(input) {
      const value = EvidenceOrganizationMembershipSchema.parse(input);
      await options.pool.query(
        `INSERT INTO ${s}.memberships (membership_id, organization_id, principal_ref, record_json) VALUES ($1,$2,$3,$4) ON CONFLICT (membership_id) DO UPDATE SET organization_id=EXCLUDED.organization_id, principal_ref=EXCLUDED.principal_ref, record_json=EXCLUDED.record_json`,
        [
          value.membershipId,
          value.organizationId,
          value.principalRef,
          canonicalJson(value as never),
        ],
      );
      return value;
    },
    async putWorkspaceBinding(input) {
      const value = EvidenceWorkspaceOrganizationBindingSchema.parse(input);
      await options.pool.query(
        `INSERT INTO ${s}.workspace_bindings (workspace_id, organization_id, record_json) VALUES ($1,$2,$3) ON CONFLICT (workspace_id) DO UPDATE SET organization_id=EXCLUDED.organization_id, record_json=EXCLUDED.record_json`,
        [
          value.workspaceId,
          value.organizationId,
          canonicalJson(value as never),
        ],
      );
      return value;
    },
    async putCase(input) {
      const value = EvidenceCaseSchema.parse(input);
      const result = await options.pool.query(
        `INSERT INTO ${s}.cases (case_id, organization_id, workspace_id, revision, status, record_json)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (case_id) DO UPDATE SET
           revision=EXCLUDED.revision,
           status=EXCLUDED.status,
           record_json=EXCLUDED.record_json
         WHERE ${s}.cases.organization_id=EXCLUDED.organization_id
           AND ${s}.cases.workspace_id=EXCLUDED.workspace_id
           AND ((EXCLUDED.revision=${s}.cases.revision AND EXCLUDED.record_json=${s}.cases.record_json)
             OR EXCLUDED.revision=${s}.cases.revision+1)
         RETURNING record_json`,
        [
          value.caseId,
          value.organizationId,
          value.workspaceId,
          value.revision,
          value.status,
          canonicalJson(value as never),
        ],
      );
      if (result.rowCount !== 1)
        throw new Error('Case update refused by monotonic persistence policy.');
      return value;
    },
    async putCaseMembership(input) {
      const value = EvidenceCaseMembershipSchema.parse(input);
      const result = await options.pool.query(
        `INSERT INTO ${s}.case_memberships (case_membership_id, case_id, organization_id, principal_ref, record_json)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (case_membership_id) DO UPDATE SET record_json=EXCLUDED.record_json
         WHERE ${s}.case_memberships.case_id=EXCLUDED.case_id
           AND ${s}.case_memberships.organization_id=EXCLUDED.organization_id
           AND ${s}.case_memberships.principal_ref=EXCLUDED.principal_ref
         RETURNING record_json`,
        [
          value.caseMembershipId,
          value.caseId,
          value.organizationId,
          value.principalRef,
          canonicalJson(value as never),
        ],
      );
      if (result.rowCount !== 1)
        throw new Error('Immutable case membership identity changed.');
      return value;
    },
    async putCaseMembershipAtRevision(input, nextCaseInput) {
      const value = EvidenceCaseMembershipSchema.parse(input);
      const nextCase = EvidenceCaseSchema.parse(nextCaseInput);
      const client = await options.pool.connect();
      try {
        await client.query('BEGIN');
        const caseResult = await client.query(
          `UPDATE ${s}.cases SET revision=$2, status=$3, record_json=$4
           WHERE case_id=$1 AND organization_id=$5 AND workspace_id=$6
             AND revision=$2-1
           RETURNING case_id`,
          [
            nextCase.caseId,
            nextCase.revision,
            nextCase.status,
            canonicalJson(nextCase as never),
            nextCase.organizationId,
            nextCase.workspaceId,
          ],
        );
        if (caseResult.rowCount !== 1)
          throw new Error('Case membership revision conflict.');
        const membershipResult = await client.query(
          `INSERT INTO ${s}.case_memberships (case_membership_id, case_id, organization_id, principal_ref, record_json)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (case_membership_id) DO UPDATE SET record_json=EXCLUDED.record_json
           WHERE ${s}.case_memberships.case_id=EXCLUDED.case_id
             AND ${s}.case_memberships.organization_id=EXCLUDED.organization_id
             AND ${s}.case_memberships.principal_ref=EXCLUDED.principal_ref
           RETURNING case_membership_id`,
          [
            value.caseMembershipId,
            value.caseId,
            value.organizationId,
            value.principalRef,
            canonicalJson(value as never),
          ],
        );
        if (membershipResult.rowCount !== 1)
          throw new Error('Immutable case membership identity changed.');
        await client.query('COMMIT');
        return value;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async putSession(input) {
      const value = EvidenceProductSessionSchema.parse(input);
      const result = await options.pool.query(
        `INSERT INTO ${s}.sessions (session_id, token_digest, principal_ref, absolute_expires_at, revoked_at, record_json) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (session_id) DO UPDATE SET revoked_at=EXCLUDED.revoked_at, record_json=EXCLUDED.record_json
         WHERE ${s}.sessions.token_digest=EXCLUDED.token_digest
           AND ${s}.sessions.principal_ref=EXCLUDED.principal_ref
           AND ${s}.sessions.absolute_expires_at=EXCLUDED.absolute_expires_at
           AND ${s}.sessions.revoked_at IS NULL
         RETURNING record_json`,
        [
          value.sessionId,
          value.tokenDigest,
          value.principalRef,
          value.absoluteExpiresAt,
          value.revokedAt,
          canonicalJson(value as never),
        ],
      );
      if (result.rowCount !== 1) {
        throw new Error(
          'Session update refused by monotonic persistence policy.',
        );
      }
      return value;
    },
  };
}
