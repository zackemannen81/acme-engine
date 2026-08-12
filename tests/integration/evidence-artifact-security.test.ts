import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createFileEvidenceArtifactObjectStore } from '../../packages/adapter-evidence-artifact-file/src/index.js';
import { createFileEvidenceProductRepository } from '../../packages/adapter-evidence-product-file/src/index.js';
import { createEvidenceArtifactKeyring } from '../../packages/evidence-artifacts/src/index.js';
import {
  EVIDENCE_ENCRYPTED_SOURCE_PLACEHOLDER,
  createEvidenceArtifactBackupManifest,
  createEvidenceArtifactService,
  verifyEvidenceArtifactRestore,
  type EvidenceProductRepository,
} from '../../packages/evidence-product-contracts/src/index.js';
import { developmentObserveArtifactInput } from '../../packages/evidence-testing/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

const directories: string[] = [];
const scope = {
  caseId: 'case-a',
  workspaceId: 'workspace-a',
  boundAt: '2026-08-12T12:00:00.000Z',
} as const;
const audit = {
  organizationId: 'org-a',
  principalRef: 'principal-a',
  requestId: 'request-a',
  policyVersion: 'evidence-authz-policy/1',
} as const;

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing ${label}.`);
  return value;
}

async function fixture() {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'acme-artifact-security-'),
  );
  directories.push(directory);
  const productFile = path.join(directory, 'product.json');
  const objectRoot = path.join(directory, 'objects');
  const repository = createFileEvidenceProductRepository({
    filePath: productFile,
  });
  await repository.putWorkspace(
    {
      schemaVersion: 'evidence-workspace/1',
      workspaceId: scope.workspaceId,
      label: 'Synthetic artifact test',
      dataPolicy: 'synthetic-only',
      evidenceRevision: 0,
      createdAt: scope.boundAt,
    },
    scope,
  );
  let next = 0;
  const objectStore = createFileEvidenceArtifactObjectStore({
    root: objectRoot,
  });
  const keyProvider = createEvidenceArtifactKeyring({
    activeKeyId: 'test-kek',
    activeKeyVersion: 1,
    keys: [{ keyId: 'test-kek', keyVersion: 1, key: Buffer.alloc(32, 7) }],
    nonce: () => Buffer.alloc(12, 8),
  });
  const service = createEvidenceArtifactService({
    repository,
    objectStore,
    keyProvider,
    clock: { now: () => scope.boundAt },
    ids: { next: (kind) => `${kind}-${String(++next)}` },
    random: {
      bytes: (length) => Buffer.alloc(length, 9),
      opaqueId: (prefix) => `${prefix}-fixed`,
    },
  });
  return {
    directory,
    productFile,
    objectRoot,
    repository,
    objectStore,
    keyProvider,
    service,
  };
}

afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe('secure evidence artifacts', () => {
  it('persists only ciphertext, audits before plaintext release and refuses tamper or cross-case reads', async () => {
    const value = await fixture();
    const source = developmentObserveArtifactInput().artifactVersion;
    await value.service.secureSource({
      source,
      scope,
      commandKey: 'secure-1',
      audit,
    });

    const storedText = await readFile(value.productFile, 'utf8');
    expect(storedText).not.toContain(source.text);
    const snapshot = await value.repository.caseSnapshot(
      scope.caseId,
      scope.workspaceId,
    );
    expect(snapshot.sources[0]?.text).toBe(
      EVIDENCE_ENCRYPTED_SOURCE_PLACEHOLDER,
    );
    const hydrated = await value.service.readSource({
      snapshot,
      source: required(snapshot.sources[0], 'stored source'),
      scope,
      audit,
    });
    expect(hydrated.text).toBe(source.text);
    expect(
      (await value.repository.caseSnapshot(scope.caseId, scope.workspaceId))
        .securityAudit,
    ).toContainEqual(
      expect.objectContaining({
        action: 'artifact.read',
        outcome: 'succeeded',
      }),
    );

    const restartedRepository = createFileEvidenceProductRepository({
      filePath: value.productFile,
    });
    const restartedStore = createFileEvidenceArtifactObjectStore({
      root: value.objectRoot,
    });
    const restartedService = createEvidenceArtifactService({
      repository: restartedRepository,
      objectStore: restartedStore,
      keyProvider: createEvidenceArtifactKeyring({
        activeKeyId: 'test-kek',
        activeKeyVersion: 1,
        keys: [{ keyId: 'test-kek', keyVersion: 1, key: Buffer.alloc(32, 7) }],
      }),
      clock: { now: () => scope.boundAt },
      ids: { next: (kind) => `${kind}-restart` },
    });
    const restartedSnapshot = await restartedRepository.caseSnapshot(
      scope.caseId,
      scope.workspaceId,
    );
    await expect(
      restartedService.readSource({
        snapshot: restartedSnapshot,
        source: required(restartedSnapshot.sources[0], 'restarted source'),
        scope,
        audit: { ...audit, requestId: 'request-restart' },
      }),
    ).resolves.toMatchObject({ text: source.text });

    await expect(
      value.service.readSource({
        snapshot,
        source: required(snapshot.sources[0], 'stored source'),
        scope: { ...scope, caseId: 'case-b' },
        audit,
      }),
    ).rejects.toThrow('unavailable');

    const envelope = required(
      snapshot.artifactEnvelopes[0],
      'artifact envelope',
    );
    await writeFile(
      path.join(value.objectRoot, ...envelope.objectKey.split('/')),
      Buffer.alloc(envelope.ciphertextByteLength, 0),
    );
    await expect(
      value.service.readSource({
        snapshot,
        source: required(snapshot.sources[0], 'stored source'),
        scope,
        audit,
      }),
    ).rejects.toThrow('ciphertext');
    expect(
      (await value.repository.caseSnapshot(scope.caseId, scope.workspaceId))
        .securityAudit,
    ).toContainEqual(
      expect.objectContaining({
        action: 'artifact.integrity-failed',
        outcome: 'failed',
      }),
    );
  });

  it('resumes from staged metadata without changing ciphertext identity', async () => {
    const value = await fixture();
    const source = developmentObserveArtifactInput().artifactVersion;
    let failActivation = true;
    const crashingRepository: EvidenceProductRepository = {
      ...value.repository,
      async activateArtifactSource(...args) {
        if (failActivation) {
          failActivation = false;
          throw new Error('injected activation crash');
        }
        return value.repository.activateArtifactSource(...args);
      },
    };
    const crashing = createEvidenceArtifactService({
      repository: crashingRepository,
      objectStore: value.objectStore,
      keyProvider: value.keyProvider,
      clock: { now: () => scope.boundAt },
      ids: { next: (kind) => `${kind}-crash` },
      random: {
        bytes: (length) => Buffer.alloc(length, 6),
        opaqueId: (prefix) => `${prefix}-crash`,
      },
    });
    await expect(
      crashing.secureSource({ source, scope, commandKey: 'retry-1', audit }),
    ).rejects.toThrow('injected activation crash');
    const staged = required(
      (await value.repository.caseSnapshot(scope.caseId, scope.workspaceId))
        .artifactStaging[0],
      'staging record',
    );

    await value.service.secureSource({
      source,
      scope,
      commandKey: 'retry-1',
      audit,
    });
    const completed = await value.repository.caseSnapshot(
      scope.caseId,
      scope.workspaceId,
    );
    expect(completed.artifactEnvelopes[0]).toEqual(staged.pendingEnvelope);
    expect(completed.artifactStaging).toHaveLength(1);
    expect(completed.artifactStaging[0]?.state).toBe('activated');
  });

  it('converges concurrent identical commands on one object and one activation', async () => {
    const value = await fixture();
    const source = developmentObserveArtifactInput().artifactVersion;
    await Promise.all([
      value.service.secureSource({
        source,
        scope,
        commandKey: 'concurrent-1',
        audit: { ...audit, requestId: 'concurrent-a' },
      }),
      value.service.secureSource({
        source,
        scope,
        commandKey: 'concurrent-1',
        audit: { ...audit, requestId: 'concurrent-b' },
      }),
    ]);
    const snapshot = await value.repository.caseSnapshot(
      scope.caseId,
      scope.workspaceId,
    );
    expect(snapshot.artifactStaging).toHaveLength(1);
    expect(snapshot.artifactRepresentations).toHaveLength(1);
    expect(
      snapshot.artifactLifecycle.filter((item) => item.action === 'activated'),
    ).toHaveLength(1);
    await expect(value.objectStore.list('cases', 10)).resolves.toHaveLength(1);
  });

  it('re-wraps without ciphertext mutation, verifies restore inputs and tombstones revisioned deletion', async () => {
    const value = await fixture();
    const source = developmentObserveArtifactInput().artifactVersion;
    await value.service.secureSource({
      source,
      scope,
      commandKey: 'secure-rotate',
      audit,
    });
    const before = await value.repository.caseSnapshot(
      scope.caseId,
      scope.workspaceId,
    );
    const envelopeBefore = required(
      before.artifactEnvelopes[0],
      'pre-rotation envelope',
    );
    const ciphertextBefore = await value.objectStore.read(
      envelopeBefore.objectKey,
      envelopeBefore.ciphertextByteLength,
    );
    const rotatedKeys = createEvidenceArtifactKeyring({
      activeKeyId: 'test-kek',
      activeKeyVersion: 2,
      keys: [
        { keyId: 'test-kek', keyVersion: 1, key: Buffer.alloc(32, 7) },
        { keyId: 'test-kek', keyVersion: 2, key: Buffer.alloc(32, 10) },
      ],
      nonce: () => Buffer.alloc(12, 11),
    });
    let next = 100;
    const rotated = createEvidenceArtifactService({
      repository: value.repository,
      objectStore: value.objectStore,
      keyProvider: rotatedKeys,
      clock: { now: () => scope.boundAt },
      ids: { next: (kind) => `${kind}-${String(++next)}` },
    });
    await rotated.rewrap({
      representationId: envelopeBefore.representationId,
      scope,
      audit,
    });
    const after = await value.repository.caseSnapshot(
      scope.caseId,
      scope.workspaceId,
    );
    const envelopeAfter = required(
      after.artifactEnvelopes[0],
      'post-rotation envelope',
    );
    expect(envelopeAfter.keyVersion).toBe(2);
    expect(envelopeAfter.ciphertextSha256).toBe(
      envelopeBefore.ciphertextSha256,
    );
    expect(
      await value.objectStore.read(
        envelopeAfter.objectKey,
        envelopeAfter.ciphertextByteLength,
      ),
    ).toEqual(ciphertextBefore);

    const manifest = createEvidenceArtifactBackupManifest({
      snapshot: after,
      createdAt: scope.boundAt,
    });
    await expect(
      verifyEvidenceArtifactRestore({
        manifest,
        objectStore: value.objectStore,
        keyProvider: rotatedKeys,
      }),
    ).resolves.toBeUndefined();
    await expect(
      verifyEvidenceArtifactRestore({
        manifest,
        objectStore: value.objectStore,
        keyProvider: value.keyProvider,
      }),
    ).rejects.toThrow('unavailable');

    await rotated.delete({
      representationId: envelopeAfter.representationId,
      scope,
      reason: 'Synthetic deletion verification.',
      expectedRevision: 2,
      audit,
    });
    const deleted = await value.repository.caseSnapshot(
      scope.caseId,
      scope.workspaceId,
    );
    expect(await value.objectStore.stat(envelopeAfter.objectKey)).toBeNull();
    expect(deleted.artifactLifecycle.at(-1)?.action).toBe('deleted');
    await expect(
      rotated.readSource({
        snapshot: deleted,
        source: required(deleted.sources[0], 'deleted source'),
        scope,
        audit,
      }),
    ).rejects.toThrow('unavailable');
    await expect(
      rotated.delete({
        representationId: envelopeAfter.representationId,
        scope,
        reason: 'Stale retry.',
        expectedRevision: 2,
        audit,
      }),
    ).rejects.toThrow('revision');
    const tombstonedManifest = createEvidenceArtifactBackupManifest({
      snapshot: deleted,
      createdAt: scope.boundAt,
    });
    expect(tombstonedManifest.objects).toHaveLength(0);
    expect(tombstonedManifest.tombstonedRepresentationIds).toEqual([
      envelopeAfter.representationId,
    ]);
  });

  it('quarantines expired unactivated staging and removes its orphan object', async () => {
    const value = await fixture();
    const source = developmentObserveArtifactInput().artifactVersion;
    const crashingRepository: EvidenceProductRepository = {
      ...value.repository,
      async activateArtifactSource() {
        throw new Error('injected activation crash');
      },
    };
    const crashing = createEvidenceArtifactService({
      repository: crashingRepository,
      objectStore: value.objectStore,
      keyProvider: value.keyProvider,
      clock: { now: () => scope.boundAt },
      ids: { next: (kind) => `${kind}-orphan` },
      stagingLifetimeMs: 1_000,
    });
    await expect(
      crashing.secureSource({ source, scope, commandKey: 'orphan-1', audit }),
    ).rejects.toThrow('injected activation crash');
    const staged = required(
      (await value.repository.caseSnapshot(scope.caseId, scope.workspaceId))
        .artifactStaging[0],
      'orphan staging record',
    );
    expect(await value.objectStore.stat(staged.objectKey)).not.toBeNull();

    await expect(
      value.service.reconcile({
        scope,
        now: '2026-08-12T12:00:02.000Z',
        audit,
      }),
    ).resolves.toEqual({ quarantined: 1, integrityFailures: 0 });
    const reconciled = await value.repository.caseSnapshot(
      scope.caseId,
      scope.workspaceId,
    );
    expect(reconciled.artifactStaging[0]?.state).toBe('quarantined');
    expect(reconciled.artifactLifecycle.at(-1)?.action).toBe('quarantined');
    expect(await value.objectStore.stat(staged.objectKey)).toBeNull();
  });
});
