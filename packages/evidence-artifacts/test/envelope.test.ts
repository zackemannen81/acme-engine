import { describe, expect, it } from 'vitest';

import {
  EvidenceArtifactRepresentationSchema,
  createEvidenceArtifactKeyring,
  decryptArtifactRepresentation,
  encryptArtifactRepresentation,
  rewrapArtifactEnvelope,
} from '../src/index.js';

const representation = EvidenceArtifactRepresentationSchema.parse({
  schemaVersion: 'evidence-artifact-representation/1',
  representationId: 'representation-1',
  caseId: 'case-1',
  workspaceId: 'workspace-1',
  artifactVersionId: 'artifact-1',
  kind: 'canonical-text',
  mediaType: 'text/plain; charset=utf-8',
  plaintextSha256:
    'a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447',
  plaintextByteLength: 12,
  predecessorRepresentationId: null,
  transformationContract: 'canonical/1',
  transformationVersion: '1',
  producingCommandKey: 'command-1',
  producingPrincipalRef: 'principal-1',
  createdAt: '2026-08-12T00:00:00.000Z',
});

describe('artifact envelope encryption', () => {
  it('pins deterministic ciphertext and refuses tamper, changed AAD and wrong keys', async () => {
    const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const provider = createEvidenceArtifactKeyring({
      activeKeyId: 'kek-main',
      activeKeyVersion: 1,
      keys: [{ keyId: 'kek-main', keyVersion: 1, key }],
      nonce: () => new Uint8Array(12).fill(9),
    });
    let call = 0;
    const encrypted = await encryptArtifactRepresentation({
      representation,
      plaintext: Buffer.from('hello world\n'),
      objectKey: 'cases/object-1',
      activatedAt: '2026-08-12T00:00:00.000Z',
      keyProvider: provider,
      random: {
        bytes: (length) => new Uint8Array(length).fill(call++ === 0 ? 7 : 8),
        opaqueId: () => 'unused',
      },
    });
    expect(Buffer.from(encrypted.ciphertext).toString('hex')).toBe(
      '542532f2981b9192ac521077',
    );
    await expect(
      decryptArtifactRepresentation({
        representation,
        envelope: encrypted.envelope,
        ciphertext: encrypted.ciphertext,
        keyProvider: provider,
      }),
    ).resolves.toEqual(Buffer.from('hello world\n'));
    const tampered = Uint8Array.from(encrypted.ciphertext);
    tampered[0] = (tampered[0] ?? 0) ^ 1;
    await expect(
      decryptArtifactRepresentation({
        representation,
        envelope: encrypted.envelope,
        ciphertext: tampered,
        keyProvider: provider,
      }),
    ).rejects.toThrow('ciphertext');
    await expect(
      decryptArtifactRepresentation({
        representation: { ...representation, caseId: 'case-2' },
        envelope: encrypted.envelope,
        ciphertext: encrypted.ciphertext,
        keyProvider: provider,
      }),
    ).rejects.toThrow('scope');
    await expect(
      decryptArtifactRepresentation({
        representation: {
          ...representation,
          mediaType: 'text/changed',
        },
        envelope: encrypted.envelope,
        ciphertext: encrypted.ciphertext,
        keyProvider: provider,
      }),
    ).rejects.toThrow();
    await expect(
      decryptArtifactRepresentation({
        representation,
        envelope: {
          ...encrypted.envelope,
          nonceBase64: Buffer.alloc(12, 3).toString('base64'),
        },
        ciphertext: encrypted.ciphertext,
        keyProvider: provider,
      }),
    ).rejects.toThrow();
    const wrong = createEvidenceArtifactKeyring({
      activeKeyId: 'kek-main',
      activeKeyVersion: 1,
      keys: [
        { keyId: 'kek-main', keyVersion: 1, key: new Uint8Array(32).fill(4) },
      ],
    });
    await expect(
      decryptArtifactRepresentation({
        representation,
        envelope: encrypted.envelope,
        ciphertext: encrypted.ciphertext,
        keyProvider: wrong,
      }),
    ).rejects.toThrow();

    const rotated = createEvidenceArtifactKeyring({
      activeKeyId: 'kek-main',
      activeKeyVersion: 2,
      keys: [
        { keyId: 'kek-main', keyVersion: 1, key },
        { keyId: 'kek-main', keyVersion: 2, key: new Uint8Array(32).fill(5) },
      ],
      nonce: () => new Uint8Array(12).fill(6),
    });
    const next = await rewrapArtifactEnvelope({
      envelope: encrypted.envelope,
      keyProvider: rotated,
    });
    expect(next.keyVersion).toBe(2);
    expect(next.ciphertextSha256).toBe(encrypted.envelope.ciphertextSha256);
    await expect(
      decryptArtifactRepresentation({
        representation,
        envelope: next,
        ciphertext: encrypted.ciphertext,
        keyProvider: rotated,
      }),
    ).resolves.toEqual(Buffer.from('hello world\n'));
  });
});
