import type {
  EvidenceIdentitySnapshot,
  EvidenceCase,
  EvidenceCaseMembership,
  EvidenceOrganization,
  EvidenceOrganizationMembership,
  EvidencePrincipalProfile,
  EvidenceProductSession,
  EvidenceWorkspaceOrganizationBinding,
} from './schemas.js';

export interface EvidenceIdentityRepository {
  snapshot(): Promise<EvidenceIdentitySnapshot>;
  putOrganization(value: EvidenceOrganization): Promise<EvidenceOrganization>;
  putPrincipal(
    value: EvidencePrincipalProfile,
  ): Promise<EvidencePrincipalProfile>;
  putMembership(
    value: EvidenceOrganizationMembership,
  ): Promise<EvidenceOrganizationMembership>;
  putWorkspaceBinding(
    value: EvidenceWorkspaceOrganizationBinding,
  ): Promise<EvidenceWorkspaceOrganizationBinding>;
  putCase(value: EvidenceCase): Promise<EvidenceCase>;
  putCaseMembership(
    value: EvidenceCaseMembership,
  ): Promise<EvidenceCaseMembership>;
  putCaseMembershipAtRevision(
    value: EvidenceCaseMembership,
    nextCase: EvidenceCase,
  ): Promise<EvidenceCaseMembership>;
  putSession(value: EvidenceProductSession): Promise<EvidenceProductSession>;
}

export interface EvidenceUpstreamSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
  readonly issuer: string;
  readonly subject: string;
  readonly sessionId: string;
  readonly displayLabel: string;
}

export interface EvidenceCredentialAuthenticator {
  signIn(input: {
    readonly email: string;
    readonly password: string;
  }): Promise<EvidenceUpstreamSession>;
  refresh(refreshToken: string): Promise<EvidenceUpstreamSession>;
  signOut(accessToken: string): Promise<void>;
}

export interface EvidenceAuthClock {
  now(): string;
}

export interface EvidenceAuthSecrets {
  nextToken(kind: 'session' | 'csrf'): string;
}
