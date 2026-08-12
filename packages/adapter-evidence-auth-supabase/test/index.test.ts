import { describe, expect, it } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';

import { createSupabaseEvidenceAuthenticator } from '../src/index.js';

describe('Supabase Evidence authenticator', () => {
  it('verifies ES256 issuer, audience, subject and session id through JWKS', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const publicJwk = {
      ...(await exportJWK(publicKey)),
      kid: 'key-1',
      alg: 'ES256',
      use: 'sig',
    };
    const accessToken = await new SignJWT({ session_id: 'upstream-session-1' })
      .setProtectedHeader({ alg: 'ES256', kid: 'key-1' })
      .setIssuer('https://supabase.example.test/auth/v1')
      .setAudience('authenticated')
      .setSubject('user-1')
      .setExpirationTime('10m')
      .sign(privateKey);
    const requests: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith('/.well-known/jwks.json')) {
        return Response.json({ keys: [publicJwk] });
      }
      if (url.includes('/token?grant_type=password')) {
        return Response.json({
          access_token: accessToken,
          refresh_token: 'refresh-1',
          expires_in: 600,
          user: { id: 'user-1', email: 'reviewer@example.invalid' },
        });
      }
      return new Response(null, { status: 404 });
    };
    const authenticator = createSupabaseEvidenceAuthenticator({
      baseUrl: 'https://supabase.example.test',
      publishableKey: 'publishable-test-key',
      fetch: fetcher,
      now: () => Date.parse('2026-08-12T00:00:00.000Z'),
    });
    await expect(
      authenticator.signIn({
        email: 'reviewer@example.invalid',
        password: 'password',
      }),
    ).resolves.toMatchObject({
      subject: 'user-1',
      sessionId: 'upstream-session-1',
      issuer: 'https://supabase.example.test/auth/v1',
      expiresAt: '2026-08-12T00:10:00.000Z',
    });
    expect(requests.some((url) => url.endsWith('/.well-known/jwks.json'))).toBe(
      true,
    );
  });

  it('fails closed for invalid claims, algorithm, subject and unknown keys', async () => {
    const es256 = await generateKeyPair('ES256');
    const es384 = await generateKeyPair('ES384');
    const jwk256 = {
      ...(await exportJWK(es256.publicKey)),
      kid: 'trusted-es256',
      alg: 'ES256',
      use: 'sig',
    };
    const jwk384 = {
      ...(await exportJWK(es384.publicKey)),
      kid: 'unapproved-es384',
      alg: 'ES384',
      use: 'sig',
    };
    const signed = async (input: {
      readonly algorithm?: 'ES256' | 'ES384';
      readonly audience?: string;
      readonly issuer?: string;
      readonly sessionId?: string;
      readonly includeExpiry?: boolean;
      readonly keyId?: string;
      readonly subject?: string;
    }) => {
      const algorithm = input.algorithm ?? 'ES256';
      let token = new SignJWT(
        input.sessionId === undefined ? {} : { session_id: input.sessionId },
      )
        .setProtectedHeader({
          alg: algorithm,
          kid:
            input.keyId ??
            (algorithm === 'ES256' ? 'trusted-es256' : 'unapproved-es384'),
        })
        .setIssuer(input.issuer ?? 'https://supabase.example.test/auth/v1')
        .setAudience(input.audience ?? 'authenticated')
        .setSubject(input.subject ?? 'user-1');
      if (input.includeExpiry !== false) token = token.setExpirationTime('10m');
      return token.sign(
        algorithm === 'ES256' ? es256.privateKey : es384.privateKey,
      );
    };
    const attempt = async (input: {
      readonly accessToken: string;
      readonly expectJwks?: boolean;
      readonly expiresIn?: number;
      readonly keys?: readonly object[];
      readonly responseSubject?: string;
    }) => {
      let jwksRequests = 0;
      const authenticator = createSupabaseEvidenceAuthenticator({
        baseUrl: 'https://supabase.example.test',
        issuer: 'https://supabase.example.test/auth/v1',
        publishableKey: 'publishable-test-key',
        fetch: async (request) => {
          const url = String(request);
          if (url.endsWith('/.well-known/jwks.json')) {
            jwksRequests += 1;
            return Response.json({ keys: input.keys ?? [jwk256] });
          }
          return Response.json({
            access_token: input.accessToken,
            refresh_token: 'refresh-test',
            expires_in: input.expiresIn ?? 600,
            user: {
              id: input.responseSubject ?? 'user-1',
              email: 'reviewer@example.invalid',
            },
          });
        },
      });
      await expect(
        authenticator.signIn({
          email: 'reviewer@example.invalid',
          password: 'test-password',
        }),
      ).rejects.toThrow();
      if (input.expectJwks !== false) expect(jwksRequests).toBeGreaterThan(0);
      expect(jwksRequests).toBeLessThanOrEqual(2);
    };

    await attempt({
      accessToken: await signed({
        sessionId: 'session-1',
        issuer: 'https://wrong-issuer.example.test/auth/v1',
      }),
    });
    await attempt({
      accessToken: await signed({
        sessionId: 'session-1',
        audience: 'wrong-audience',
      }),
    });
    await attempt({
      accessToken: await signed({ algorithm: 'ES384', sessionId: 'session-1' }),
      expectJwks: false,
      keys: [jwk384],
    });
    await attempt({
      accessToken: await signed({
        includeExpiry: false,
        sessionId: 'session-1',
      }),
    });
    await attempt({ accessToken: await signed({}) });
    await attempt({
      accessToken: await signed({ sessionId: 'session-1' }),
      responseSubject: 'different-user',
    });
    await attempt({
      accessToken: await signed({
        keyId: 'unknown-key',
        sessionId: 'session-1',
      }),
      keys: [],
    });
    await attempt({
      accessToken: await signed({ sessionId: 'session-1' }),
      expectJwks: false,
      expiresIn: 901,
    });
  });
});
