import { describe, expect, it } from 'vitest';

import {
  createAes256GcmPayloadEncryptor,
  parseProtectedPayloadEnvelope,
  revealModelCallResponse,
  applyModelCallRetention,
  type NormalizedModelResponse,
} from '../src/index.js';

const key = new Uint8Array(32).fill(7);
const otherKey = new Uint8Array(32).fill(9);

const response: NormalizedModelResponse = Object.freeze({
  provider: 'fixture',
  model: 'fixture-model',
  receivedAt: '2026-08-01T00:00:00.000Z',
  finishReason: 'stop' as const,
  text: '{"ok":true}',
  usage: Object.freeze({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }),
  metadata: Object.freeze({}),
});

describe('createAes256GcmPayloadEncryptor', () => {
  it('round-trips plaintext and is non-deterministic at the iv', () => {
    const encryptor = createAes256GcmPayloadEncryptor({
      key,
      keyId: 'test-key-1',
    });
    const first = encryptor.encrypt(response as never);
    const second = encryptor.encrypt(response as never);
    expect(first.keyId).toBe('test-key-1');
    expect(first.algorithm).toBe('aes-256-gcm');
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(encryptor.decrypt(first)).toEqual(response);
    expect(encryptor.decrypt(second)).toEqual(response);
  });

  it('returns null for a foreign keyId or wrong key', () => {
    const encryptor = createAes256GcmPayloadEncryptor({
      key,
      keyId: 'test-key-1',
    });
    const envelope = encryptor.encrypt({ secret: true });
    const other = createAes256GcmPayloadEncryptor({
      key: otherKey,
      keyId: 'test-key-1',
    });
    expect(other.decrypt(envelope)).toBeNull();
    expect(
      encryptor.decrypt({
        ...envelope,
        keyId: 'other',
      }),
    ).toBeNull();
  });

  it('rejects a non-32-byte key', () => {
    expect(() =>
      createAes256GcmPayloadEncryptor({
        key: new Uint8Array(16),
        keyId: 'short',
      }),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );
  });
});

describe('applyModelCallRetention', () => {
  it('drops plaintext for hash-only and none but keeps content-free metadata', () => {
    const expected = {
      responseHash: 'rh',
      callMetadata: {
        provider: 'fixture',
        model: 'fixture-model',
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      },
    };
    for (const retention of ['hash-only', 'none'] as const) {
      const retained = applyModelCallRetention({
        retention,
        completed: { response, responseHash: 'rh' },
      });
      // No plaintext rests, but what the call cost stays measurable.
      expect(retained).toEqual(expected);
      expect(retained.response).toBeUndefined();
      expect(retained.protectedResponse).toBeUndefined();
      expect(JSON.stringify(retained)).not.toContain('"ok"');
    }
  });

  it('requires an encryptor for encrypted-payload and seals cleartext', () => {
    expect(() =>
      applyModelCallRetention({
        retention: 'encrypted-payload',
        completed: { response, responseHash: 'rh' },
      }),
    ).toThrowError(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'INVALID_REQUEST' }),
      }),
    );

    const encryptor = createAes256GcmPayloadEncryptor({
      key,
      keyId: 'test-key-1',
    });
    const retained = applyModelCallRetention({
      retention: 'encrypted-payload',
      completed: { response, responseHash: 'rh' },
      payloadEncryptor: encryptor,
    });
    expect(retained.response).toBeUndefined();
    expect(retained.responseHash).toBe('rh');
    expect(retained.protectedResponse).toEqual(expect.any(String));
    const envelope = parseProtectedPayloadEnvelope(
      retained.protectedResponse as string,
    );
    expect(envelope.ciphertext.length).toBeGreaterThan(0);
    expect(JSON.stringify(retained)).not.toContain('{"ok":true}');
  });
});

describe('revealModelCallResponse', () => {
  it('returns stored cleartext when present', () => {
    expect(
      revealModelCallResponse({
        call: { response },
      }),
    ).toEqual(response);
  });

  it('decrypts a sealed envelope when the key works', () => {
    const encryptor = createAes256GcmPayloadEncryptor({
      key,
      keyId: 'test-key-1',
    });
    const retained = applyModelCallRetention({
      retention: 'encrypted-payload',
      completed: { response, responseHash: 'rh' },
      payloadEncryptor: encryptor,
    });
    expect(retained.protectedResponse).toEqual(expect.any(String));
    expect(
      revealModelCallResponse({
        call: { protectedResponse: retained.protectedResponse as string },
        payloadEncryptor: encryptor,
      }),
    ).toEqual(response);
  });

  it('returns undefined when the key is wrong or missing', () => {
    const encryptor = createAes256GcmPayloadEncryptor({
      key,
      keyId: 'test-key-1',
    });
    const retained = applyModelCallRetention({
      retention: 'encrypted-payload',
      completed: { response, responseHash: 'rh' },
      payloadEncryptor: encryptor,
    });
    const sealed = retained.protectedResponse as string;
    const other = createAes256GcmPayloadEncryptor({
      key: otherKey,
      keyId: 'test-key-1',
    });
    expect(
      revealModelCallResponse({
        call: { protectedResponse: sealed },
        payloadEncryptor: other,
      }),
    ).toBeUndefined();
    expect(
      revealModelCallResponse({
        call: { protectedResponse: sealed },
      }),
    ).toBeUndefined();
  });
});
