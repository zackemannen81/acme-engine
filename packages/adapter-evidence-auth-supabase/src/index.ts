import type {
  EvidenceCredentialAuthenticator,
  EvidenceUpstreamSession,
} from '@acme/evidence-auth';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';

interface SupabaseTokenResponse {
  readonly access_token?: unknown;
  readonly refresh_token?: unknown;
  readonly expires_in?: unknown;
  readonly user?: { readonly id?: unknown; readonly email?: unknown };
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`Supabase Auth response missing ${name}.`);
  return value;
}

export function createSupabaseEvidenceAuthenticator(options: {
  readonly baseUrl: string;
  readonly issuer?: string;
  readonly publishableKey: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly now?: () => number;
}): EvidenceCredentialAuthenticator {
  const fetcher = options.fetch ?? globalThis.fetch;
  const authUrl = new URL('/auth/v1/', options.baseUrl);
  const issuer = new URL(options.issuer ?? authUrl)
    .toString()
    .replace(/\/$/u, '');
  const jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', authUrl), {
    [customFetch]: fetcher,
  });
  const verify = async (accessToken: string) => {
    const result = await jwtVerify(accessToken, jwks, {
      issuer,
      audience: 'authenticated',
      algorithms: ['ES256'],
      requiredClaims: ['exp', 'sub', 'session_id'],
    });
    return {
      subject: requiredString(result.payload.sub, 'JWT sub'),
      sessionId: requiredString(result.payload['session_id'], 'JWT session_id'),
    };
  };
  const token = async (
    grant: 'password' | 'refresh_token',
    input: Record<string, string>,
  ): Promise<EvidenceUpstreamSession> => {
    const response = await fetcher(
      new URL(`token?grant_type=${grant}`, authUrl),
      {
        method: 'POST',
        headers: {
          apikey: options.publishableKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    );
    if (!response.ok)
      throw new Error('Supabase Auth refused the session request.');
    const value = (await response.json()) as SupabaseTokenResponse;
    const accessToken = requiredString(value.access_token, 'access_token');
    const refreshToken = requiredString(value.refresh_token, 'refresh_token');
    const seconds = value.expires_in;
    if (
      typeof seconds !== 'number' ||
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      seconds > 900
    ) {
      throw new Error(
        'Supabase access-token lifetime exceeds the 15 minute policy bound.',
      );
    }
    const claims = await verify(accessToken);
    const responseSubject = requiredString(
      value.user?.id ?? claims.subject,
      'user.id',
    );
    if (responseSubject !== claims.subject)
      throw new Error('Supabase token subject mismatch.');
    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(
        (options.now?.() ?? Date.now()) + seconds * 1_000,
      ).toISOString(),
      issuer,
      subject: claims.subject,
      sessionId: claims.sessionId,
      displayLabel: requiredString(
        value.user?.email ?? claims.subject,
        'user.email',
      ),
    };
  };
  return {
    signIn: (input) => token('password', input),
    refresh: (refreshToken) =>
      token('refresh_token', { refresh_token: refreshToken }),
    async signOut(accessToken) {
      const response = await fetcher(new URL('logout', authUrl), {
        method: 'POST',
        headers: {
          apikey: options.publishableKey,
          authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) throw new Error('Supabase Auth logout failed.');
    },
  };
}
