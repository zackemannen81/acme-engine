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
  type EvidenceIdentitySnapshot,
  type EvidenceCredentialAuthenticator,
  type EvidenceUpstreamSession,
} from '@acme/evidence-auth';

function initial(): EvidenceIdentitySnapshot {
  return {
    schemaVersion: 'evidence-identity-snapshot/1',
    organizations: [],
    principals: [],
    memberships: [],
    workspaceBindings: [],
    cases: [],
    caseMemberships: [],
    sessions: [],
  };
}

export function createDeterministicEvidenceAuthenticator(options: {
  readonly issuer: string;
  readonly accounts: readonly {
    readonly email: string;
    readonly password: string;
    readonly subject: string;
    readonly displayLabel: string;
  }[];
  readonly expiresAt: string;
}): EvidenceCredentialAuthenticator & { readonly signOuts: string[] } {
  const signOuts: string[] = [];
  const sessions = new Map<string, EvidenceUpstreamSession>();
  const create = (
    subject: string,
    displayLabel: string,
  ): EvidenceUpstreamSession => {
    const session: EvidenceUpstreamSession = {
      accessToken: `access-${subject}`,
      refreshToken: `refresh-${subject}`,
      expiresAt: options.expiresAt,
      issuer: options.issuer,
      subject,
      sessionId: `upstream-${subject}`,
      displayLabel,
    };
    sessions.set(session.refreshToken, session);
    return session;
  };
  return {
    signOuts,
    async signIn(input) {
      const account = options.accounts.find(
        (item) =>
          item.email === input.email && item.password === input.password,
      );
      if (account === undefined) throw new Error('Invalid credentials.');
      return create(account.subject, account.displayLabel);
    },
    async refresh(refreshToken) {
      const session = sessions.get(refreshToken);
      if (session === undefined) throw new Error('Invalid refresh token.');
      return session;
    },
    async signOut(accessToken) {
      signOuts.push(accessToken);
    },
  };
}

export function createInMemoryEvidenceIdentityRepository(
  seed: unknown = initial(),
): EvidenceIdentityRepository {
  let state = EvidenceIdentitySnapshotSchema.parse(seed);
  const replace = <T>(
    values: readonly T[],
    value: T,
    key: (item: T) => string,
  ): T[] => [...values.filter((item) => key(item) !== key(value)), value];
  const commit = (next: EvidenceIdentitySnapshot) => {
    state = EvidenceIdentitySnapshotSchema.parse(next);
  };
  return {
    async snapshot() {
      return EvidenceIdentitySnapshotSchema.parse(state);
    },
    async putOrganization(input) {
      const value = EvidenceOrganizationSchema.parse(input);
      commit({
        ...state,
        organizations: replace(
          state.organizations,
          value,
          (x) => x.organizationId,
        ),
      });
      return value;
    },
    async putPrincipal(input) {
      const value = EvidencePrincipalProfileSchema.parse(input);
      const collision = state.principals.find(
        (item) =>
          item.issuer === value.issuer &&
          item.subject === value.subject &&
          item.principalRef !== value.principalRef,
      );
      if (collision)
        throw new Error('Issuer/subject already maps to another principal.');
      commit({
        ...state,
        principals: replace(state.principals, value, (x) => x.principalRef),
      });
      return value;
    },
    async putMembership(input) {
      const value = EvidenceOrganizationMembershipSchema.parse(input);
      commit({
        ...state,
        memberships: replace(state.memberships, value, (x) => x.membershipId),
      });
      return value;
    },
    async putWorkspaceBinding(input) {
      const value = EvidenceWorkspaceOrganizationBindingSchema.parse(input);
      const boundCase = state.cases.find(
        (item) => item.workspaceId === value.workspaceId,
      );
      if (
        boundCase !== undefined &&
        boundCase.organizationId !== value.organizationId
      ) {
        throw new Error('Workspace organization differs from its case.');
      }
      commit({
        ...state,
        workspaceBindings: replace(
          state.workspaceBindings,
          value,
          (x) => x.workspaceId,
        ),
      });
      return value;
    },
    async putCase(input) {
      const value = EvidenceCaseSchema.parse(input);
      const current = state.cases.find((item) => item.caseId === value.caseId);
      const workspaceCollision = state.cases.find(
        (item) =>
          item.workspaceId === value.workspaceId &&
          item.caseId !== value.caseId,
      );
      if (workspaceCollision !== undefined)
        throw new Error('Workspace is already bound to another case.');
      const binding = state.workspaceBindings.find(
        (item) => item.workspaceId === value.workspaceId,
      );
      if (
        binding !== undefined &&
        binding.organizationId !== value.organizationId
      )
        throw new Error('Case organization differs from workspace binding.');
      if (
        current !== undefined &&
        (current.organizationId !== value.organizationId ||
          current.workspaceId !== value.workspaceId ||
          current.createdAt !== value.createdAt ||
          current.createdByPrincipalRef !== value.createdByPrincipalRef ||
          (value.revision !== current.revision &&
            value.revision !== current.revision + 1))
      ) {
        throw new Error('Case identity or revision changed non-monotonically.');
      }
      if (
        current !== undefined &&
        current.revision === value.revision &&
        canonicalJson(current as never) !== canonicalJson(value as never)
      )
        throw new Error('Case revision was reused with different content.');
      commit({
        ...state,
        cases: replace(state.cases, value, (x) => x.caseId),
      });
      return value;
    },
    async putCaseMembership(input) {
      const value = EvidenceCaseMembershipSchema.parse(input);
      const evidenceCase = state.cases.find(
        (item) => item.caseId === value.caseId,
      );
      if (
        evidenceCase === undefined ||
        evidenceCase.organizationId !== value.organizationId
      ) {
        throw new Error('Case membership has no matching case organization.');
      }
      const current = state.caseMemberships.find(
        (item) => item.caseMembershipId === value.caseMembershipId,
      );
      const collision = state.caseMemberships.find(
        (item) =>
          item.caseId === value.caseId &&
          item.principalRef === value.principalRef &&
          item.caseMembershipId !== value.caseMembershipId,
      );
      if (collision !== undefined)
        throw new Error('Principal already has a case membership.');
      if (
        current !== undefined &&
        (current.caseId !== value.caseId ||
          current.organizationId !== value.organizationId ||
          current.principalRef !== value.principalRef ||
          current.createdAt !== value.createdAt)
      ) {
        throw new Error('Immutable case membership identity changed.');
      }
      commit({
        ...state,
        caseMemberships: replace(
          state.caseMemberships,
          value,
          (x) => x.caseMembershipId,
        ),
      });
      return value;
    },
    async putCaseMembershipAtRevision(input, nextCaseInput) {
      const value = EvidenceCaseMembershipSchema.parse(input);
      const nextCase = EvidenceCaseSchema.parse(nextCaseInput);
      const currentCase = state.cases.find(
        (item) => item.caseId === value.caseId,
      );
      if (
        currentCase === undefined ||
        nextCase.caseId !== currentCase.caseId ||
        nextCase.organizationId !== currentCase.organizationId ||
        nextCase.workspaceId !== currentCase.workspaceId ||
        nextCase.createdAt !== currentCase.createdAt ||
        nextCase.createdByPrincipalRef !== currentCase.createdByPrincipalRef ||
        nextCase.revision !== currentCase.revision + 1 ||
        value.organizationId !== currentCase.organizationId
      )
        throw new Error('Case membership revision transaction was refused.');
      const currentMembership = state.caseMemberships.find(
        (item) => item.caseMembershipId === value.caseMembershipId,
      );
      const collision = state.caseMemberships.find(
        (item) =>
          item.caseId === value.caseId &&
          item.principalRef === value.principalRef &&
          item.caseMembershipId !== value.caseMembershipId,
      );
      if (
        collision !== undefined ||
        (currentMembership !== undefined &&
          (currentMembership.caseId !== value.caseId ||
            currentMembership.organizationId !== value.organizationId ||
            currentMembership.principalRef !== value.principalRef ||
            currentMembership.createdAt !== value.createdAt))
      )
        throw new Error('Immutable case membership identity changed.');
      commit({
        ...state,
        cases: replace(state.cases, nextCase, (item) => item.caseId),
        caseMemberships: replace(
          state.caseMemberships,
          value,
          (item) => item.caseMembershipId,
        ),
      });
      return value;
    },
    async putSession(input) {
      const value = EvidenceProductSessionSchema.parse(input);
      const current = state.sessions.find(
        (item) => item.sessionId === value.sessionId,
      );
      if (
        current !== undefined &&
        (current.tokenDigest !== value.tokenDigest ||
          current.principalRef !== value.principalRef ||
          current.absoluteExpiresAt !== value.absoluteExpiresAt)
      ) {
        throw new Error('Immutable session identity changed.');
      }
      if (
        current !== undefined &&
        current.revokedAt !== null &&
        value.revokedAt === null
      ) {
        throw new Error('A revoked session cannot be restored.');
      }
      const collision = state.sessions.find(
        (item) =>
          item.tokenDigest === value.tokenDigest &&
          item.sessionId !== value.sessionId,
      );
      if (collision) throw new Error('Session token digest collision.');
      commit({
        ...state,
        sessions: replace(state.sessions, value, (x) => x.sessionId),
      });
      return value;
    },
  };
}
