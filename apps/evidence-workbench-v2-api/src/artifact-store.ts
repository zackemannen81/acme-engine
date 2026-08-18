import {
  artifactSha256,
  decryptArtifactRepresentation,
  encryptArtifactRepresentation,
  nodeArtifactRandom,
  type EvidenceArtifactKeyProvider,
  type EvidenceArtifactObjectEnvelope,
  type EvidenceArtifactObjectStore,
  type EvidenceArtifactRepresentation,
} from '@acme/evidence-artifacts';

/**
 * Canonical text at rest.
 *
 * The V2 application stores an artifact's text exactly the way the shared
 * artifact foundation does: one AES-256-GCM envelope per representation, the
 * data key wrapped by a versioned KEK, and only ciphertext in the object
 * store. ADR-0037 is reused here, not re-decided.
 */
export interface EvidenceV2StoredText {
  readonly representation: EvidenceArtifactRepresentation;
  readonly envelope: EvidenceArtifactObjectEnvelope;
  readonly objectKey: string;
  readonly canonicalSha256: string;
  readonly canonicalByteLength: number;
}

export interface EvidenceV2StoredBytes {
  readonly representation: EvidenceArtifactRepresentation;
  readonly envelope: EvidenceArtifactObjectEnvelope;
  readonly objectKey: string;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface EvidenceV2TextStore {
  put(input: {
    readonly caseId: string;
    readonly artifactId: string;
    readonly text: string;
    readonly commandKey: string;
    readonly now: string;
  }): Promise<EvidenceV2StoredText>;
  putBytes(input: {
    readonly caseId: string;
    readonly artifactId: string;
    readonly bytes: Uint8Array;
    readonly kind: 'original';
    readonly mediaType: 'application/pdf';
    readonly commandKey: string;
    readonly now: string;
    readonly principalRef: string;
  }): Promise<EvidenceV2StoredBytes>;
  get(stored: EvidenceV2StoredText): Promise<string>;
}

export function createEvidenceV2TextStore(options: {
  readonly objectStore: EvidenceArtifactObjectStore;
  readonly keyProvider: EvidenceArtifactKeyProvider;
  readonly maximumBytes?: number;
}): EvidenceV2TextStore {
  const maximumBytes = options.maximumBytes ?? 64 * 1024 * 1024;

  return {
    async put(input) {
      const plaintext = Buffer.from(input.text, 'utf8');
      const objectKey = `v2/${input.caseId}/${input.artifactId}/canonical-text`;
      const representation: EvidenceArtifactRepresentation = {
        schemaVersion: 'evidence-artifact-representation/1',
        representationId: `${input.artifactId}-canonical`,
        caseId: input.caseId,
        // The V2 model has no workspace object. The case is the boundary, and
        // the shared schema's workspace field carries it unchanged.
        workspaceId: input.caseId,
        artifactVersionId: input.artifactId,
        kind: 'canonical-text',
        mediaType: 'text/plain; charset=utf-8',
        plaintextSha256: artifactSha256(plaintext),
        plaintextByteLength: plaintext.byteLength,
        predecessorRepresentationId: null,
        transformationContract: 'evidence-v2-canonical-text',
        transformationVersion: '1',
        producingCommandKey: input.commandKey,
        producingPrincipalRef: 'local-operator',
        createdAt: input.now,
      };

      const sealed = await encryptArtifactRepresentation({
        plaintext,
        representation,
        objectKey,
        keyProvider: options.keyProvider,
        activatedAt: input.now,
        random: nodeArtifactRandom,
      });
      await options.objectStore.create(objectKey, sealed.ciphertext);

      return {
        representation,
        envelope: sealed.envelope,
        objectKey,
        canonicalSha256: representation.plaintextSha256,
        canonicalByteLength: representation.plaintextByteLength,
      };
    },

    async putBytes(input) {
      const plaintext = Buffer.from(input.bytes);
      const objectKey = `v2/${input.caseId}/${input.artifactId}/received`;
      const representation: EvidenceArtifactRepresentation = {
        schemaVersion: 'evidence-artifact-representation/1',
        representationId: `${input.artifactId}-received`,
        caseId: input.caseId,
        workspaceId: input.caseId,
        artifactVersionId: input.artifactId,
        kind: input.kind,
        mediaType: input.mediaType,
        plaintextSha256: artifactSha256(plaintext),
        plaintextByteLength: plaintext.byteLength,
        predecessorRepresentationId: null,
        transformationContract: 'evidence-v2-received-pdf',
        transformationVersion: '1',
        producingCommandKey: input.commandKey,
        producingPrincipalRef: input.principalRef,
        createdAt: input.now,
      };
      const sealed = await encryptArtifactRepresentation({
        plaintext,
        representation,
        objectKey,
        keyProvider: options.keyProvider,
        activatedAt: input.now,
        random: nodeArtifactRandom,
      });
      await options.objectStore.create(objectKey, sealed.ciphertext);
      return {
        representation,
        envelope: sealed.envelope,
        objectKey,
        sha256: representation.plaintextSha256,
        byteLength: representation.plaintextByteLength,
      };
    },

    async get(stored) {
      const ciphertext = await options.objectStore.read(
        stored.objectKey,
        maximumBytes,
      );
      const plaintext = await decryptArtifactRepresentation({
        representation: stored.representation,
        envelope: stored.envelope,
        ciphertext,
        keyProvider: options.keyProvider,
      });
      return Buffer.from(plaintext).toString('utf8');
    },
  };
}
