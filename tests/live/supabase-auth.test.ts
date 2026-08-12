import { describe, expect, it } from 'vitest';

import { createSupabaseEvidenceAuthenticator } from '../../packages/adapter-evidence-auth-supabase/src/index.js';

describe('Supabase Auth live gate', () => {
  it('signs in, refreshes and logs out an explicitly provisioned test user', async () => {
    if (process.env['ACME_SUPABASE_AUTH_TEST'] !== '1') {
      throw new Error(
        'Refusing Supabase Auth integration: set ACME_SUPABASE_AUTH_TEST=1 explicitly.',
      );
    }
    const baseUrl = process.env['EVIDENCE_SUPABASE_URL'];
    const issuer = process.env['EVIDENCE_SUPABASE_ISSUER'];
    const publishableKey = process.env['EVIDENCE_SUPABASE_PUBLISHABLE_KEY'];
    const email = process.env['EVIDENCE_SUPABASE_TEST_EMAIL'];
    const password = process.env['EVIDENCE_SUPABASE_TEST_PASSWORD'];
    if (!baseUrl || !issuer || !publishableKey || !email || !password) {
      throw new Error(
        'Supabase Auth integration requires URL, publishable key and dedicated test credentials.',
      );
    }
    const authenticator = createSupabaseEvidenceAuthenticator({
      baseUrl,
      issuer,
      publishableKey,
    });
    const signedIn = await authenticator.signIn({ email, password });
    expect(signedIn.subject.length).toBeGreaterThan(0);
    expect(signedIn.sessionId.length).toBeGreaterThan(0);
    expect(signedIn.accessToken).not.toBe(signedIn.refreshToken);
    const refreshed = await authenticator.refresh(signedIn.refreshToken);
    expect(refreshed.subject).toBe(signedIn.subject);
    await expect(
      authenticator.signOut(refreshed.accessToken),
    ).resolves.toBeUndefined();
  });
});
