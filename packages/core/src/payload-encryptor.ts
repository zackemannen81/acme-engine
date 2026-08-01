import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { JsonValue } from './common.js';
import { AcmeError } from './errors.js';
import { canonicalJson, nodeHashing } from './hashing.js';
import type { NormalizedModelResponse } from './model.js';
import { validateNormalizedModelResponse } from './model-validation.js';

export const ACME_PAYLOAD_ENCRYPTION_ALGORITHM = 'aes-256-gcm' as const;
export const ACME_PAYLOAD_ENVELOPE_VERSION = 'acme-payload-envelope-1' as const;

/**
 * Ciphertext at rest for `retention: 'encrypted-payload'`.
 * Stored as canonical JSON in `ModelCallRecord.protectedResponse`.
 */
export interface ProtectedPayloadEnvelope {
  readonly v: typeof ACME_PAYLOAD_ENVELOPE_VERSION;
  readonly algorithm: typeof ACME_PAYLOAD_ENCRYPTION_ALGORITHM;
  readonly keyId: string;
  readonly iv: string;
  readonly authTag: string;
  readonly ciphertext: string;
}

/**
 * Composition-owned crypto. Core defines the port; adapters call it when
 * policy demands encryption. Implementations must not read environment or
 * key stores themselves—callers inject key material.
 */
export interface PayloadEncryptor {
  readonly keyId: string;
  encrypt(plaintext: JsonValue): ProtectedPayloadEnvelope;
  /**
   * Returns plaintext when this encryptor can open the envelope.
   * Returns `null` when the key is missing, `keyId` is unknown, or
   * authentication fails—never invents plaintext.
   */
  decrypt(envelope: ProtectedPayloadEnvelope): JsonValue | null;
}

export interface Aes256GcmPayloadEncryptorOptions {
  /** Exactly 32 bytes. */
  readonly key: Uint8Array;
  readonly keyId: string;
}

function invalid(message: string, details?: JsonValue): never {
  throw new AcmeError({
    code: 'INVALID_REQUEST',
    message,
    stage: 'preparing-commit',
    retryable: false,
    ...(details === undefined ? {} : { details }),
  });
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(value: string, label: string): Buffer {
  if (typeof value !== 'string' || value.length === 0) {
    invalid(`Protected payload ${label} must be a non-empty base64 string.`);
  }
  try {
    return Buffer.from(value, 'base64');
  } catch {
    invalid(`Protected payload ${label} is not valid base64.`);
  }
}

export function isProtectedPayloadEnvelope(
  value: unknown,
): value is ProtectedPayloadEnvelope {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.v === ACME_PAYLOAD_ENVELOPE_VERSION &&
    candidate.algorithm === ACME_PAYLOAD_ENCRYPTION_ALGORITHM &&
    typeof candidate.keyId === 'string' &&
    candidate.keyId.length > 0 &&
    typeof candidate.iv === 'string' &&
    typeof candidate.authTag === 'string' &&
    typeof candidate.ciphertext === 'string'
  );
}

export function parseProtectedPayloadEnvelope(
  protectedResponse: string,
): ProtectedPayloadEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(protectedResponse) as unknown;
  } catch {
    invalid('protectedResponse is not valid JSON.');
  }
  if (!isProtectedPayloadEnvelope(parsed)) {
    invalid('protectedResponse is not a recognized payload envelope.');
  }
  return parsed;
}

export function serializeProtectedPayloadEnvelope(
  envelope: ProtectedPayloadEnvelope,
): string {
  return nodeHashing.canonicalJson(envelope as unknown as JsonValue);
}

/**
 * Pure AES-256-GCM encryptor. Key material is supplied by the composition
 * root; this function never reads the environment.
 */
export function createAes256GcmPayloadEncryptor(
  options: Aes256GcmPayloadEncryptorOptions,
): PayloadEncryptor {
  if (!(options.key instanceof Uint8Array) || options.key.byteLength !== 32) {
    invalid('AES-256-GCM payload encryption requires a 32-byte key.');
  }
  if (typeof options.keyId !== 'string' || options.keyId.trim().length === 0) {
    invalid('AES-256-GCM payload encryption requires a non-empty keyId.');
  }
  const key = Buffer.from(options.key);
  const keyId = options.keyId;

  return Object.freeze({
    keyId,
    encrypt(plaintext: JsonValue): ProtectedPayloadEnvelope {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const body = Buffer.from(canonicalJson(plaintext), 'utf8');
      const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
      const authTag = cipher.getAuthTag();
      return Object.freeze({
        v: ACME_PAYLOAD_ENVELOPE_VERSION,
        algorithm: ACME_PAYLOAD_ENCRYPTION_ALGORITHM,
        keyId,
        iv: toBase64(iv),
        authTag: toBase64(authTag),
        ciphertext: toBase64(encrypted),
      });
    },
    decrypt(envelope: ProtectedPayloadEnvelope): JsonValue | null {
      if (!isProtectedPayloadEnvelope(envelope)) {
        return null;
      }
      if (envelope.keyId !== keyId) {
        return null;
      }
      try {
        const iv = fromBase64(envelope.iv, 'iv');
        const authTag = fromBase64(envelope.authTag, 'authTag');
        const ciphertext = fromBase64(envelope.ciphertext, 'ciphertext');
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
        return JSON.parse(decrypted.toString('utf8')) as JsonValue;
      } catch {
        return null;
      }
    },
  });
}

export interface ModelCallRetentionFields {
  readonly response?: NormalizedModelResponse;
  readonly responseHash: string;
  readonly protectedResponse?: string;
}

/**
 * Apply retention at the repository write boundary. Engine stays dumb:
 * plaintext arrives on `completed.response`; this decides what rests at rest.
 */
export function applyModelCallRetention(options: {
  readonly retention: 'none' | 'hash-only' | 'encrypted-payload';
  readonly completed: {
    readonly response: NormalizedModelResponse;
    readonly responseHash: string;
  };
  readonly payloadEncryptor?: PayloadEncryptor;
}): ModelCallRetentionFields {
  const { retention, completed, payloadEncryptor } = options;
  if (retention !== 'encrypted-payload') {
    return { responseHash: completed.responseHash };
  }
  if (payloadEncryptor === undefined) {
    invalid(
      "retention 'encrypted-payload' requires a PayloadEncryptor on the repository.",
      { retention },
    );
  }
  const envelope = payloadEncryptor.encrypt(
    completed.response as unknown as JsonValue,
  );
  return {
    responseHash: completed.responseHash,
    protectedResponse: serializeProtectedPayloadEnvelope(envelope),
  };
}

/**
 * Reveal plaintext for replay when an encryptor can open the envelope.
 * At-rest records keep `response` absent; this is only for read paths that
 * feed `replayVerify()`.
 */
export function revealModelCallResponse(options: {
  readonly call: {
    readonly response?: NormalizedModelResponse;
    readonly protectedResponse?: string;
  };
  readonly payloadEncryptor?: PayloadEncryptor;
}): NormalizedModelResponse | undefined {
  if (options.call.response !== undefined) {
    return options.call.response;
  }
  if (
    options.call.protectedResponse === undefined ||
    options.payloadEncryptor === undefined
  ) {
    return undefined;
  }
  let envelope: ProtectedPayloadEnvelope;
  try {
    envelope = parseProtectedPayloadEnvelope(options.call.protectedResponse);
  } catch {
    return undefined;
  }
  const plaintext = options.payloadEncryptor.decrypt(envelope);
  if (plaintext === null) {
    return undefined;
  }
  try {
    return validateNormalizedModelResponse(
      plaintext as unknown as NormalizedModelResponse,
    );
  } catch {
    return undefined;
  }
}
