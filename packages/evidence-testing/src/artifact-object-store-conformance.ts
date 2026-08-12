import {
  artifactSha256,
  type EvidenceArtifactObjectStore,
} from '@acme/evidence-artifacts';
import { describe, expect, it } from 'vitest';

export interface EvidenceArtifactObjectStoreConformanceSubject {
  readonly store: EvidenceArtifactObjectStore;
  cleanup?(): void | Promise<void>;
}

export function evidenceArtifactObjectStoreConformance(
  name: string,
  createSubject: () =>
    | EvidenceArtifactObjectStoreConformanceSubject
    | Promise<EvidenceArtifactObjectStoreConformanceSubject>,
): void {
  describe(`${name} evidence artifact object store`, () => {
    it('creates exclusively, verifies metadata, reads, lists and deletes idempotently', async () => {
      const subject = await createSubject();
      try {
        const bytes = Buffer.from('encrypted-object');
        await expect(
          subject.store.create('cases/a/object-1', bytes),
        ).resolves.toEqual({
          objectKey: 'cases/a/object-1',
          byteLength: bytes.byteLength,
          sha256: artifactSha256(bytes),
        });
        await expect(
          subject.store.create('cases/a/object-1', bytes),
        ).rejects.toThrow();
        await expect(subject.store.stat('cases/a/object-1')).resolves.toEqual({
          objectKey: 'cases/a/object-1',
          byteLength: bytes.byteLength,
          sha256: artifactSha256(bytes),
        });
        await expect(
          subject.store.read('cases/a/object-1', bytes.byteLength),
        ).resolves.toEqual(
          expect.objectContaining({ byteLength: bytes.byteLength }),
        );
        await expect(subject.store.list('cases/a', 10)).resolves.toHaveLength(
          1,
        );
        await subject.store.delete('cases/a/object-1');
        await subject.store.delete('cases/a/object-1');
        await expect(
          subject.store.stat('cases/a/object-1'),
        ).resolves.toBeNull();
      } finally {
        await subject.cleanup?.();
      }
    });

    it('enforces key and read/list bounds', async () => {
      const subject = await createSubject();
      try {
        const bytes = Buffer.from('bounded');
        await subject.store.create('cases/a/object-2', bytes);
        await expect(
          subject.store.read('cases/a/object-2', bytes.byteLength - 1),
        ).rejects.toThrow('bound');
        await expect(
          Promise.resolve().then(() => subject.store.stat('../escape')),
        ).rejects.toThrow('invalid');
        await expect(
          Promise.resolve().then(() => subject.store.list('cases/a', 0)),
        ).rejects.toThrow('bound');
      } finally {
        await subject.cleanup?.();
      }
    });
  });
}
