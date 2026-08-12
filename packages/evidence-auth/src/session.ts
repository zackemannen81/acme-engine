import {
  type Hashing,
  type JsonValue,
  type PayloadEncryptor,
} from '@acme/core';

import {
  EvidenceAuthenticationError,
  deriveEvidencePrincipalRef,
} from './policy.js';
import type {
  EvidenceAuthClock,
  EvidenceAuthSecrets,
  EvidenceCredentialAuthenticator,
  EvidenceIdentityRepository,
  EvidenceUpstreamSession,
} from './repository.js';
import {
  EvidencePrincipalProfileSchema,
  EvidenceProductSessionSchema,
  type EvidencePrincipalProfile,
  type EvidenceProductSession,
} from './schemas.js';

const IDLE_MS = 30 * 60 * 1_000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1_000;

function date(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid session timestamp.');
  return parsed;
}

function iso(value: number): string {
  return new Date(value).toISOString();
}

function upstreamJson(value: EvidenceUpstreamSession): JsonValue {
  return {
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    expiresAt: value.expiresAt,
    issuer: value.issuer,
    subject: value.subject,
    sessionId: value.sessionId,
    displayLabel: value.displayLabel,
  };
}

function parseUpstream(value: JsonValue | null): EvidenceUpstreamSession {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new EvidenceAuthenticationError('Session credentials unavailable.');
  }
  const record = value as Readonly<Record<string, JsonValue>>;
  const read = (key: string): string => {
    const item = record[key];
    if (typeof item !== 'string' || item.length === 0) {
      throw new EvidenceAuthenticationError('Session credentials unavailable.');
    }
    return item;
  };
  return {
    accessToken: read('accessToken'),
    refreshToken: read('refreshToken'),
    expiresAt: read('expiresAt'),
    issuer: read('issuer'),
    subject: read('subject'),
    sessionId: read('sessionId'),
    displayLabel: read('displayLabel'),
  };
}

export interface EvidenceResolvedSession {
  readonly record: EvidenceProductSession;
  readonly principal: EvidencePrincipalProfile;
}

export function createEvidenceSessionService(options: {
  readonly repository: EvidenceIdentityRepository;
  readonly authenticator: EvidenceCredentialAuthenticator;
  readonly clock: EvidenceAuthClock;
  readonly secrets: EvidenceAuthSecrets;
  readonly hashing: Hashing;
  readonly protector: PayloadEncryptor;
}) {
  const digest = (value: string) => options.hashing.sha256(value);

  const resolve = async (
    rawToken: string,
    csrfToken?: string,
  ): Promise<EvidenceResolvedSession> => {
    if (rawToken.length === 0) throw new EvidenceAuthenticationError();
    const now = date(options.clock.now());
    const snapshot = await options.repository.snapshot();
    let record = snapshot.sessions.find(
      (item) => item.tokenDigest === digest(rawToken),
    );
    if (
      record === undefined ||
      record.revokedAt !== null ||
      now >= date(record.idleExpiresAt) ||
      now >= date(record.absoluteExpiresAt)
    ) {
      throw new EvidenceAuthenticationError();
    }
    if (csrfToken !== undefined && digest(csrfToken) !== record.csrfDigest) {
      throw new EvidenceAuthenticationError('Invalid CSRF token.');
    }
    let upstream: EvidenceUpstreamSession;
    try {
      upstream = parseUpstream(
        options.protector.decrypt(record.protectedUpstreamSession),
      );
    } catch {
      throw new EvidenceAuthenticationError('Session credentials unavailable.');
    }
    if (now >= date(upstream.expiresAt)) {
      try {
        upstream = await options.authenticator.refresh(upstream.refreshToken);
      } catch {
        throw new EvidenceAuthenticationError('Session refresh failed.');
      }
      const expectedPrincipal = snapshot.principals.find(
        (item) => item.principalRef === record?.principalRef,
      );
      if (
        upstream.subject !== expectedPrincipal?.subject ||
        new URL(upstream.issuer).toString() !==
          new URL(expectedPrincipal.issuer).toString() ||
        upstream.sessionId !== record.upstreamSessionId
      ) {
        throw new EvidenceAuthenticationError(
          'Refreshed session identity changed.',
        );
      }
      if (now >= date(upstream.expiresAt)) {
        throw new EvidenceAuthenticationError(
          'Refreshed session is already expired.',
        );
      }
    }
    const absolute = date(record.absoluteExpiresAt);
    record = EvidenceProductSessionSchema.parse({
      ...record,
      protectedUpstreamSession: options.protector.encrypt(
        upstreamJson(upstream),
      ),
      lastSeenAt: options.clock.now(),
      idleExpiresAt: iso(Math.min(now + IDLE_MS, absolute)),
    });
    await options.repository.putSession(record);
    const principal = snapshot.principals.find(
      (item) => item.principalRef === record?.principalRef,
    );
    if (principal === undefined) throw new EvidenceAuthenticationError();
    return { record, principal };
  };

  return {
    async login(input: { readonly email: string; readonly password: string }) {
      let upstream: EvidenceUpstreamSession;
      try {
        upstream = await options.authenticator.signIn(input);
      } catch {
        throw new EvidenceAuthenticationError('Invalid credentials.');
      }
      const principalRef = deriveEvidencePrincipalRef(
        options.hashing,
        upstream.issuer,
        upstream.subject,
      );
      const snapshot = await options.repository.snapshot();
      const principal = snapshot.principals.find(
        (item) => item.principalRef === principalRef,
      );
      if (principal === undefined) {
        throw new EvidenceAuthenticationError('Principal is not provisioned.');
      }
      if (
        !snapshot.memberships.some(
          (item) =>
            item.principalRef === principalRef && item.status === 'active',
        )
      ) {
        throw new EvidenceAuthenticationError(
          'Principal has no active membership.',
        );
      }
      const rawToken = options.secrets.nextToken('session');
      const csrfToken = options.secrets.nextToken('csrf');
      const now = date(options.clock.now());
      const record = EvidenceProductSessionSchema.parse({
        schemaVersion: 'evidence-product-session/1',
        sessionId: `session_${digest(rawToken)}`,
        tokenDigest: digest(rawToken),
        csrfDigest: digest(csrfToken),
        principalRef,
        upstreamSessionId: upstream.sessionId,
        protectedUpstreamSession: options.protector.encrypt(
          upstreamJson(upstream),
        ),
        createdAt: options.clock.now(),
        lastSeenAt: options.clock.now(),
        idleExpiresAt: iso(now + IDLE_MS),
        absoluteExpiresAt: iso(now + ABSOLUTE_MS),
        revokedAt: null,
      });
      await options.repository.putSession(record);
      return { rawToken, csrfToken, record, principal };
    },
    resolve,
    async logout(rawToken: string): Promise<void> {
      const resolved = await resolve(rawToken);
      const upstream = parseUpstream(
        options.protector.decrypt(resolved.record.protectedUpstreamSession),
      );
      await options.repository.putSession(
        EvidenceProductSessionSchema.parse({
          ...resolved.record,
          revokedAt: options.clock.now(),
        }),
      );
      try {
        await options.authenticator.signOut(upstream.accessToken);
      } catch {
        // Local revocation is authoritative and must survive upstream failure.
      }
    },
    parsePrincipal(value: unknown) {
      return EvidencePrincipalProfileSchema.parse(value);
    },
  };
}

export type EvidenceSessionService = ReturnType<
  typeof createEvidenceSessionService
>;
