import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { canonicalJson } from '@acme/core';

import {
  EvidenceArtifactObjectEnvelopeSchema,
  type EvidenceArtifactObjectEnvelope,
  type EvidenceArtifactRepresentation,
} from './schemas.js';
import type {
  EvidenceArtifactKeyProvider,
  EvidenceArtifactRandom,
  EvidenceArtifactWrappedKey,
} from './ports.js';

export const nodeArtifactRandom: EvidenceArtifactRandom = {
  bytes: (length) => randomBytes(length),
  opaqueId: (prefix) => `${prefix}-${randomBytes(18).toString('base64url')}`,
};

export function artifactSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function associatedData(value: EvidenceArtifactRepresentation): Uint8Array {
  return Buffer.from(
    canonicalJson({
      schemaVersion: 'evidence-artifact-aad/1',
      caseId: value.caseId,
      workspaceId: value.workspaceId,
      artifactVersionId: value.artifactVersionId,
      representationId: value.representationId,
      kind: value.kind,
      mediaType: value.mediaType,
      plaintextByteLength: value.plaintextByteLength,
      plaintextSha256: value.plaintextSha256,
    } as never),
    'utf8',
  );
}

export async function encryptArtifactRepresentation(input: {
  readonly representation: EvidenceArtifactRepresentation;
  readonly plaintext: Uint8Array;
  readonly objectKey: string;
  readonly activatedAt: string;
  readonly keyProvider: EvidenceArtifactKeyProvider;
  readonly random?: EvidenceArtifactRandom;
}): Promise<{
  readonly ciphertext: Uint8Array;
  readonly envelope: EvidenceArtifactObjectEnvelope;
}> {
  const random = input.random ?? nodeArtifactRandom;
  if (
    input.plaintext.byteLength !== input.representation.plaintextByteLength ||
    artifactSha256(input.plaintext) !== input.representation.plaintextSha256
  )
    throw new Error(
      'Artifact plaintext does not match representation metadata.',
    );
  const dek = random.bytes(32);
  const nonce = random.bytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, nonce);
  cipher.setAAD(associatedData(input.representation));
  const ciphertext = Buffer.concat([
    cipher.update(input.plaintext),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const wrapped = await input.keyProvider.wrapDek(dek);
  dek.fill(0);
  return {
    ciphertext,
    envelope: EvidenceArtifactObjectEnvelopeSchema.parse({
      schemaVersion: 'evidence-artifact-object-envelope/1',
      representationId: input.representation.representationId,
      caseId: input.representation.caseId,
      workspaceId: input.representation.workspaceId,
      objectKey: input.objectKey,
      algorithm: 'A256GCM',
      nonceBase64: Buffer.from(nonce).toString('base64'),
      authenticationTagBase64: tag.toString('base64'),
      wrappedDekBase64: Buffer.from(wrapped.wrappedDek).toString('base64'),
      wrapNonceBase64: Buffer.from(wrapped.wrapNonce).toString('base64'),
      keyId: wrapped.keyId,
      keyVersion: wrapped.keyVersion,
      ciphertextSha256: artifactSha256(ciphertext),
      ciphertextByteLength: ciphertext.byteLength,
      activatedAt: input.activatedAt,
    }),
  };
}

export async function decryptArtifactRepresentation(input: {
  readonly representation: EvidenceArtifactRepresentation;
  readonly envelope: EvidenceArtifactObjectEnvelope;
  readonly ciphertext: Uint8Array;
  readonly keyProvider: EvidenceArtifactKeyProvider;
}): Promise<Uint8Array> {
  const envelope = EvidenceArtifactObjectEnvelopeSchema.parse(input.envelope);
  if (
    envelope.representationId !== input.representation.representationId ||
    envelope.caseId !== input.representation.caseId ||
    envelope.workspaceId !== input.representation.workspaceId ||
    envelope.ciphertextByteLength !== input.ciphertext.byteLength ||
    envelope.ciphertextSha256 !== artifactSha256(input.ciphertext)
  )
    throw new Error(
      'Artifact ciphertext or scope does not match its envelope.',
    );
  const wrapped: EvidenceArtifactWrappedKey = {
    keyId: envelope.keyId,
    keyVersion: envelope.keyVersion,
    wrapNonce: Buffer.from(envelope.wrapNonceBase64, 'base64'),
    wrappedDek: Buffer.from(envelope.wrappedDekBase64, 'base64'),
  };
  const dek = await input.keyProvider.unwrapDek(wrapped);
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      dek,
      Buffer.from(envelope.nonceBase64, 'base64'),
    );
    decipher.setAAD(associatedData(input.representation));
    decipher.setAuthTag(
      Buffer.from(envelope.authenticationTagBase64, 'base64'),
    );
    const plaintext = Buffer.concat([
      decipher.update(input.ciphertext),
      decipher.final(),
    ]);
    if (
      plaintext.byteLength !== input.representation.plaintextByteLength ||
      artifactSha256(plaintext) !== input.representation.plaintextSha256
    )
      throw new Error('Artifact plaintext integrity verification failed.');
    return plaintext;
  } finally {
    dek.fill(0);
  }
}

/**
 * Recreates the exact staged ciphertext after a crash between metadata staging
 * and exclusive object creation. The staged envelope is authenticated by the
 * wrapped DEK, nonce, AAD and pinned ciphertext digest; no new identity or key
 * material is introduced on retry.
 */
export async function recreateStagedArtifactCiphertext(input: {
  readonly representation: EvidenceArtifactRepresentation;
  readonly envelope: EvidenceArtifactObjectEnvelope;
  readonly plaintext: Uint8Array;
  readonly keyProvider: EvidenceArtifactKeyProvider;
}): Promise<Uint8Array> {
  const envelope = EvidenceArtifactObjectEnvelopeSchema.parse(input.envelope);
  if (
    envelope.representationId !== input.representation.representationId ||
    envelope.caseId !== input.representation.caseId ||
    envelope.workspaceId !== input.representation.workspaceId ||
    input.plaintext.byteLength !== input.representation.plaintextByteLength ||
    artifactSha256(input.plaintext) !== input.representation.plaintextSha256
  )
    throw new Error('Artifact retry does not match staged metadata.');
  const dek = await input.keyProvider.unwrapDek({
    keyId: envelope.keyId,
    keyVersion: envelope.keyVersion,
    wrapNonce: Buffer.from(envelope.wrapNonceBase64, 'base64'),
    wrappedDek: Buffer.from(envelope.wrappedDekBase64, 'base64'),
  });
  try {
    const cipher = createCipheriv(
      'aes-256-gcm',
      dek,
      Buffer.from(envelope.nonceBase64, 'base64'),
    );
    cipher.setAAD(associatedData(input.representation));
    const ciphertext = Buffer.concat([
      cipher.update(input.plaintext),
      cipher.final(),
    ]);
    if (
      cipher.getAuthTag().toString('base64') !==
        envelope.authenticationTagBase64 ||
      ciphertext.byteLength !== envelope.ciphertextByteLength ||
      artifactSha256(ciphertext) !== envelope.ciphertextSha256
    )
      throw new Error(
        'Artifact retry ciphertext does not match staged envelope.',
      );
    return ciphertext;
  } finally {
    dek.fill(0);
  }
}

export async function rewrapArtifactEnvelope(input: {
  readonly envelope: EvidenceArtifactObjectEnvelope;
  readonly keyProvider: EvidenceArtifactKeyProvider;
}): Promise<EvidenceArtifactObjectEnvelope> {
  const current = EvidenceArtifactObjectEnvelopeSchema.parse(input.envelope);
  const dek = await input.keyProvider.unwrapDek({
    keyId: current.keyId,
    keyVersion: current.keyVersion,
    wrapNonce: Buffer.from(current.wrapNonceBase64, 'base64'),
    wrappedDek: Buffer.from(current.wrappedDekBase64, 'base64'),
  });
  try {
    const wrapped = await input.keyProvider.wrapDek(dek);
    return EvidenceArtifactObjectEnvelopeSchema.parse({
      ...current,
      keyId: wrapped.keyId,
      keyVersion: wrapped.keyVersion,
      wrapNonceBase64: Buffer.from(wrapped.wrapNonce).toString('base64'),
      wrappedDekBase64: Buffer.from(wrapped.wrappedDek).toString('base64'),
    });
  } finally {
    dek.fill(0);
  }
}
