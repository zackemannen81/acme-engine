import type { IncomingMessage } from 'node:http';

import { nodeHashing, type PayloadEncryptor } from '@acme/core';
import {
  authorizeEvidenceCaseAction,
  createEvidenceSessionService,
  deriveEvidencePrincipalRef,
  EvidenceAuthenticationError,
  EvidenceAuthorizationError,
  type EvidenceCaseAuthorizationContext,
  type EvidenceCaseRole,
  type EvidenceCredentialAuthenticator,
  type EvidenceIdentityRepository,
  type EvidencePrincipalProfile,
  type EvidenceProductAction,
} from '@acme/evidence-auth';

/**
 * V2 authentication and authorization.
 *
 * Nothing here is a new model. ADR-0035 decided the principal, the BFF session
 * and deny-by-default authorization; ADR-0036 decided the case boundary; and
 * `@acme/evidence-auth` implements both. This module wires that machinery into
 * the V2 app and adds no policy of its own.
 *
 * The one property worth stating: a principal with no membership in a case
 * gets 404, not 403, so a stranger cannot learn that a case exists.
 */

export const EVIDENCE_V2_SESSION_COOKIE = 'acme_v2_session';
export const EVIDENCE_V2_CSRF_COOKIE = 'acme_v2_csrf';
export const EVIDENCE_V2_CSRF_HEADER = 'x-acme-csrf';

export interface EvidenceV2Account {
  readonly email: string;
  readonly subject: string;
  readonly displayLabel: string;
  readonly organizationRole: 'organization-admin' | 'reviewer' | 'viewer';
}

export interface EvidenceV2AuthOptions {
  readonly identity: EvidenceIdentityRepository;
  readonly authenticator: EvidenceCredentialAuthenticator;
  readonly protector: PayloadEncryptor;
  readonly issuer: string;
  readonly organizationId: string;
  readonly organizationLabel: string;
  readonly accounts: readonly EvidenceV2Account[];
  readonly now: () => string;
  readonly nextToken: (kind: 'session' | 'csrf') => string;
}

export interface EvidenceV2Auth {
  readonly identity: EvidenceIdentityRepository;
  bootstrap(): Promise<void>;
  login(input: { readonly email: string; readonly password: string }): Promise<{
    readonly rawToken: string;
    readonly csrfToken: string;
    readonly principal: EvidencePrincipalProfile;
  }>;
  logout(rawToken: string): Promise<void>;
  requirePrincipal(request: IncomingMessage): Promise<EvidencePrincipalProfile>;
  requireCase(input: {
    readonly principalRef: string;
    readonly caseId: string;
    readonly action: EvidenceProductAction;
  }): Promise<EvidenceCaseAuthorizationContext>;
  registerCase(input: {
    readonly caseId: string;
    readonly title: string;
    readonly caseReference: string;
    readonly principalRef: string;
    readonly role?: EvidenceCaseRole;
  }): Promise<void>;
  visibleCaseIds(principalRef: string): Promise<ReadonlySet<string>>;
}

export function cookieValue(
  request: IncomingMessage,
  name: string,
): string | null {
  const header = request.headers.cookie;
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function createEvidenceV2Auth(
  options: EvidenceV2AuthOptions,
): EvidenceV2Auth {
  const hashing = nodeHashing;
  const sessions = createEvidenceSessionService({
    repository: options.identity,
    authenticator: options.authenticator,
    clock: { now: options.now },
    secrets: { nextToken: options.nextToken },
    hashing,
    protector: options.protector,
  });

  const principalRefOf = (subject: string): string =>
    deriveEvidencePrincipalRef(hashing, options.issuer, subject);

  return {
    identity: options.identity,

    /**
     * Provision the organization and the configured principals.
     *
     * Sign-in refuses a principal that is not provisioned and one with no
     * active organization membership, so this runs before the first request
     * rather than lazily on demand.
     */
    async bootstrap() {
      const now = options.now();
      await options.identity.putOrganization({
        schemaVersion: 'evidence-organization/1',
        organizationId: options.organizationId,
        label: options.organizationLabel,
        createdAt: now,
      });
      for (const account of options.accounts) {
        const principalRef = principalRefOf(account.subject);
        await options.identity.putPrincipal({
          schemaVersion: 'evidence-principal-profile/1',
          principalRef,
          issuer: options.issuer,
          subject: account.subject,
          displayLabel: account.displayLabel,
          createdAt: now,
        });
        await options.identity.putMembership({
          schemaVersion: 'evidence-organization-membership/1',
          membershipId: `membership-${principalRef}`,
          organizationId: options.organizationId,
          principalRef,
          role: account.organizationRole,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
      }
    },

    async login(input) {
      const result = await sessions.login(input);
      return {
        rawToken: result.rawToken,
        csrfToken: result.csrfToken,
        principal: result.principal,
      };
    },

    async logout(rawToken) {
      await sessions.logout(rawToken);
    },

    async requirePrincipal(request) {
      const rawToken = cookieValue(request, EVIDENCE_V2_SESSION_COOKIE);
      if (rawToken === null) throw new EvidenceAuthenticationError();
      const method = request.method ?? 'GET';
      if (method === 'GET' || method === 'HEAD') {
        return (await sessions.resolve(rawToken)).principal;
      }
      const header = request.headers[EVIDENCE_V2_CSRF_HEADER];
      const fromHeader = typeof header === 'string' ? header : '';
      const fromCookie = cookieValue(request, EVIDENCE_V2_CSRF_COOKIE) ?? '';
      const csrf = fromHeader.length > 0 ? fromHeader : fromCookie;
      return (await sessions.resolve(rawToken, csrf)).principal;
    },

    async requireCase(input) {
      const snapshot = await options.identity.snapshot();
      return authorizeEvidenceCaseAction({
        snapshot,
        principalRef: input.principalRef,
        caseId: input.caseId,
        action: input.action,
        decidedAt: options.now(),
      });
    },

    async registerCase(input) {
      const now = options.now();
      await options.identity.putWorkspaceBinding({
        schemaVersion: 'evidence-workspace-organization-binding/1',
        // The V2 model has no workspace object; the case is the boundary and
        // carries its own identity into the shared schema's workspace field.
        workspaceId: input.caseId,
        organizationId: options.organizationId,
        boundAt: now,
      });
      await options.identity.putCase({
        schemaVersion: 'evidence-case/1',
        caseId: input.caseId,
        organizationId: options.organizationId,
        workspaceId: input.caseId,
        title: input.title,
        caseReference: input.caseReference,
        metadata: {},
        dataPolicy: 'synthetic-only',
        status: 'active',
        revision: 0,
        createdAt: now,
        updatedAt: now,
        createdByPrincipalRef: input.principalRef,
        updatedByPrincipalRef: input.principalRef,
      });
      await options.identity.putCaseMembership({
        schemaVersion: 'evidence-case-membership/1',
        caseMembershipId: `case-membership-${input.caseId}-${input.principalRef}`,
        caseId: input.caseId,
        organizationId: options.organizationId,
        principalRef: input.principalRef,
        role: input.role ?? 'case-admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
        updatedByPrincipalRef: input.principalRef,
      });
    },

    async visibleCaseIds(principalRef) {
      const snapshot = await options.identity.snapshot();
      return new Set(
        snapshot.caseMemberships
          .filter(
            (item) =>
              item.principalRef === principalRef && item.status === 'active',
          )
          .map((item) => item.caseId),
      );
    },
  };
}

export function isAuthenticationError(error: unknown): boolean {
  return error instanceof EvidenceAuthenticationError;
}

export function authorizationStatus(error: unknown): number | undefined {
  return error instanceof EvidenceAuthorizationError ? error.status : undefined;
}
