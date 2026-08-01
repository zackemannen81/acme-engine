import {
  createAes256GcmPayloadEncryptor,
  type PayloadEncryptor,
} from '@acme/core';

/** Fixed 32-byte key for offline tests. Never used for real provider payloads. */
export const TEST_PAYLOAD_ENCRYPTION_KEY = new Uint8Array(32).fill(0xac);

export const TEST_PAYLOAD_KEY_ID = 'acme-test-payload-key' as const;

/**
 * Deterministic AES-GCM encryptor for tests and local composition that need
 * `retention: 'encrypted-payload'` without env or KMS.
 */
export function createTestPayloadEncryptor(
  keyId: string = TEST_PAYLOAD_KEY_ID,
): PayloadEncryptor {
  return createAes256GcmPayloadEncryptor({
    key: TEST_PAYLOAD_ENCRYPTION_KEY,
    keyId,
  });
}
