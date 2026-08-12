import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type {
  EvidenceArtifactKeyProvider,
  EvidenceArtifactWrappedKey,
} from './ports.js';

export interface EvidenceArtifactKek {
  readonly keyId: string;
  readonly keyVersion: number;
  readonly key: Uint8Array;
}

export function createEvidenceArtifactKeyring(input: {
  readonly activeKeyId: string;
  readonly activeKeyVersion: number;
  readonly keys: readonly EvidenceArtifactKek[];
  readonly nonce?: () => Uint8Array;
}): EvidenceArtifactKeyProvider {
  const keys = input.keys.map((item) => ({
    ...item,
    key: Buffer.from(item.key),
  }));
  const find = (keyId: string, keyVersion: number) =>
    keys.find((item) => item.keyId === keyId && item.keyVersion === keyVersion);
  const active = find(input.activeKeyId, input.activeKeyVersion);
  if (active === undefined)
    throw new Error('Active artifact KEK is unavailable.');
  for (const item of keys)
    if (item.key.byteLength !== 32)
      throw new Error('Artifact KEKs must contain exactly 32 bytes.');
  return {
    async activeKey() {
      return { keyId: active.keyId, keyVersion: active.keyVersion };
    },
    async hasKey(keyId, keyVersion) {
      return find(keyId, keyVersion) !== undefined;
    },
    async wrapDek(dek) {
      if (dek.byteLength !== 32)
        throw new Error('Artifact DEK must be 32 bytes.');
      const nonce = input.nonce?.() ?? randomBytes(12);
      if (nonce.byteLength !== 12)
        throw new Error('KEK nonce must be 12 bytes.');
      const cipher = createCipheriv('aes-256-gcm', active.key, nonce);
      const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
      return {
        keyId: active.keyId,
        keyVersion: active.keyVersion,
        wrapNonce: nonce,
        wrappedDek: Buffer.concat([encrypted, cipher.getAuthTag()]),
      };
    },
    async unwrapDek(value: EvidenceArtifactWrappedKey) {
      const key = find(value.keyId, value.keyVersion);
      if (key === undefined) throw new Error('Artifact KEK is unavailable.');
      if (value.wrappedDek.byteLength < 17)
        throw new Error('Wrapped artifact DEK is invalid.');
      const encrypted = value.wrappedDek.subarray(0, -16);
      const tag = value.wrappedDek.subarray(-16);
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key.key,
        value.wrapNonce,
      );
      decipher.setAuthTag(tag);
      const dek = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      if (dek.byteLength !== 32)
        throw new Error('Unwrapped artifact DEK is invalid.');
      return dek;
    },
  };
}

export async function loadEvidenceArtifactKeyringFromFiles(input: {
  readonly activeKeyId: string;
  readonly activeKeyVersion: number;
  readonly files: readonly {
    readonly keyId: string;
    readonly keyVersion: number;
    readonly path: string;
  }[];
}): Promise<EvidenceArtifactKeyProvider> {
  const keys = await Promise.all(
    input.files.map(async (item) => {
      const encoded = (await readFile(item.path, 'utf8')).trim();
      const key = Buffer.from(encoded, 'base64');
      if (key.byteLength !== 32)
        throw new Error(`Artifact KEK file ${item.path} is not 32 bytes.`);
      return { keyId: item.keyId, keyVersion: item.keyVersion, key };
    }),
  );
  return createEvidenceArtifactKeyring({
    activeKeyId: input.activeKeyId,
    activeKeyVersion: input.activeKeyVersion,
    keys,
  });
}
