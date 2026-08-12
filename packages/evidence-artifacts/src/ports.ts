export interface EvidenceArtifactObjectStat {
  readonly objectKey: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface EvidenceArtifactObjectStore {
  create(
    objectKey: string,
    bytes: Uint8Array,
  ): Promise<EvidenceArtifactObjectStat>;
  stat(objectKey: string): Promise<EvidenceArtifactObjectStat | null>;
  read(objectKey: string, maximumBytes: number): Promise<Uint8Array>;
  delete(objectKey: string): Promise<void>;
  list(
    prefix: string,
    limit: number,
  ): Promise<readonly EvidenceArtifactObjectStat[]>;
}

export interface EvidenceArtifactWrappedKey {
  readonly keyId: string;
  readonly keyVersion: number;
  readonly wrapNonce: Uint8Array;
  readonly wrappedDek: Uint8Array;
}

export interface EvidenceArtifactKeyProvider {
  activeKey(): Promise<{ readonly keyId: string; readonly keyVersion: number }>;
  wrapDek(dek: Uint8Array): Promise<EvidenceArtifactWrappedKey>;
  unwrapDek(value: EvidenceArtifactWrappedKey): Promise<Uint8Array>;
  hasKey(keyId: string, keyVersion: number): Promise<boolean>;
}

export interface EvidenceArtifactRandom {
  bytes(length: number): Uint8Array;
  opaqueId(prefix: string): string;
}
